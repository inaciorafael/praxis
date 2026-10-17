import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as service from '@/shared/lib/boards/board.service'
import type {
  Board,
  BoardDocumentKind,
  BoardElement,
  BoardScene,
  BoardLayer,
  BoardSummary,
  PaperAppearance,
} from '@/shared/types/board'
import type { Task } from '@/shared/types/task'

const content = (board: Board) =>
  JSON.stringify([
    board.title,
    board.elements,
    board.scenes ?? [],
    board.layers ?? [],
    board.background ?? 'plain',
    board.colorScheme ?? 'light',
    board.locked ?? false,
  ])
const copy = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T
const message = (error: unknown) =>
  error instanceof Error ? error.message : String(error)

export const useBoardStore = defineStore('boards', () => {
  const boards = ref<BoardSummary[]>([])
  const current = ref<Board | null>(null)
  const linkedTasks = ref<Task[]>([])
  const isSaving = ref(false)
  const isLoading = ref(false)
  const isLocking = ref(false)
  const error = ref('')
  const taskLoadError = ref('')
  const baseline = ref('')
  const dirty = computed(
    () => current.value !== null && content(current.value) !== baseline.value
  )
  let timer: ReturnType<typeof setTimeout> | undefined
  let deadline: ReturnType<typeof setTimeout> | undefined
  let flight: Promise<boolean> | null = null
  let taskFlight: Promise<string | null> | null = null
  let generation = 0
  let lockOperation = 0

  function clearTimers() {
    clearTimeout(timer)
    clearTimeout(deadline)
    timer = undefined
    deadline = undefined
  }
  function summary(board: Board) {
    const { elements, scenes: _scenes, layers: _layers, ...rest } = board
    const item = { ...rest, elementCount: elements.length }
    boards.value = [item, ...boards.value.filter((existing) => existing.id !== board.id)]
  }
  function schedule() {
    if (!dirty.value || error.value) return
    clearTimeout(timer)
    timer = setTimeout(() => {
      void flush()
    }, 800)
    deadline ??= setTimeout(() => {
      void flush()
    }, 5000)
  }
  function setTitle(title: string) {
    if (current.value && !current.value.locked && !isLocking.value) {
      current.value.title = title
      schedule()
    }
  }
  function setAppearance(appearance: PaperAppearance) {
    if (
      !current.value ||
      current.value.locked ||
      isLocking.value ||
      ((current.value.background ?? 'plain') === appearance.background &&
        (current.value.colorScheme ?? 'light') === appearance.colorScheme)
    )
      return
    Object.assign(current.value, appearance)
    schedule()
  }
  function setElements(elements: BoardElement[]) {
    if (current.value && !current.value.locked && !isLocking.value) {
      current.value.elements = copy(elements)
      schedule()
    }
  }
  function adopt(board: Board) {
    current.value = copy(board)
    baseline.value = content(board)
    summary(board)
  }
  function setContent(
    elements: BoardElement[],
    scenes: BoardScene[],
    layers?: BoardLayer[]
  ) {
    if (current.value && !current.value.locked && !isLocking.value) {
      current.value.elements = copy(elements)
      current.value.scenes = copy(scenes)
      if (layers !== undefined) current.value.layers = copy(layers)
      schedule()
    }
  }
  function setScenes(scenes: BoardScene[]) {
    if (current.value && !current.value.locked && !isLocking.value) {
      current.value.scenes = copy(scenes)
      schedule()
    }
  }
  async function hydrate() {
    isLoading.value = true
    try {
      boards.value = await service.listBoards()
      error.value = ''
    } catch (cause) {
      error.value = message(cause)
    } finally {
      isLoading.value = false
    }
  }
  async function refreshTasks() {
    const id = current.value?.id
    const epoch = generation
    if (!id) return
    try {
      const result = await service.getBoardTasks(id)
      if (epoch === generation && current.value?.id === id) {
        linkedTasks.value = result
        taskLoadError.value = ''
      }
    } catch (cause) {
      if (epoch === generation) taskLoadError.value = message(cause)
    }
  }
  async function discardAndReload() {
    if (!current.value || flight || taskFlight) return false
    const id = current.value.id
    const epoch = generation
    try {
      await service.reloadBoardVault()
      const saved = await service.getBoard(id)
      if (epoch !== generation || current.value?.id !== id) return false
      generation++
      clearTimers()
      adopt(saved)
      error.value = ''
      await refreshTasks()
      return true
    } catch (cause) {
      if (epoch === generation) error.value = message(cause)
      return false
    }
  }
  async function open(id: string) {
    if (!(await flush())) return false
    isLoading.value = true
    const epoch = ++generation
    try {
      const board = await service.getBoard(id)
      if (epoch !== generation) return false
      adopt(board)
      error.value = ''
      linkedTasks.value = []
      await refreshTasks()
      return true
    } catch (cause) {
      if (epoch === generation) error.value = message(cause)
      return false
    } finally {
      if (epoch === generation) isLoading.value = false
    }
  }
  async function create(
    title: string,
    elements: BoardElement[] = [],
    kind: BoardDocumentKind = 'board',
    appearance?: PaperAppearance,
    scenes?: BoardScene[],
    layers?: BoardLayer[]
  ) {
    if (!(await flush())) return false
    try {
      adopt(
        await service.createBoard({
          title,
          elements,
          ...(scenes !== undefined ? { scenes } : {}),
          ...(layers !== undefined ? { layers } : {}),
          ...(kind === 'paper' ? { kind } : {}),
          ...appearance,
        })
      )
      generation++
      error.value = ''
      await refreshTasks()
      return true
    } catch (cause) {
      error.value = message(cause)
      return false
    }
  }
  async function flush(): Promise<boolean> {
    clearTimers()
    if (taskFlight && !(await taskFlight)) return false
    if (flight) {
      const result = await flight
      if (!result) return false
      return dirty.value ? flush() : true
    }
    if (!current.value || !dirty.value) return true
    const board = copy(current.value)
    const epoch = generation
    isSaving.value = true
    error.value = ''
    flight = (async () => {
      try {
        const saved = await service.saveBoard({
          id: board.id,
          title: board.title,
          elements: board.elements,
          scenes: board.scenes ?? [],
          layers: board.layers,
          expectedRevision: board.revision,
          ...(board.background !== undefined ? { background: board.background } : {}),
          ...(board.colorScheme !== undefined ? { colorScheme: board.colorScheme } : {}),
          ...(board.locked !== undefined ? { locked: board.locked } : {}),
        })
        if (epoch !== generation || current.value?.id !== saved.id) return false
        // Adopt backend defaults/normalization only if no newer draft exists.
        // Otherwise retain edits made during the request and advance their revision.
        if (content(current.value) === content(board)) {
          adopt(saved)
        } else {
          current.value.revision = saved.revision
          current.value.updatedAt = saved.updatedAt
          baseline.value = content(saved)
          summary(saved)
        }
        return true
      } catch (cause) {
        if (epoch === generation) error.value = message(cause)
        return false
      } finally {
        if (epoch === generation) isSaving.value = false
      }
    })()
    const result = await flight
    flight = null
    if (result && dirty.value) return flush()
    return result
  }
  async function remove(id: string) {
    if (!(await flush())) return false
    const item = boards.value.find((board) => board.id === id)
    if (!item || item.locked || isLocking.value) return false
    try {
      await service.deleteBoard(id, item.revision)
      boards.value = boards.value.filter((board) => board.id !== id)
      if (current.value?.id === id) {
        generation++
        current.value = null
        baseline.value = ''
        linkedTasks.value = []
      }
      return true
    } catch (cause) {
      error.value = message(cause)
      return false
    }
  }
  async function makeTask(
    elementId: string,
    operationId: string,
    title: string,
    notes: string | null
  ) {
    if (
      isLocking.value ||
      current.value?.locked ||
      !(await flush()) ||
      !current.value ||
      current.value.locked
    )
      return null
    const epoch = generation
    const snapshot = copy(current.value)
    isSaving.value = true
    error.value = ''
    taskFlight = (async () => {
      try {
        const result = await service.createBoardTask(
          snapshot.id,
          elementId,
          snapshot.revision,
          operationId,
          title,
          notes
        )
        if (epoch !== generation) return null
        if (current.value && content(current.value) !== content(snapshot)) {
          const linked = result.board.elements.find((element) => element.id === elementId)
          current.value.elements = current.value.elements.map((element) =>
            element.id === elementId
              ? { ...element, kind: linked?.kind ?? element.kind, taskId: result.taskId }
              : element
          )
          current.value.revision = result.board.revision
          baseline.value = content(result.board)
          summary(result.board)
        } else {
          adopt(result.board)
        }
        await refreshTasks()
        return result.taskId
      } catch (cause) {
        if (epoch === generation) error.value = message(cause)
        return null
      } finally {
        if (epoch === generation) isSaving.value = false
      }
    })()
    const result = await taskFlight
    taskFlight = null
    if (result && dirty.value) schedule()
    return result
  }
  async function setLocked(locked: boolean): Promise<boolean> {
    if (!current.value || isLocking.value) return false
    const epoch = generation
    const id = current.value.id
    const operation = ++lockOperation
    isLocking.value = true
    try {
      if (!(await flush()) || generation !== epoch || current.value?.id !== id)
        return false
      if ((current.value.locked ?? false) === locked) return true
      const board = copy(current.value)
      isSaving.value = true
      error.value = ''
      flight = (async () => {
        try {
          const saved = await service.saveBoard({
            id: board.id,
            title: board.title,
            elements: board.elements,
            scenes: board.scenes ?? [],
            layers: board.layers,
            expectedRevision: board.revision,
            locked,
            ...(board.background !== undefined ? { background: board.background } : {}),
            ...(board.colorScheme !== undefined
              ? { colorScheme: board.colorScheme }
              : {}),
          })
          if (generation !== epoch || current.value?.id !== id) return false
          adopt(saved)
          return true
        } catch (cause) {
          if (generation === epoch) error.value = message(cause)
          return false
        } finally {
          if (generation === epoch) isSaving.value = false
        }
      })()
      const result = await flight
      flight = null
      return result
    } finally {
      if (lockOperation === operation) isLocking.value = false
    }
  }
  function reset() {
    generation++
    lockOperation++
    clearTimers()
    current.value = null
    boards.value = []
    linkedTasks.value = []
    baseline.value = ''
    error.value = ''
    taskLoadError.value = ''
    isSaving.value = false
    isLoading.value = false
    isLocking.value = false
  }
  return {
    boards,
    current,
    linkedTasks,
    dirty,
    isSaving,
    isLoading,
    isLocking,
    error,
    taskLoadError,
    hydrate,
    open,
    create,
    remove,
    flush,
    setTitle,
    setAppearance,
    setElements,
    setContent,
    setScenes,
    setLocked,
    refreshTasks,
    makeTask,
    reset,
    discardAndReload,
  }
})
