import { mount } from '@vue/test-utils'
import { nextTick } from 'vue'
import { afterEach, describe, expect, it, vi } from 'vitest'
import PaperPresentationLaser from './PaperPresentationLaser.vue'

function send(
  surface: HTMLElement,
  type: string,
  x: number,
  y: number,
  id = 1,
  button = 0
) {
  const event = new MouseEvent(type, { bubbles: true, clientX: x, clientY: y, button })
  Object.defineProperty(event, 'pointerId', { value: id })
  surface.dispatchEvent(event)
}
function setup() {
  vi.useFakeTimers({
    toFake: ['performance', 'requestAnimationFrame', 'cancelAnimationFrame'],
  })
  const surface = document.createElement('div')
  surface.getBoundingClientRect = () => ({ left: 10, top: 20 }) as DOMRect
  surface.setPointerCapture = vi.fn()
  const wrapper = mount(PaperPresentationLaser, { props: { surface } })
  surface.appendChild(wrapper.element)
  return { surface, wrapper }
}
afterEach(() => vi.useRealTimers())

describe('presentation laser', () => {
  it('shows a hover dot and fades each segment progressively while drawing and after release', async () => {
    const { surface, wrapper } = setup()
    send(surface, 'pointermove', 50, 60)
    await nextTick()
    expect(wrapper.get('[data-laser-head]').attributes('transform')).toBe(
      'translate(40 40)'
    )
    expect(wrapper.findAll('[data-laser-segment]')).toHaveLength(0)
    send(surface, 'pointerdown', 50, 60)
    send(surface, 'pointermove', 80, 90)
    await vi.advanceTimersByTimeAsync(550)
    send(surface, 'pointermove', 120, 90)
    await nextTick()
    const segments = wrapper.findAll('[data-laser-segment]')
    expect(segments).toHaveLength(3)
    expect(Number(segments[0]!.attributes('opacity'))).toBeLessThan(0.5)
    expect(Number(segments[2]!.attributes('opacity'))).toBe(1)
    send(surface, 'pointerup', 130, 90)
    await vi.advanceTimersByTimeAsync(600)
    expect(wrapper.findAll('[data-laser-segment]')).toHaveLength(2)
    await vi.advanceTimersByTimeAsync(600)
    expect(wrapper.findAll('[data-laser-segment]')).toHaveLength(0)
    expect(vi.getTimerCount()).toBe(0)
    wrapper.unmount()
  })
  it('keeps strokes separate, ignores controls and other pointers, and cancels drawing on capture loss', async () => {
    const { surface, wrapper } = setup()
    const controls = document.createElement('nav')
    controls.className = 'paper-presentation-controls'
    surface.appendChild(controls)
    send(controls, 'pointerdown', 40, 40)
    send(surface, 'pointerdown', 40, 40, 1, 2)
    await nextTick()
    expect(wrapper.findAll('[data-laser-segment]')).toHaveLength(0)
    send(surface, 'pointerdown', 40, 40)
    send(surface, 'pointermove', 200, 200, 2)
    send(surface, 'pointermove', 60, 60)
    send(surface, 'lostpointercapture', 60, 60)
    send(surface, 'pointermove', 300, 300)
    send(surface, 'pointerdown', 350, 350)
    await nextTick()
    expect(wrapper.findAll('[data-laser-segment]')).toHaveLength(3)
    expect(
      wrapper.findAll('[data-laser-segment] path.laser-core')[2]!.attributes('d')
    ).toBe('M340,330 L340,330')
    expect(surface.setPointerCapture).toHaveBeenCalledTimes(2)
    window.dispatchEvent(new Event('blur'))
    send(surface, 'pointermove', 400, 400)
    await nextTick()
    expect(wrapper.findAll('[data-laser-segment]')).toHaveLength(3)
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
    send(surface, 'pointerdown', 500, 500)
    expect(surface.setPointerCapture).toHaveBeenCalledTimes(2)
  })
  it('bounds the trail during sustained high frequency input', async () => {
    const { surface, wrapper } = setup()
    send(surface, 'pointerdown', 20, 30)
    for (let x = 21; x < 700; x++) send(surface, 'pointermove', x, 40)
    await nextTick()
    expect(wrapper.findAll('[data-laser-segment]')).toHaveLength(256)
    send(surface, 'pointercancel', 700, 40)
    await nextTick()
    expect(wrapper.find('[data-laser-head]').exists()).toBe(false)
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
