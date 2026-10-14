<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, onBeforeRouteUpdate, useRoute, useRouter } from 'vue-router'
import {
  List,
  Plus,
  Maximize,
  Minimize,
  Ellipsis,
  X,
  FilePenLine,
  ArrowUpRight,
  ArrowLeft,
} from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import BoardCanvas from '@/features/boards/components/BoardCanvas.vue'
import { useBoardStore } from '@/stores/board.store'
import { useTaskStore } from '@/stores/task.store'
import { searchTasks } from '@/shared/lib/tasks/task.service'
import { getBoardTaskDetails } from '@/shared/lib/boards/board-context.service'
import { attachTaskPaper, listPaperTaskContexts } from '@/shared/lib/papers/paper.service'
import { createPaperFocusSession } from '@/shared/lib/boards/paper-focus.service'
import type { BoardColor, BoardElement } from '@/shared/types/board'
import type { Task } from '@/shared/types/task'

const { t, locale } = useI18n()
const documentLabel = (key: string) => t(`papers.${key}`)
const route = useRoute()
const router = useRouter()
const isFocus = computed(() => route.query.focus === '1')
const focusControls = ref(false)
const focusSession = createPaperFocusSession()
async function toggleFocus() {
  if (!currentDocument.value && !isFocus.value) return
  await router.replace({
    query: { ...route.query, focus: isFocus.value ? undefined : '1' },
  })
}
function focusKeydown(event: KeyboardEvent) {
  if (!isFocus.value || event.key !== 'Escape' || canvas.value?.isInteracting()) return
  if (
    event.target instanceof Element &&
    event.target.closest('input,textarea,select,[contenteditable="true"]')
  )
    return
  event.preventDefault()
  event.stopPropagation()
  void toggleFocus()
}
const board = useBoardStore()
const currentDocument = computed(() => board.current)
const paperContexts = ref<Task[]>([])
const sourceTask = computed(() =>
  paperContexts.value.find((task) => task.id === route.query.fromTaskId)
)
const contextQuery = ref('')
const contextResults = ref<Task[]>([])
const contextSearched = ref(false)
let contextGeneration = 0
async function refreshPaperContexts() {
  const id = currentDocument.value?.id
  const generation = ++contextGeneration
  paperContexts.value = []
  contextQuery.value = ''
  contextResults.value = []
  contextSearched.value = false
  if (!id) return
  try {
    const contexts = await listPaperTaskContexts(id)
    if (generation === contextGeneration && currentDocument.value?.id === id)
      paperContexts.value = contexts
  } catch (cause) {
    if (generation === contextGeneration)
      taskError.value = cause instanceof Error ? cause.message : t('papers.unavailable')
  }
}
function commitCanvas() {
  window.dispatchEvent(new Event('praxis:commit-board-edit'))
  canvas.value?.cancelGesture()
}
const tasks = useTaskStore()
const canvas = ref<InstanceType<typeof BoardCanvas> | null>(null)
const query = ref('')
const selectedId = ref<string | null>(null)
function focusBoardElement(id: string) {
  selectedId.value = id
  canvas.value?.focusElement(id)
}
const taskQuery = ref('')
const taskResults = ref<Task[]>([])
const busy = ref(false)
const listOpen = ref(!board.current)
const taskError = ref('')
const pendingOperations = new Map<string, string>()
const colors: BoardColor[] = ['neutral', 'amber', 'sage', 'blue', 'rose', 'purple']
const selected = computed(() =>
  currentDocument.value?.elements.find((element) => element.id === selectedId.value)
)
const canLinkTask = computed(
  () =>
    !!selected.value &&
    ['question', 'decision', 'note', 'text', 'task'].includes(selected.value.kind)
)
const filtered = computed(() =>
  board.boards
    .filter((item) =>
      item.title.toLocaleLowerCase().includes(query.value.toLocaleLowerCase())
    )
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
)
function editedLabel(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? ''
    : t('papers.edited', {
        date: new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }).format(date),
      })
}
const taskTitles = computed(() =>
  Object.fromEntries(
    board.linkedTasks.map((task) => [task.id, { title: task.title, status: task.status }])
  )
)
let taskRefresh: ReturnType<typeof setTimeout> | undefined
const unsubscribe = tasks.$subscribe(
  () => {
    clearTimeout(taskRefresh)
    taskRefresh = setTimeout(() => {
      void board.refreshTasks()
      void refreshPaperContexts()
    }, 200)
  },
  { detached: true }
)
async function openFromQuery() {
  taskError.value = ''
  selectedId.value = null
  taskResults.value = []
  listOpen.value = !currentDocument.value
  ++contextGeneration
  paperContexts.value = []
  const id = route.query.boardId
  if (typeof id !== 'string') {
    await refreshPaperContexts()
    return
  }
  if (!board.boards.some((item) => item.id === id)) await board.hydrate()
  if (!board.boards.some((item) => item.id === id)) {
    taskError.value = t('papers.unavailable')
    return
  }
  await open(id)
  await nextTick()
  if (board.current?.id === id && typeof route.query.elementId === 'string') {
    selectedId.value = route.query.elementId
    canvas.value?.focusElement(route.query.elementId)
  }
}
onMounted(async () => {
  window.addEventListener('keydown', focusKeydown, true)
  window.addEventListener('praxis:paper-links-changed', refreshPaperLinks)
  await board.hydrate()
  await openFromQuery()
})
watch(
  () => [route.query.boardId, route.query.elementId],
  () => {
    void openFromQuery()
  }
)
onUnmounted(() => {
  window.removeEventListener('keydown', focusKeydown, true)
  void focusSession.leave().catch(() => {})
  window.removeEventListener('praxis:paper-links-changed', refreshPaperLinks)
  unsubscribe()
  clearTimeout(taskRefresh)
  ++contextGeneration
})
watch(
  isFocus,
  async (active) => {
    focusControls.value = false
    try {
      if (active) await focusSession.enter()
      else await focusSession.leave()
      await nextTick()
      canvas.value?.focusCanvas()
    } catch {
      taskError.value = t('boards.focusFailed')
    }
  },
  { immediate: true }
)
function refreshPaperLinks() {
  void board.hydrate()
  void refreshPaperContexts()
}
onBeforeRouteLeave(async () => {
  commitCanvas()
  if (await board.flush()) return true
  if (window.confirm(t('boards.discardConfirm'))) {
    board.reset()
    return true
  }
  return false
})
onBeforeRouteUpdate(async () => {
  commitCanvas()
  return board.flush()
})

