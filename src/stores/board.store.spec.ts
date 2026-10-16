import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBoardStore } from './board.store'
import * as service from '@/shared/lib/boards/board.service'
import type { Board, BoardElement } from '@/shared/types/board'

vi.mock('@/shared/lib/boards/board.service', () => ({
  listBoards: vi.fn(),
  getBoard: vi.fn(),
  createBoard: vi.fn(),
  saveBoard: vi.fn(),
  deleteBoard: vi.fn(),
  getBoardTasks: vi.fn(),
  createBoardTask: vi.fn(),
  reloadBoardVault: vi.fn(),
}))
const initial: Board = {
  id: 'board',
  title: 'Original',
  formatVersion: 1,
  revision: 1,
  elements: [],
  createdAt: '2026-10-13',
  updatedAt: '2026-10-13',
}
beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  vi.mocked(service.getBoard).mockResolvedValue(structuredClone(initial))
  vi.mocked(service.getBoardTasks).mockResolvedValue([])
  vi.mocked(service.reloadBoardVault).mockResolvedValue({} as never)
})

describe('board autosave', () => {
  it('saves the current draft before persisting lock and keeps it after reopening', async () => {
    vi.mocked(service.saveBoard).mockImplementation(async (input) => ({
      ...initial,
      ...input,
      revision: input.expectedRevision + 1,
    }))
    const store = useBoardStore()
    await store.open('board')
    store.setTitle('Draft')
    expect(await store.setLocked(true)).toBe(true)
    expect(service.saveBoard).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ title: 'Draft', expectedRevision: 1 })
    )
    expect(service.saveBoard).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ title: 'Draft', expectedRevision: 2, locked: true })
    )
    expect(store.current?.locked).toBe(true)
    expect(store.dirty).toBe(false)
    store.setTitle('Ignored')
    store.setElements([])
    store.setAppearance({ background: 'grid', colorScheme: 'dark' })
    expect(store.current?.title).toBe('Draft')
    expect(store.current?.background).toBeUndefined()
    expect(store.dirty).toBe(false)
    expect(await store.makeTask('element', 'operation', 'Action', null)).toBeNull()
    expect(await store.remove('board')).toBe(false)
    expect(service.createBoardTask).not.toHaveBeenCalled()
    expect(service.deleteBoard).not.toHaveBeenCalled()
    vi.mocked(service.getBoard).mockResolvedValue(
      JSON.parse(JSON.stringify(store.current)) as Board
    )
    await store.open('board')
    expect(store.current?.locked).toBe(true)
    expect(service.saveBoard).toHaveBeenCalledTimes(2)
    expect(await store.setLocked(false)).toBe(true)
    store.setTitle('Editable')
    expect(store.current?.title).toBe('Editable')
    store.reset()
  })
  it('keeps the prior lock state on save failure and retains a failed draft', async () => {
    const store = useBoardStore()
    await store.open('board')
    vi.mocked(service.saveBoard).mockRejectedValue(new Error('Disk full'))
    store.setTitle('Draft')
    expect(await store.setLocked(true)).toBe(false)
    expect(store.current?.locked).toBeUndefined()
    expect(store.current?.title).toBe('Draft')
    expect(store.dirty).toBe(true)
    expect(store.isLocking).toBe(false)
    store.reset()
    vi.mocked(service.getBoard).mockResolvedValue({ ...initial, locked: true })
    await store.open('board')
    expect(await store.setLocked(false)).toBe(false)
    expect(store.current?.locked).toBe(true)
    expect(store.dirty).toBe(false)
    expect(store.error).toBe('Disk full')
    expect(store.isSaving).toBe(false)
    expect(store.isLocking).toBe(false)
    store.reset()
  })
  it('blocks edits during lock persistence and does not restore state after reset', async () => {
    const store = useBoardStore()
    await store.open('board')
    let finish!: (board: Board) => void
    vi.mocked(service.saveBoard).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const pending = store.setLocked(true)
    await Promise.resolve()
    expect(store.isLocking).toBe(true)
    store.setTitle('Ignored')
    expect(store.current?.title).toBe('Original')
    expect(await store.setLocked(false)).toBe(false)
    store.reset()
    finish({ ...initial, locked: true, revision: 2 })
    expect(await pending).toBe(false)
    expect(store.current).toBeNull()
    expect(store.isLocking).toBe(false)
  })
  it('preserves independent shape fill across save and reopening without hydration writes', async () => {
    const shape: BoardElement = {
      id: 'shape',
      kind: 'rectangle',
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      text: 'Idea',
      color: 'amber',
      strokeColor: '#123456',
      fillColor: '#abcdef',
      resolved: false,
      points: [],
      startId: null,
      endId: null,
      taskId: null,
      imageData: null,
    }
    vi.mocked(service.getBoard).mockResolvedValue({ ...initial, elements: [shape] })
    vi.mocked(service.saveBoard).mockImplementation(async (input) => ({
      ...initial,
      ...input,
      revision: 2,
    }))
    const store = useBoardStore()
    await store.open('board')
    await store.flush()
    expect(service.saveBoard).not.toHaveBeenCalled()
    store.setElements([{ ...shape, fillColor: 'transparent' }])
    expect(await store.flush()).toBe(true)
    expect(service.saveBoard).toHaveBeenCalledWith(
      expect.objectContaining({ elements: [{ ...shape, fillColor: 'transparent' }] })
    )
    const saved = structuredClone(JSON.parse(JSON.stringify(store.current))) as Board
    vi.mocked(service.getBoard).mockResolvedValue(saved)
    await store.open('board')
    expect(store.current?.elements[0]).toEqual({ ...shape, fillColor: 'transparent' })
    expect(store.dirty).toBe(false)
    store.reset()
  })
  it('keeps legacy defaults read-only and persists a changed Paper appearance', async () => {
    const store = useBoardStore()
    await store.open('board')
    store.setAppearance({ background: 'plain', colorScheme: 'light' })
    await store.flush()
    expect(service.saveBoard).not.toHaveBeenCalled()
    vi.mocked(service.saveBoard).mockImplementation(async (input) => ({
      ...initial,
      ...input,
      revision: 2,
    }))
    store.setAppearance({ background: 'ruled', colorScheme: 'dark' })
    expect(await store.flush()).toBe(true)
    expect(service.saveBoard).toHaveBeenCalledWith(
      expect.objectContaining({
        background: 'ruled',
        colorScheme: 'dark',
        expectedRevision: 1,
      })
    )
    expect(store.current?.background).toBe('ruled')
    expect(store.current?.colorScheme).toBe('dark')
    expect(store.dirty).toBe(false)
    store.reset()
  })
  it('creates a Paper while keeping kind immutable when saving its canvas', async () => {
    vi.mocked(service.createBoard).mockResolvedValue({ ...initial, kind: 'paper' })
    const store = useBoardStore()
    expect(await store.create('Ideas', [], 'paper')).toBe(true)
    expect(service.createBoard).toHaveBeenCalledWith({
      title: 'Ideas',
      elements: [],
      kind: 'paper',
    })
    vi.mocked(service.saveBoard).mockResolvedValue({
      ...initial,
      kind: 'paper',
      title: 'New ideas',
      revision: 2,
    })
    store.setTitle('New ideas')
    expect(await store.flush()).toBe(true)
    expect(service.saveBoard).toHaveBeenCalledWith({
      id: 'board',
      title: 'New ideas',
      elements: [],
      expectedRevision: 1,
    })
    expect(store.current?.kind).toBe('paper')
    store.reset()
  })
  it('adopts normalized backend content without repeating the same save', async () => {
    const store = useBoardStore()
    await store.open('board')
    vi.mocked(service.saveBoard).mockResolvedValue({
      ...initial,
      title: 'Normalized',
      revision: 2,
    })
    store.setTitle('Normalized ')
    expect(await store.flush()).toBe(true)
    expect(service.saveBoard).toHaveBeenCalledTimes(1)
    expect(store.current?.title).toBe('Normalized')
    expect(store.dirty).toBe(false)
    store.reset()
  })
  it('does not save unchanged content', async () => {
    const store = useBoardStore()
    await store.open('board')
    store.setTitle('Original')
    expect(await store.flush()).toBe(true)
    expect(service.saveBoard).not.toHaveBeenCalled()
    store.reset()
  })
  it('preserves edits made during a save and uses the returned revision', async () => {
    const store = useBoardStore()
    await store.open('board')
    let finish!: (board: Board) => void
    vi.mocked(service.saveBoard)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve
          })
      )
      .mockImplementationOnce(async (input) => ({ ...initial, ...input, revision: 3 }))
    store.setTitle('First')
    const pending = store.flush()
    store.setTitle('Second')
    finish({ ...initial, title: 'First', revision: 2 })
    expect(await pending).toBe(true)
    expect(service.saveBoard).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ title: 'Second', expectedRevision: 2 })
    )
    expect(store.current?.title).toBe('Second')
    expect(store.dirty).toBe(false)
    store.reset()
  })
  it('keeps unsaved content after failure and retries explicitly', async () => {
    const store = useBoardStore()
    await store.open('board')
    vi.mocked(service.saveBoard)
      .mockRejectedValueOnce(new Error('Disk full'))
      .mockResolvedValueOnce({ ...initial, title: 'Keep me', revision: 2 })
    store.setTitle('Keep me')
    expect(await store.flush()).toBe(false)
    expect(store.current?.title).toBe('Keep me')
    expect(store.dirty).toBe(true)
    expect(store.error).toBe('Disk full')
    expect(await store.flush()).toBe(true)
    expect(store.dirty).toBe(false)
    store.reset()
  })
  it('does not restore sensitive content after reset during a request', async () => {
    const store = useBoardStore()
    await store.open('board')
    let finish!: (board: Board) => void
    vi.mocked(service.saveBoard).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    store.setTitle('Unsaved')
    const pending = store.flush()
    store.reset()
    finish({ ...initial, title: 'Unsaved', revision: 2 })
    expect(await pending).toBe(false)
    expect(store.current).toBeNull()
    expect(store.boards).toEqual([])
  })
  it('uses the atomic command with stable operation identity and current revision', async () => {
    const store = useBoardStore()
    await store.open('board')
    vi.mocked(service.createBoardTask).mockResolvedValue({
      board: { ...initial, revision: 2 },
      taskId: 'task',
    })
    expect(await store.makeTask('element', 'operation', 'Implement', 'Context')).toBe(
      'task'
    )
    expect(service.createBoardTask).toHaveBeenCalledWith(
      'board',
      'element',
      1,
      'operation',
      'Implement',
      'Context'
    )
    expect(store.current?.revision).toBe(2)
    store.reset()
  })
  it('preserves newer canvas edits while atomic task creation finishes', async () => {
    const store = useBoardStore()
    await store.open('board')
    let finish!: (result: { board: Board; taskId: string }) => void
    vi.mocked(service.createBoardTask).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const pending = store.makeTask('element', 'operation', 'Implement', null)
    await Promise.resolve()
    store.setTitle('Newer title')
    finish({ board: { ...initial, revision: 2 }, taskId: 'task' })
    expect(await pending).toBe('task')
    expect(store.current?.title).toBe('Newer title')
    expect(store.current?.revision).toBe(2)
    expect(store.dirty).toBe(true)
    store.reset()
  })
  it('does not pause board persistence when referenced tasks fail to load', async () => {
    vi.mocked(service.getBoardTasks).mockRejectedValue(new Error('Tasks unavailable'))
    const store = useBoardStore()
    await store.open('board')
    expect(store.error).toBe('')
    expect(store.taskLoadError).toBe('Tasks unavailable')
    vi.mocked(service.saveBoard).mockResolvedValue({
      ...initial,
      title: 'Editable',
      revision: 2,
    })
    store.setTitle('Editable')
    expect(await store.flush()).toBe(true)
    store.reset()
  })
  it('retains dirty content if explicit reload recovery fails', async () => {
    const store = useBoardStore()
    await store.open('board')
    store.setTitle('Keep me')
    vi.mocked(service.getBoard).mockRejectedValueOnce(new Error('Disk unavailable'))
    expect(await store.discardAndReload()).toBe(false)
    expect(store.current?.title).toBe('Keep me')
    expect(store.dirty).toBe(true)
    store.reset()
  })
  it('does not expose an old task-create failure after reset', async () => {
    const store = useBoardStore()
    await store.open('board')
    let reject!: (error: Error) => void
    vi.mocked(service.createBoardTask).mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail
        })
    )
    const pending = store.makeTask('element', 'operation', 'Task', null)
    await Promise.resolve()
    store.reset()
    reject(new Error('Stale failure'))
    expect(await pending).toBeNull()
    expect(store.error).toBe('')
    expect(store.current).toBeNull()
  })
})
