import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPaperFocusSession } from './paper-focus.service'

const { native, isFullscreen, setFullscreen } = vi.hoisted(() => ({
  native: vi.fn(), isFullscreen: vi.fn(), setFullscreen: vi.fn(),
}))
vi.mock('@tauri-apps/api/core', () => ({ isTauri: native }))
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({ isFullscreen, setFullscreen }),
}))

beforeEach(() => {
  vi.resetAllMocks()
  native.mockReturnValue(true)
  isFullscreen.mockResolvedValue(false)
  setFullscreen.mockResolvedValue(undefined)
})

describe('Paper focus fullscreen ownership', () => {
  it('enters once and restores the window on leaving', async () => {
    const session = createPaperFocusSession()
    await session.enter(); await session.enter(); await session.leave(); await session.leave()
    expect(isFullscreen).toHaveBeenCalledOnce()
    expect(setFullscreen.mock.calls).toEqual([[true], [false]])
  })
  it('preserves fullscreen that existed before entering focus', async () => {
    isFullscreen.mockResolvedValue(true)
    const session = createPaperFocusSession()
    await session.enter(); await session.leave()
    expect(setFullscreen).not.toHaveBeenCalled()
  })
  it('serializes leaving while entering fullscreen is pending', async () => {
    let finish!: () => void
    setFullscreen.mockImplementationOnce(() => new Promise<void>(resolve => { finish = resolve }))
    const session = createPaperFocusSession()
    const entering = session.enter()
    await vi.waitFor(() => expect(setFullscreen).toHaveBeenCalledWith(true))
    const leaving = session.leave()
    expect(setFullscreen).toHaveBeenCalledOnce()
    finish()
    await Promise.all([entering, leaving])
    expect(setFullscreen.mock.calls).toEqual([[true], [false]])
  })
  it('allows retrying a failed enter', async () => {
    setFullscreen.mockRejectedValueOnce(new Error('enter failed'))
    const session = createPaperFocusSession()
    await expect(session.enter()).rejects.toThrow('enter failed')
    await session.enter(); await session.leave()
    expect(setFullscreen.mock.calls).toEqual([[true], [true], [false]])
  })
  it('keeps restore ownership after a failed leave so it can retry', async () => {
    const session = createPaperFocusSession()
    await session.enter()
    setFullscreen.mockRejectedValueOnce(new Error('restore failed'))
    await expect(session.leave()).rejects.toThrow('restore failed')
    await session.leave()
    expect(setFullscreen.mock.calls).toEqual([[true], [false], [false]])
  })
  it('does not call native APIs in browser previews', async () => {
    native.mockReturnValue(false)
    const session = createPaperFocusSession()
    await session.enter(); await session.leave()
    expect(isFullscreen).not.toHaveBeenCalled()
    expect(setFullscreen).not.toHaveBeenCalled()
  })
})