async function open(id: string) {
  if (busy.value) return
  busy.value = true
  commitCanvas()
  try {
    if (await board.open(id)) {
      selectedId.value = null
      taskResults.value = []
      listOpen.value = false
      await refreshPaperContexts()
    }
  } finally {
    busy.value = false
  }
}
async function create() {
  if (busy.value) return
  commitCanvas()
  busy.value = true
  try {
    if (await board.create(documentLabel('untitled'), [], 'paper')) {
      selectedId.value = null
      listOpen.value = false
      await refreshPaperContexts()
    }
  } finally {
    busy.value = false
  }
}
async function duplicate() {
  if (!currentDocument.value || busy.value) return
  commitCanvas()
  if (!(await board.flush())) return
  const source = currentDocument.value
  if (!source) return
  busy.value = true
  try {
    const ids = new Map(source.elements.map((item) => [item.id, crypto.randomUUID()]))
    const elements = source.elements.map((item) => ({
      ...item,
      id: ids.get(item.id)!,
      startId: item.startId ? (ids.get(item.startId) ?? null) : null,
      endId: item.endId ? (ids.get(item.endId) ?? null) : null,
    }))
    if (
      await board.create(`${source.title} ${t('boards.copySuffix')}`, elements, 'paper')
    ) {
      selectedId.value = null
      await refreshPaperContexts()
    }
  } finally {
    busy.value = false
  }
}
async function remove() {
  if (
    currentDocument.value &&
    !busy.value &&
    window.confirm(documentLabel('deleteConfirm'))
  ) {
    busy.value = true
    try {
      await board.remove(currentDocument.value.id)
      await refreshPaperContexts()
    } finally {
      busy.value = false
    }
  }
}
async function discardAndReload() {
  if (!busy.value && window.confirm(t('boards.reloadConfirm'))) {
    busy.value = true
    try {
      await board.discardAndReload()
    } finally {
      busy.value = false
    }
  }
}
function updateSelected(patch: Partial<BoardElement>) {
  if (!selected.value || busy.value) return
  board.setElements(
    board.current!.elements.map((item) =>
      item.id === selected.value!.id ? { ...item, ...patch } : item
    )
  )
}
function unlinkTask() {
  if (selected.value)
    updateSelected({
      taskId: null,
      kind: selected.value.kind === 'task' ? 'note' : selected.value.kind,
    })
}
async function search() {
  if (busy.value) return
  busy.value = true
  taskError.value = ''
  try {
    taskResults.value = (
      await searchTasks(
        { query: taskQuery.value, archiveFilter: 'all' },
        { limit: 25, offset: 0 }
      )
    ).tasks
  } catch (cause) {
    taskError.value = cause instanceof Error ? cause.message : String(cause)
  } finally {
    busy.value = false
  }
}
async function link(task: Task) {
  if (!canLinkTask.value) return
  updateSelected({ taskId: task.id })
  if (await board.flush()) await board.refreshTasks()
}
async function makeTask() {
  const item = selected.value
  if (!item || !canLinkTask.value || item.taskId || busy.value || !item.text.trim())
    return
  busy.value = true
  try {
    const key = `${board.current!.id}:${item.id}`
    const operation = pendingOperations.get(key) ?? crypto.randomUUID()
    pendingOperations.set(key, operation)
    const id = await board.makeTask(
      item.id,
      operation,
      item.text.trim().split('\n')[0]!,
      item.text
    )
    if (id) {
      pendingOperations.delete(key)
      await tasks.hydrateViewCounts()
      await openTask(id)
    }
  } finally {
    busy.value = false
  }
}
async function openTask(id: string) {
  const boardId = currentDocument.value?.id
  if (!boardId) return
  taskError.value = ''
  try {
    const details = await getBoardTaskDetails(boardId, id)
    if (currentDocument.value?.id !== boardId) return
    const task = details.tasks.find((item) => item.id === id)
    if (!task) {
      taskError.value = t('boards.taskUnavailable')
      return
    }
    tasks.tasks = [...tasks.tasks.filter((item) => item.id !== id), task]
    tasks.checklistItems = [
      ...tasks.checklistItems.filter((item) => item.taskId !== id),
      ...details.checklistItems,
    ]
    tasks.selectTask(id)
  } catch (cause) {
    taskError.value = cause instanceof Error ? cause.message : t('boards.taskUnavailable')
  }
}
async function searchContext() {
  if (busy.value || !contextQuery.value.trim()) return
  const id = currentDocument.value?.id
  if (!id) return
  busy.value = true
  taskError.value = ''
  try {
    const result = await searchTasks(
      { query: contextQuery.value.trim(), archiveFilter: 'all' },
      { limit: 25, offset: 0 }
    )
    if (currentDocument.value?.id === id) {
      contextResults.value = result.tasks.filter(
        (task) => !paperContexts.value.some((context) => context.id === task.id)
      )
      contextSearched.value = true
    }
  } catch {
    taskError.value = t('papers.error')
  } finally {
    busy.value = false
  }
}
async function attachContext(taskId: string) {
  const id = currentDocument.value?.id
  if (!id || busy.value) return
  commitCanvas()
  busy.value = true
  taskError.value = ''
  try {
    if (!(await board.flush())) return
    await attachTaskPaper(taskId, id)
    if (currentDocument.value?.id === id) await refreshPaperContexts()
  } catch {
    taskError.value = t('papers.error')
  } finally {
    busy.value = false
  }
}
async function exportPng() {
  try {
    await canvas.value?.exportPng(board.current?.title ?? 'Praxis')
  } catch (cause) {
    taskError.value = cause instanceof Error ? cause.message : t('boards.exportFailed')
  }
}
</script>

