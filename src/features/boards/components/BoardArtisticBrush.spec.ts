import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardElement } from '@/shared/types/board'
import type { BrushRaster } from '../lib/artistic-brush'
import BoardArtisticBrush from './BoardArtisticBrush.vue'

const helper = vi.hoisted(() => ({ cached: vi.fn(), render: vi.fn() }))
vi.mock('../lib/artistic-brush', () => ({
  artisticBrushKey: (element: BoardElement, stroke: string) =>
    JSON.stringify([element.drawBrush, element.points, stroke]),
  cachedArtisticBrush: helper.cached,
  renderArtisticBrush: helper.render,
}))
const element: BoardElement = {
  id: 'ink',
  kind: 'draw',
  x: 20,
  y: 30,
  width: 100,
  height: 50,
  text: '',
  color: 'neutral',
  resolved: false,
  points: [
    { x: 0, y: 0 },
    { x: 100, y: 50 },
  ],
  startId: null,
  endId: null,
  taskId: null,
  imageData: null,
  drawBrush: 'charcoal',
}
const raster: BrushRaster = {
  href: 'data:image/png;base64,test',
  x: -8,
  y: -8,
  width: 116,
  height: 66,
  elapsed: 12,
}
function deferred() {
  let resolve!: (value: BrushRaster | null) => void
  const promise = new Promise<BrushRaster | null>((done) => {
    resolve = done
  })
  return { promise, resolve }
}
function render(props = {}) {
  return mount(BoardArtisticBrush, {
    props: { element, stroke: '#123456', ...props },
    global: { stubs: { BoardSketch: { template: '<path data-vector-preview />' } } },
  })
}
beforeEach(() => {
  helper.cached.mockReset()
  helper.render.mockReset()
  helper.render.mockResolvedValue(raster)
})
describe('BoardArtisticBrush', () => {
  it.each(['graphite', 'fountain', 'ink'] as const)(
    'renders %s ink during the gesture with exactly the same paths after release',
    async (drawBrush) => {
      const wrapper = render({ element: { ...element, drawBrush }, preview: true })
      const initial = wrapper
        .findAll('[data-writing-ink]')
        .map((path) => path.attributes('d'))
      expect(initial.length).toBeGreaterThan(0)
      expect(helper.render).not.toHaveBeenCalled()
      await wrapper.setProps({
        element: {
          ...element,
          drawBrush,
          points: [...element.points, { x: 130, y: 60, pressure: 0.8 }],
        },
      })
      const drawing = wrapper
        .findAll('[data-writing-ink]')
        .map((path) => path.attributes('d'))
      expect(drawing).not.toEqual(initial)
      await wrapper.setProps({ preview: false })
      expect(
        wrapper.findAll('[data-writing-ink]').map((path) => path.attributes('d'))
      ).toEqual(drawing)
      expect(helper.render).not.toHaveBeenCalled()
      expect(wrapper.find('image').exists()).toBe(false)
      wrapper.unmount()
    }
  )
  it('uses the lightweight vector preview while a gesture is active', async () => {
    const wrapper = render({ preview: true })
    await flushPromises()
    expect(helper.render).not.toHaveBeenCalled()
    expect(wrapper.find('[data-vector-preview]').exists()).toBe(true)
    expect(wrapper.find('image').exists()).toBe(false)
    await wrapper.setProps({ preview: false })
    await flushPromises()
    expect(helper.render).toHaveBeenCalledTimes(1)
    expect(wrapper.get('image').attributes('href')).toBe(raster.href)
  })
  it('uses cached ink and suppresses a raster when the stroke becomes invisible', async () => {
    helper.cached.mockReturnValue(raster)
    const wrapper = render()
    expect(wrapper.find('image').exists()).toBe(true)
    expect(helper.render).not.toHaveBeenCalled()
    await wrapper.setProps({ visible: false })
    expect(wrapper.find('image').exists()).toBe(false)
    expect(helper.render).not.toHaveBeenCalled()
  })
  it('does not restore a stale raster after changing materials', async () => {
    const first = deferred(),
      second = deferred()
    helper.render.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    const wrapper = render()
    await wrapper.setProps({ element: { ...element, drawBrush: 'marker' } })
    first.resolve(raster)
    await flushPromises()
    expect(wrapper.find('image').exists()).toBe(false)
    second.resolve({ ...raster, href: 'data:image/png;base64,new' })
    await flushPromises()
    expect(wrapper.get('image').attributes('href')).toBe('data:image/png;base64,new')
  })
  it('ignores late rendering or fallback results after unmount', async () => {
    const pending = deferred()
    helper.render.mockReturnValue(pending.promise)
    const wrapper = render()
    wrapper.unmount()
    pending.resolve(null)
    await flushPromises()
    expect(wrapper.emitted('fallback')).toBeUndefined()
  })
  it('keeps vector ink visible and emits fallback when rendering fails', async () => {
    helper.render.mockResolvedValue(null)
    const wrapper = render()
    await flushPromises()
    expect(wrapper.emitted('fallback')).toEqual([[]])
    expect(wrapper.find('image').exists()).toBe(false)
    expect(wrapper.find('[data-vector-preview]').exists()).toBe(true)
  })
})
