import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardPreview } from './preview-model'

const api = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/shared/lib/boards/board-preview.service', () => ({ getBoardPreview: api.get }))
const result = (id: string, revision = 1): BoardPreview => ({
  id,
  revision,
  background: 'plain',
  colorScheme: 'light',
  elements: [],
  bounds: { x: 0, y: 0, width: 1, height: 1 },
})
const tick = async () => {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}
const signal = () => new AbortController().signal

describe('Paper preview loading', () => {
  beforeEach(() => {
    vi.resetModules()
    api.get.mockReset()
  })

  it('limits concurrent native calls to two and skips aborted queued work', async () => {
    const loader = await import('./preview-loader')
    loader.retainPaperPreviews()
    const finish = new Map<string, (preview: BoardPreview) => void>()
    api.get.mockImplementation(
      (id: string) => new Promise((resolve) => finish.set(id, resolve))
    )
    const first = loader.loadPaperPreview('a', 1, signal())
    const second = loader.loadPaperPreview('b', 1, signal())
    const controller = new AbortController()
    const aborted = loader.loadPaperPreview('c', 1, controller.signal)
    const rejected = expect(aborted).rejects.toMatchObject({ name: 'AbortError' })
    const last = loader.loadPaperPreview('d', 1, signal())
    controller.abort()
    expect(api.get.mock.calls.map((call) => call[0])).toEqual(['a', 'b'])
    finish.get('a')!(result('a'))
    await first
    await tick()
    await rejected
    expect(api.get.mock.calls.map((call) => call[0])).toEqual(['a', 'b', 'd'])
    finish.get('b')!(result('b'))
    finish.get('d')!(result('d'))
    await Promise.all([second, last])
    loader.releasePaperPreviews()
  })

  it('does not cache aborted responses or responses from a released library', async () => {
    const loader = await import('./preview-loader')
    loader.retainPaperPreviews()
    let finish!: (value: BoardPreview) => void
    api.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const controller = new AbortController()
    const request = loader.loadPaperPreview('a', 1, controller.signal)
    const rejected = expect(request).rejects.toMatchObject({ name: 'AbortError' })
    controller.abort()
    finish(result('a'))
    await rejected
    await tick()
    api.get.mockResolvedValue(result('a'))
    await loader.loadPaperPreview('a', 1, signal())
    expect(api.get).toHaveBeenCalledTimes(2)
    api.get.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve
        })
    )
    const stale = loader.loadPaperPreview('b', 1, signal())
    const staleRejected = expect(stale).rejects.toMatchObject({ name: 'AbortError' })
    loader.releasePaperPreviews()
    loader.retainPaperPreviews()
    finish(result('b'))
    await staleRejected
    await tick()
    api.get.mockResolvedValue(result('b'))
    await loader.loadPaperPreview('b', 1, signal())
    expect(api.get).toHaveBeenCalledTimes(4)
    loader.releasePaperPreviews()
  })

  it('keys cache by revision, rejects mismatched revisions for caching and frees the last consumer', async () => {
    const loader = await import('./preview-loader')
    loader.retainPaperPreviews()
    loader.retainPaperPreviews()
    api.get.mockResolvedValue(result('a'))
    await loader.loadPaperPreview('a', 1, signal())
    loader.releasePaperPreviews()
    await loader.loadPaperPreview('a', 1, signal())
    expect(api.get).toHaveBeenCalledTimes(1)
    await loader.loadPaperPreview('a', 2, signal())
    await loader.loadPaperPreview('a', 2, signal())
    expect(api.get).toHaveBeenCalledTimes(3)
    api.get.mockResolvedValue(result('a', 2))
    await loader.loadPaperPreview('a', 2, signal())
    await loader.loadPaperPreview('a', 2, signal())
    expect(api.get).toHaveBeenCalledTimes(4)
    loader.releasePaperPreviews()
    loader.retainPaperPreviews()
    await loader.loadPaperPreview('a', 2, signal())
    expect(api.get).toHaveBeenCalledTimes(5)
    loader.releasePaperPreviews()
  })
})