<template>
  <section
    class="paper-studio relative flex h-full min-h-0 flex-col"
    :class="isFocus ? 'paper-focus fixed inset-0 z-40 bg-white' : ''"
    :data-focus="isFocus"
  >
    <div
      v-if="isFocus"
      class="paper-focus-actions"
      @pointerdown.stop
    >
      <button
        class="board-button"
        :aria-pressed="focusControls"
        @click="focusControls = !focusControls"
      >
        {{ t(focusControls ? 'boards.hideFocusTools' : 'boards.showFocusTools') }}
      </button>
      <button
        class="board-button"
        :aria-label="t('boards.exitFocus')"
        :title="`${t('boards.exitFocus')} (Esc)`"
        @click="toggleFocus"
      >
        <Minimize :size="16" /><span>{{ t('boards.exitFocus') }}</span>
      </button>
    </div>
    <div
      v-if="!isFocus && currentDocument"
      class="paper-studio-header flex min-w-0 items-center gap-2"
    >
      <button
        class="board-button"
        :aria-label="t('boards.studio.backToPraxis')"
        :title="t('boards.studio.backToPraxis')"
        @click="router.push({ name: 'today' })"
      >
        <ArrowLeft :size="16" />
      </button>
      <button
        class="board-button"
        :aria-label="documentLabel('boardList')"
        :title="documentLabel('boardList')"
        :aria-expanded="listOpen"
        aria-controls="board-list"
        @click="listOpen = !listOpen"
      >
        <List :size="16" />
      </button>
      <input
        v-if="currentDocument"
        class="board-input paper-title min-w-0 font-semibold"
        :aria-label="documentLabel('name')"
        :value="currentDocument.title"
        :disabled="busy"
        maxlength="200"
        @input="board.setTitle(($event.target as HTMLInputElement).value)"
      />
      <h1
        v-else
        class="flex-1 text-heading"
      >
        {{ documentLabel('title') }}
      </h1>
      <span
        v-if="currentDocument"
        role="status"
        class="shrink-0 text-small text-ink-muted"
        >{{
          t(
            board.isSaving
              ? 'boards.saving'
              : board.error
                ? 'boards.saveFailed'
                : board.dirty
                  ? 'boards.unsaved'
                  : 'boards.saved'
          )
        }}</span
      >
      <button
        class="board-button"
        :aria-label="documentLabel('new')"
        :title="documentLabel('new')"
        :disabled="busy"
        @click="create()"
      >
        <Plus :size="16" />
      </button>
      <button
        class="board-button"
        :aria-label="
          t(route.query.focus === '1' ? 'boards.exitFocus' : 'boards.focusCanvas')
        "
        :title="t(route.query.focus === '1' ? 'boards.exitFocus' : 'boards.focusCanvas')"
        :aria-pressed="route.query.focus === '1'"
        :disabled="!currentDocument"
        @click="toggleFocus"
      >
        <component
          :is="route.query.focus === '1' ? Minimize : Maximize"
          :size="16"
        />
      </button>
      <details
        v-if="currentDocument"
        class="relative"
      >
        <summary
          class="board-button cursor-pointer list-none"
          :aria-label="t('boards.moreActions')"
          :title="t('boards.moreActions')"
        >
          <Ellipsis :size="16" />
        </summary>
        <div
          class="absolute right-0 top-full z-30 mt-1 grid w-48 gap-1 border border-border bg-surface p-2 shadow-lg"
        >
          <button
            class="board-button text-left"
            :disabled="busy"
            @click="duplicate"
          >
            {{ t('boards.duplicate') }}</button
          ><button
            class="board-button text-left"
            :disabled="busy"
            @click="exportPng"
          >
            {{ t('boards.exportPng') }}</button
          ><button
            class="board-button text-left text-brick"
            :disabled="busy"
            @click="remove"
          >
            {{ t('boards.delete') }}
          </button>
        </div>
      </details>
    </div>
    <button
      v-if="!isFocus && sourceTask"
      class="board-button paper-source-task"
      data-back-to-task
      :disabled="busy"
      @click="openTask(sourceTask.id)"
    >
      <ArrowLeft :size="14" />{{ t('papers.backToTask') }} · {{ sourceTask.title }}
    </button>
    <details
      v-if="!isFocus && currentDocument"
      class="paper-contexts text-small"
      :class="{ 'paper-contexts-from-task': sourceTask }"
    >
      <summary class="board-button cursor-pointer">
        {{
          paperContexts.length
            ? t('papers.taskContexts') + ' · ' + paperContexts.length
            : t('papers.standalone')
        }}
      </summary>
      <div class="grid gap-1 rounded-lg border border-border bg-surface p-2 shadow-lg">
        <button
          v-for="task in paperContexts"
          :key="task.id"
          class="board-button"
          :disabled="busy"
          @click="openTask(task.id)"
        >
          {{ task.title }}
        </button>
        <p class="py-2 text-small text-ink-soft">{{ t('papers.contextHint') }}</p>
        <form
          class="grid gap-2"
          @submit.prevent="searchContext"
        >
          <label
            for="paper-context-search"
            class="text-small"
            >{{ t('papers.searchTasks') }}</label
          >
          <input
            id="paper-context-search"
            v-model="contextQuery"
            class="board-input w-full"
            type="search"
            :disabled="busy"
          />
          <button
            class="board-button"
            :disabled="busy || !contextQuery.trim()"
          >
            {{ t('nav.search') }}
          </button>
        </form>
        <p
          v-if="contextSearched && !contextResults.length"
          class="text-small text-ink-muted"
        >
          {{ t('papers.noTaskResults') }}
        </p>
        <button
          v-for="task in contextResults"
          :key="task.id"
          class="board-button text-left"
          :disabled="busy"
          @click="attachContext(task.id)"
        >
          {{ t('papers.attachTask') }} · {{ task.title }}
        </button>
      </div>
    </details>
    <p
      v-if="board.error"
      role="alert"
      class="paper-studio-alert text-body text-brick"
    >
      {{ board.error }}
      <button
        class="board-button"
        :disabled="board.isSaving || busy"
        @click="board.flush()"
      >
        {{ t('boards.retry') }}
      </button>
      <button
        v-if="currentDocument"
        class="board-button"
        :disabled="board.isSaving || busy"
        @click="discardAndReload"
      >
        {{ t('boards.reload') }}
      </button>
    </p>
    <p
      v-if="taskError || board.taskLoadError"
      role="alert"
      class="paper-studio-alert text-body text-brick"
    >
      {{ taskError || board.taskLoadError }}
      <button
        v-if="board.taskLoadError"
        class="board-button"
        @click="board.refreshTasks()"
      >
        {{ t('boards.refreshTasks') }}
      </button>
    </p>
    <div class="relative flex min-h-0 flex-1">
      <aside
        v-if="!isFocus && (listOpen || !currentDocument)"
        id="board-list"
        class="paper-gallery absolute inset-0 z-30 flex min-h-0 flex-col bg-paper text-ink"
      >
        <header class="flex items-center justify-between gap-4">
          <span class="text-small font-semibold uppercase tracking-widest">{{
            t('boards.studio.gallery')
          }}</span>
          <button
            v-if="currentDocument"
            class="board-button gallery-close"
            :aria-label="t('common.close')"
            @click="listOpen = false"
          >
            <X :size="18" />
          </button>
        </header>
        <div class="gallery-heading">
          <h1>{{ documentLabel('title') }}</h1>
          <p>{{ t('papers.conceptDescription') }}</p>
        </div>
        <details
          class="paper-concept-guide"
          :open="!board.boards.length"
        >
          <summary class="cursor-pointer text-small font-semibold">
            {{ t('papers.guide') }}
          </summary>
          <div class="paper-concept-steps">
            <div
              v-for="step in ['think', 'record', 'act']"
              :key="step"
              class="grid content-start gap-2"
            >
              <h2 class="text-body font-semibold">{{ t(`papers.${step}Title`) }}</h2>
              <p class="text-small text-ink-soft">{{ t(`papers.${step}Body`) }}</p>
            </div>
          </div>
          <p class="text-small text-ink-muted">{{ t('papers.reuseHint') }}</p>
        </details>
        <div class="flex flex-wrap items-center justify-between gap-3">
          <label
            class="sr-only"
            for="board-search"
            >{{ documentLabel('search') }}</label
          >
          <input
            id="board-search"
            v-model="query"
            class="board-input gallery-search"
            type="search"
            :placeholder="documentLabel('search')"
          />
          <button
            class="board-button gallery-create"
            :aria-label="documentLabel('new')"
            :disabled="busy"
            @click="create()"
          >
            <Plus :size="18" />{{ t('boards.studio.createPaper') }}
          </button>
        </div>
        <h2
          v-if="filtered.length"
          class="text-small font-semibold"
        >
          {{ t('papers.recent') }}
        </h2>
        <div class="gallery-grid overflow-auto">
          <button
            v-for="item in filtered"
            :key="item.id"
            class="paper-card text-left"
            :class="{ 'bg-selection': currentDocument?.id === item.id }"
            :aria-pressed="currentDocument?.id === item.id"
            :disabled="busy"
            @click="open(item.id)"
          >
            <span class="paper-card-icon"
              ><FilePenLine
                :size="28"
                :stroke-width="1.3"
            /></span>
            <span class="paper-card-title">{{ item.title }}</span>
            <span class="text-small text-ink-muted">{{
              t('papers.elementCount', item.elementCount)
            }}</span>
            <span class="text-caption text-ink-muted">{{
              editedLabel(item.updatedAt)
            }}</span>
            <span class="paper-card-open"
              >{{ t('boards.studio.openPaper') }}<ArrowUpRight :size="16"
            /></span>
          </button>
          <p
            v-if="!filtered.length"
            class="gallery-empty"
          >
            {{
              board.isLoading
                ? t('boards.loading')
                : query.trim()
                  ? t('papers.noSearchResults')
                  : t('boards.studio.emptyGallery')
            }}
          </p>
        </div>
      </aside>
      <div
        v-if="currentDocument"
        class="relative flex min-h-0 min-w-0 flex-1 flex-col gap-2"
      >
        <div
          class="relative min-h-[200px] flex-1"
          :class="{ 'pointer-events-none opacity-60': busy }"
          :inert="busy"
        >
          <BoardCanvas
            ref="canvas"
            :key="currentDocument.id"
            :elements="currentDocument.elements"
            :task-titles="taskTitles"
            :distraction-free="isFocus && !focusControls"
            @change="board.setElements"
            @select="selectedId = $event"
          />
        </div>
        <details
          v-if="!isFocus"
          class="paper-inspector absolute bottom-16 right-3 z-10 max-h-[60%] w-[min(22rem,100%)] overflow-auto rounded-xl border border-border bg-surface shadow-lg"
        >
          <summary class="cursor-pointer p-2 text-small">
            {{ t('boards.inspector') }}
          </summary>
          <div
            v-if="selected"
            class="grid gap-2 border-t border-border bg-surface p-3"
          >
            <button
              v-if="selected.kind === 'text'"
              class="board-button"
              :disabled="busy"
              @click="canvas?.editText(selected.id)"
            >
              {{ t('boards.rich.editor') }}
            </button>
            <label
              v-else
              class="grid gap-1 text-small"
              >{{ t('boards.textLabel')
              }}<textarea
                class="board-input"
                :value="selected.text"
                :disabled="busy || (selected.kind === 'task' && !!selected.taskId)"
                rows="2"
                @input="
                  updateSelected({ text: ($event.target as HTMLTextAreaElement).value })
                "
              />
            </label>
            <div class="flex flex-wrap items-center gap-2">
              <label class="text-small"
                >{{ t('boards.colorLabel') }}
                <select
                  class="board-input"
                  :value="selected.color"
                  :disabled="busy"
                  @change="
                    updateSelected({
                      color: ($event.target as HTMLSelectElement).value as BoardColor,
                    })
                  "
                >
                  <option
                    v-for="color in colors"
                    :key="color"
                    :value="color"
                  >
                    {{ t(`boards.colors.${color}`) }}
                  </option>
                </select></label
              >
              <label
                v-if="selected.kind === 'question'"
                class="text-small"
                ><input
                  type="checkbox"
                  :checked="selected.resolved"
                  :disabled="busy"
                  @change="
                    updateSelected({
                      resolved: ($event.target as HTMLInputElement).checked,
                    })
                  "
                />
                {{ t('boards.resolved') }}</label
              >
            </div>
            <details
              v-if="canLinkTask"
              class="border-t border-border pt-2"
            >
              <summary class="cursor-pointer text-small">
                {{ t('boards.linkedTask') }}
              </summary>
              <div class="flex flex-wrap items-center gap-2 py-2">
                <template v-if="selected.taskId"
                  ><button
                    class="board-button"
                    :disabled="!taskTitles[selected.taskId] || busy"
                    @click="openTask(selected.taskId)"
                  >
                    {{ t('boards.openTask') }}</button
                  ><span class="text-small"
                    >{{
                      taskTitles[selected.taskId]?.title ?? t('boards.taskUnavailable')
                    }}
                    ·
                    {{
                      taskTitles[selected.taskId]
                        ? t(`boards.taskStatus.${taskTitles[selected.taskId]!.status}`)
                        : ''
                    }}</span
                  ><button
                    class="board-button"
                    :disabled="busy"
                    @click="unlinkTask"
                  >
                    {{ t('boards.unlink') }}
                  </button></template
                >
                <button
                  v-else-if="canLinkTask"
                  class="board-button"
                  :disabled="busy || !selected.text.trim()"
                  @click="makeTask"
                >
                  {{ t('boards.createTask') }}
                </button>
              </div>
              <form
                v-if="canLinkTask && !selected.taskId"
                class="flex flex-wrap items-center gap-2"
                @submit.prevent="search"
              >
                <label
                  class="text-small"
                  for="board-task-search"
                  >{{ t('boards.linkExisting') }}</label
                ><input
                  id="board-task-search"
                  v-model="taskQuery"
                  class="board-input"
                  type="search"
                /><button
                  class="board-button"
                  :disabled="busy"
                >
                  {{ documentLabel('search') }}</button
                ><button
                  v-for="task in taskResults"
                  :key="task.id"
                  type="button"
                  class="board-button"
                  :disabled="busy"
                  @click="link(task)"
                >
                  {{ task.title }}
                </button>
              </form>
            </details>
          </div>
          <div class="border-t border-border p-2">
            <h2 class="mb-2 text-small font-semibold">{{ t('boards.outline') }}</h2>
            <div class="max-h-36 overflow-auto">
              <button
                v-for="item in currentDocument.elements"
                :key="item.id"
                class="block text-body hover:underline"
                @click="focusBoardElement(item.id)"
              >
                {{
                  item.taskId
                    ? (taskTitles[item.taskId]?.title ?? t('boards.taskUnavailable'))
                    : item.text || t(`boards.tools.${item.kind}`)
                }}
              </button>
            </div>
          </div>
        </details>
      </div>
      <div
        v-else
        class="flex-1"
      ></div>
    </div>
  </section>
