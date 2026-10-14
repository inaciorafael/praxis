import { createPinia, setActivePinia } from 'pinia'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useBoardStore } from './board.store'
import * as service from '@/shared/lib/boards/board.service'
import type { Board } from '@/shared/types/board'

vi.mock('@/shared/lib/boards/board.service', () => ({
  listBoards: vi.fn(), getBoard: vi.fn(), createBoard: vi.fn(), saveBoard: vi.fn(),
  deleteBoard: vi.fn(), getBoardTasks: vi.fn(), createBoardTask: vi.fn(),
  reloadBoardVault: vi.fn(),
}))
const initial: Board = { id: 'board', title: 'Original', formatVersion: 1, revision: 1, elements: [], createdAt: '2026-10-13', updatedAt: '2026-10-13' }
beforeEach(() => {
  setActivePinia(createPinia()); vi.clearAllMocks()
  vi.mocked(service.getBoard).mockResolvedValue(structuredClone(initial))
  vi.mocked(service.getBoardTasks).mockResolvedValue([])
  vi.mocked(service.reloadBoardVault).mockResolvedValue({} as never)
})

describe('board autosave', () => {
  it('creates a Paper while keeping kind immutable when saving its canvas', async () => {
    vi.mocked(service.createBoard).mockResolvedValue({ ...initial, kind: 'paper' })
    const store = useBoardStore()
    expect(await store.create('Ideas', [], 'paper')).toBe(true)
    expect(service.createBoard).toHaveBeenCalledWith({ title: 'Ideas', elements: [], kind: 'paper' })
    vi.mocked(service.saveBoard).mockResolvedValue({ ...initial, kind: 'paper', title: 'New ideas', revision: 2 })
    store.setTitle('New ideas')
    expect(await store.flush()).toBe(true)
    expect(service.saveBoard).toHaveBeenCalledWith({ id: 'board', title: 'New ideas', elements: [], expectedRevision: 1 })
    expect(store.current?.kind).toBe('paper')
    store.reset()
  })
  it('adopts normalized backend content without repeating the same save', async () => {
    const store = useBoardStore(); await store.open('board')
    vi.mocked(service.saveBoard).mockResolvedValue({ ...initial, title: 'Normalized', revision: 2 })
    store.setTitle('Normalized ')
    expect(await store.flush()).toBe(true)
    expect(service.saveBoard).toHaveBeenCalledTimes(1)
    expect(store.current?.title).toBe('Normalized')
    expect(store.dirty).toBe(false); store.reset()
  })
  it('does not save unchanged content', async () => {
    const store = useBoardStore(); await store.open('board')
    store.setTitle('Original')
    expect(await store.flush()).toBe(true)
    expect(service.saveBoard).not.toHaveBeenCalled(); store.reset()
  })
  it('preserves edits made during a save and uses the returned revision', async () => {
    const store = useBoardStore(); await store.open('board')
    let finish!: (board: Board) => void
    vi.mocked(service.saveBoard).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
      .mockImplementationOnce(async input => ({ ...initial, ...input, revision: 3 }))
    store.setTitle('First')
    const pending = store.flush()
    store.setTitle('Second')
    finish({ ...initial, title: 'First', revision: 2 })
    expect(await pending).toBe(true)
    expect(service.saveBoard).toHaveBeenNthCalledWith(2, expect.objectContaining({ title: 'Second', expectedRevision: 2 }))
    expect(store.current?.title).toBe('Second'); expect(store.dirty).toBe(false); store.reset()
  })
  it('keeps unsaved content after failure and retries explicitly', async () => {
    const store = useBoardStore(); await store.open('board')
    vi.mocked(service.saveBoard).mockRejectedValueOnce(new Error('Disk full'))
      .mockResolvedValueOnce({ ...initial, title: 'Keep me', revision: 2 })
    store.setTitle('Keep me')
    expect(await store.flush()).toBe(false)
    expect(store.current?.title).toBe('Keep me'); expect(store.dirty).toBe(true); expect(store.error).toBe('Disk full')
    expect(await store.flush()).toBe(true); expect(store.dirty).toBe(false); store.reset()
  })
  it('does not restore sensitive content after reset during a request', async () => {
    const store = useBoardStore(); await store.open('board')
    let finish!: (board: Board) => void
    vi.mocked(service.saveBoard).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    store.setTitle('Unsaved'); const pending = store.flush(); store.reset()
    finish({ ...initial, title: 'Unsaved', revision: 2 })
    expect(await pending).toBe(false); expect(store.current).toBeNull(); expect(store.boards).toEqual([])
  })
  it('uses the atomic command with stable operation identity and current revision', async () => {
    const store = useBoardStore(); await store.open('board')
    vi.mocked(service.createBoardTask).mockResolvedValue({ board: { ...initial, revision: 2 }, taskId: 'task' })
    expect(await store.makeTask('element', 'operation', 'Implement', 'Context')).toBe('task')
    expect(service.createBoardTask).toHaveBeenCalledWith('board', 'element', 1, 'operation', 'Implement', 'Context')
    expect(store.current?.revision).toBe(2); store.reset()
  })
  it('preserves newer canvas edits while atomic task creation finishes', async () => {
    const store = useBoardStore(); await store.open('board')
    let finish!: (result: { board: Board; taskId: string }) => void
    vi.mocked(service.createBoardTask).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    const pending = store.makeTask('element', 'operation', 'Implement', null)
    await Promise.resolve()
    store.setTitle('Newer title')
    finish({ board: { ...initial, revision: 2 }, taskId: 'task' })
    expect(await pending).toBe('task')
    expect(store.current?.title).toBe('Newer title'); expect(store.current?.revision).toBe(2)
    expect(store.dirty).toBe(true); store.reset()
  })
  it('does not pause board persistence when referenced tasks fail to load', async () => {
    vi.mocked(service.getBoardTasks).mockRejectedValue(new Error('Tasks unavailable'))
    const store = useBoardStore(); await store.open('board')
    expect(store.error).toBe(''); expect(store.taskLoadError).toBe('Tasks unavailable')
    vi.mocked(service.saveBoard).mockResolvedValue({ ...initial, title: 'Editable', revision: 2 })
    store.setTitle('Editable'); expect(await store.flush()).toBe(true); store.reset()
  })
  it('retains dirty content if explicit reload recovery fails', async () => {
    const store = useBoardStore(); await store.open('board'); store.setTitle('Keep me')
    vi.mocked(service.getBoard).mockRejectedValueOnce(new Error('Disk unavailable'))
    expect(await store.discardAndReload()).toBe(false)
    expect(store.current?.title).toBe('Keep me'); expect(store.dirty).toBe(true); store.reset()
  })
  it('does not expose an old task-create failure after reset', async () => {
    const store = useBoardStore(); await store.open('board')
    let reject!: (error: Error) => void
    vi.mocked(service.createBoardTask).mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
    const pending = store.makeTask('element', 'operation', 'Task', null)
    await Promise.resolve(); store.reset(); reject(new Error('Stale failure'))
    expect(await pending).toBeNull(); expect(store.error).toBe(''); expect(store.current).toBeNull()
  })
})
