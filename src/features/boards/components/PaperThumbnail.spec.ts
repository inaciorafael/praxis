import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardElement, BoardSummary } from '@/shared/types/board'
import type { BoardPreview } from '../lib/preview-model'
import PaperThumbnail from './PaperThumbnail.vue'

const api = vi.hoisted(() => ({
  load: vi.fn(),
  retain: vi.fn(),
  release: vi.fn(),
  full: vi.fn(),
}))
vi.mock('../lib/preview-loader', () => ({
  loadPaperPreview: api.load,
  retainPaperPreviews: api.retain,
  releasePaperPreviews: api.release,
}))
vi.mock('@/shared/lib/boards/board.service', () => ({ getBoard: api.full }))
vi.mock('../lib/font', () => ({ loadBoardFont: () => Promise.resolve() }))
const paper: BoardSummary = {
  id: 'paper',
  title: 'Ideas',
  revision: 1,
  formatVersion: 1,
  createdAt: '',
  updatedAt: '',
  elementCount: 5,
  background: 'grid',
  colorScheme: 'light',
}
const element = (kind: BoardElement['kind'], id: string = kind): BoardElement => ({
  id,
  kind,
  x: 10,
  y: 20,
  width: 100,
  height: 60,
  text: kind === 'text' ? 'An idea' : '',
  color: 'neutral',
  resolved: false,
  points: [],
  startId: null,
  endId: null,
  taskId: null,
  imageData: null,
})
const preview = (elements: BoardElement[] = [element('text')]): BoardPreview => ({
  id: 'paper',
  revision: 1,
  background: 'grid',
  colorScheme: 'light',
  elements,
  bounds: { x: 0, y: 0, width: 200, height: 100 },
})
let show!: (visible: boolean) => void
let disconnect: ReturnType<typeof vi.fn>
const wrappers: { unmount(): void }[] = []
function create(overrides: Partial<BoardSummary> = {}) {
  const wrapper = mount(PaperThumbnail, {
    props: { paper: { ...paper, ...overrides } },
    global: {
      stubs: {
        BoardSketch: true,
        BoardArtisticBrush: true,
        BoardRichLabel: true,
        BoardLabel: true,
      },
    },
  })
  wrappers.push(wrapper)
  return wrapper
}
describe('Paper library thumbnail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.load.mockResolvedValue(preview())
    disconnect = vi.fn()
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: IntersectionObserverCallback) {
          show = (visible) =>
            callback(
              [{ isIntersecting: visible } as IntersectionObserverEntry],
              this as unknown as IntersectionObserver
            )
        }
        observe() {}
        disconnect = disconnect
      }
    )
  })
  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
    vi.unstubAllGlobals()
  })

  it('loads only near the viewport and renders text, shapes, strokes and image content', async () => {
    api.load.mockResolvedValue(
      preview([
        element('text'),
        element('rectangle'),
        {
          ...element('draw'),
          drawBrush: 'ink',
          points: [
            { x: 0, y: 0 },
            { x: 100, y: 60 },
          ],
        },
        { ...element('image'), imageData: 'data:image/png;base64,abc' },
        element('image', 'placeholder'),
      ])
    )
    const wrapper = create()
    expect(api.load).not.toHaveBeenCalled()
    expect(wrapper.find('.paper-thumbnail-placeholder').exists()).toBe(true)
    show(true)
    await flushPromises()
    expect(api.load).toHaveBeenCalledWith('paper', 1, expect.any(AbortSignal))
    expect(wrapper.findAll('[data-preview-element]')).toHaveLength(5)
    expect(wrapper.find('board-label-stub').attributes('label')).toBe('An idea')
    expect(wrapper.find('board-sketch-stub').exists()).toBe(true)
    expect(wrapper.find('board-artistic-brush-stub').exists()).toBe(true)
    expect(wrapper.get('image').attributes('href')).toBe('data:image/png;base64,abc')
    expect(wrapper.find('[data-preview-element="placeholder"] rect').exists()).toBe(true)
    expect(api.full).not.toHaveBeenCalled()
  })

  it('keeps background and placeholder on authorization errors and skips empty papers', async () => {
    api.load.mockRejectedValue(new Error('Abra um arquivo .praxis antes de continuar.'))
    const wrapper = create({ colorScheme: 'dark' })
    show(true)
    await flushPromises()
    expect(wrapper.find('.paper-thumbnail-placeholder').exists()).toBe(true)
    expect(wrapper.attributes('data-background')).toBe('grid')
    expect(wrapper.attributes('style')).toContain('background-color: rgb(32, 36, 44)')
    wrapper.unmount()
    const empty = create({ elementCount: 0 })
    show(true)
    await flushPromises()
    expect(api.load).toHaveBeenCalledTimes(1)
    expect(empty.find('.paper-thumbnail-content').exists()).toBe(false)
    expect(api.full).not.toHaveBeenCalled()
  })

  it('discards stale content on revision changes and aborts on leaving or unmounting', async () => {
    const finish: ((value: BoardPreview) => void)[] = []
    api.load.mockImplementation(() => new Promise((resolve) => finish.push(resolve)))
    const wrapper = create()
    show(true)
    await flushPromises()
    const oldSignal = api.load.mock.calls[0]![2] as AbortSignal
    await wrapper.setProps({ paper: { ...paper, revision: 2 } })
    expect(oldSignal.aborted).toBe(true)
    finish[0]!(preview())
    await flushPromises()
    expect(wrapper.find('.paper-thumbnail-content').exists()).toBe(false)
    finish[1]!({ ...preview(), revision: 2 })
    await flushPromises()
    expect(wrapper.find('.paper-thumbnail-content').exists()).toBe(true)
    show(false)
    await flushPromises()
    expect(wrapper.find('.paper-thumbnail-content').exists()).toBe(false)
    show(true)
    await flushPromises()
    const currentSignal = api.load.mock.calls.slice(-1)[0]![2] as AbortSignal
    wrapper.unmount()
    expect(currentSignal.aborted).toBe(true)
    expect(disconnect).toHaveBeenCalled()
    expect(api.release).toHaveBeenCalledTimes(1)
    finish.slice(-1)[0]!(preview())
    await flushPromises()
  })
})