</template>

<style scoped>
.paper-studio {
  --paper: #fff;
  --surface: #fff;
  --ink: #33312c;
  --ink-soft: #666259;
  --ink-muted: #8c877b;
  --border: #e5e0d5;
  --hover: #f5f1e8;
  --selection: #f5e6c8;
  --accent: #b57e29;
  --shadow-color: #30271918;
  --color-paper: #fff;
  --color-surface: #fff;
  --color-ink: #33312c;
  --color-ink-soft: #666259;
  --color-ink-muted: #8c877b;
  --color-border: #e5e0d5;
  --color-hover: #f5f1e8;
  --color-selection: #f5e6c8;
  --color-accent: #b57e29;
  background: #fff;
  color: #33312c;
}
.paper-inspector:not([open]) {
  width: auto;
}
.paper-studio :deep(.board-viewport) {
  border-radius: 0;
}
.paper-studio-header {
  position: absolute;
  top: 12px;
  left: 12px;
  z-index: 25;
  max-width: calc(100% - 24px);
  padding: 5px;
  border: 1px solid #e5e7eb;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.96);
  color: #252a34;
  box-shadow: 0 3px 16px #1422380d;
}
.paper-studio-header .board-button {
  display: flex;
  align-items: center;
  justify-content: center;
  border-color: transparent;
  border-radius: 9px;
  background: transparent;
  color: #475569;
}
.paper-studio-header .board-button:hover {
  background: #f5f1e8;
  color: #333;
}
.paper-studio-header .paper-title {
  width: clamp(100px, 22vw, 260px);
  border: 0;
  background: transparent;
  color: #252a34;
}
.paper-studio-header [role='status'] {
  font-size: 11px;
  color: #64748b;
}
.paper-contexts {
  position: absolute;
  top: 14px;
  right: 12px;
  z-index: 24;
  max-width: 320px;
}
.paper-contexts[open] {
  width: min(320px, calc(100vw - 24px));
}
.paper-source-task {
  position: absolute;
  top: 64px;
  left: 220px;
  z-index: 24;
  display: flex;
  align-items: center;
  gap: 6px;
  max-width: min(320px, calc(100% - 410px));
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
  border-radius: 9px;
}
.paper-contexts-from-task {
  top: 108px;
}
.paper-contexts > div {
  max-height: calc(100vh - 90px);
  overflow-y: auto;
}
.paper-concept-guide {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: #faf9f5;
}
.paper-concept-steps {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 24px;
  padding: 18px 0;
}
@media (max-width: 640px) {
  .paper-concept-steps {
    grid-template-columns: 1fr;
    gap: 16px;
  }
}
.paper-studio-alert {
  position: absolute;
  top: 62px;
  left: 208px;
  right: 12px;
  z-index: 45;
  padding: 10px;
  border: 1px solid var(--brick);
  border-radius: 10px;
  background: var(--surface);
}
.paper-studio-alert + .paper-studio-alert {
  top: 112px;
}
.paper-gallery {
  padding: clamp(20px, 3vw, 40px);
  gap: 16px;
  overflow-y: auto;
}
.gallery-heading h1 {
  font-size: 28px;
  line-height: 1.2;
  letter-spacing: -0.04em;
  font-weight: 600;
}
.gallery-heading p {
  margin-top: 10px;
  max-width: 620px;
  color: var(--ink-soft);
  font-size: 15px;
  line-height: 1.6;
}
.gallery-search {
  width: min(360px, 100%);
  border-radius: 12px;
  padding: 12px 16px;
}
.board-button.gallery-create {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 18px;
  border-radius: 12px;
  background: var(--ink);
  color: var(--paper);
}
.board-button.gallery-create:hover {
  background: var(--ink-soft);
}
.gallery-close {
  border-radius: 10px;
}
.gallery-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 16px;
  align-content: start;
}
.paper-card {
  display: grid;
  gap: 12px;
  padding: 24px;
  border: 1px solid var(--border);
  border-radius: 18px;
  background: var(--surface);
  transition:
    border-color 120ms,
    transform 120ms;
}
.paper-card:hover {
  border-color: var(--ink-muted);
  transform: translateY(-2px);
}
.paper-card[aria-pressed='true'] {
  border-color: var(--ink-soft);
}
.paper-card-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 64px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--paper);
  color: var(--ink-soft);
}
.paper-card-title {
  font-size: 17px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.paper-card-open {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  color: var(--ink-soft);
  font-size: 12px;
}
.gallery-empty {
  grid-column: 1/-1;
  padding: 48px 12px;
  color: var(--ink-muted);
  text-align: center;
}
.paper-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
@media (max-width: 800px) {
  .paper-contexts {
    top: 64px;
  }
  .paper-contexts-from-task {
    top: 108px;
  }
  .paper-studio-header [role='status'] {
    display: none;
  }
}
.paper-focus :deep(.board-viewport) {
  border-radius: 0;
}
.paper-focus-actions {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 50;
  display: flex;
  gap: 6px;
  opacity: 0.3;
  transition: opacity 150ms;
}
.paper-focus-actions:hover,
.paper-focus-actions:focus-within {
  opacity: 1;
}
.paper-focus-actions .board-button {
  display: flex;
  align-items: center;
  gap: 6px;
  border-radius: 8px;
  background: #fff;
  color: #252a34;
}
.board-button {
  border: 1px solid var(--border);
  background: var(--paper);
  padding: 0.4rem 0.65rem;
  font-size: 0.8rem;
}
.board-button:hover {
  background: var(--hover);
}
.paper-focus-actions .board-button:hover {
  background: #f1f5f9;
  color: #252a34;
}
.board-button:disabled {
  opacity: 0.5;
  cursor: wait;
}
.board-input {
  min-width: 0;
  max-width: 100%;
  border: 1px solid var(--border);
  background: var(--paper);
  color: var(--ink);
  padding: 0.4rem 0.5rem;
  font-size: 0.85rem;
}
.board-button:focus-visible,
.board-input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
