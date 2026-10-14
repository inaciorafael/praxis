import { beforeEach, describe, expect, it, vi } from 'vitest'
const { flush, reset } = vi.hoisted(() => ({ flush: vi.fn(), reset: vi.fn() }))
vi.mock('@/stores/board.store', () => ({ useBoardStore: () => ({ flush, reset }) }))
import { clearBoardMemory, prepareBoardExit } from './board-lifecycle.service'

describe('board lifecycle', () => {
  beforeEach(() => { vi.restoreAllMocks(); flush.mockReset(); reset.mockReset() })
  it('saves before exit without discarding the working state', async () => {
    flush.mockResolvedValue(true)
    const confirm = vi.spyOn(window, 'confirm')
    expect(await prepareBoardExit()).toBe(true)
    expect(confirm).not.toHaveBeenCalled()
    expect(reset).not.toHaveBeenCalled()
  })
  it('keeps the app open if saving fails and the user cancels discard', async () => {
    flush.mockResolvedValue(false)
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    expect(await prepareBoardExit()).toBe(false)
    expect(reset).not.toHaveBeenCalled()
  })
  it('allows explicit discard without clearing memory before the action succeeds', async () => {
    flush.mockResolvedValue(false)
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    expect(await prepareBoardExit()).toBe(true)
    expect(reset).not.toHaveBeenCalled()
    await clearBoardMemory()
    expect(reset).toHaveBeenCalledOnce()
  })
})
