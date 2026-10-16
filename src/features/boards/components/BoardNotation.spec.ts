import { mount, flushPromises } from '@vue/test-utils'
import { defineComponent, h, type PropType } from 'vue'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import BoardNotation from './BoardNotation.vue'
import { defaultAnnotation, type AnnotationShape } from '../lib/notation'

const shape = (animate = true): AnnotationShape => ({
  config: {
    ...defaultAnnotation('underline'),
    animate,
    animationDuration: 600,
    animationDelay: 100,
  },
  seed: 'animation-test',
  rects: [{ x: 0, y: 0, width: 100, height: 20 }],
})
let animations: { cancel: ReturnType<typeof vi.fn>; onfinish: (() => void) | null }[]
let animate: ReturnType<typeof vi.fn>
let reducedMotion = false
const mountNotation = (props: {
  shape: AnnotationShape
  groupDelay?: number
  replay?: number
  animateOnReplay?: boolean
  previewOnly?: boolean
}) =>
  mount(
    defineComponent({
      props: {
        shape: { type: Object as PropType<AnnotationShape>, required: true },
        groupDelay: Number,
        replay: Number,
        animateOnReplay: Boolean,
        previewOnly: Boolean,
      },
      setup(componentProps) {
        return () => h('svg', [h(BoardNotation, componentProps)])
      },
    }),
    { props }
  )

beforeEach(() => {
  animations = []
  reducedMotion = false
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({ matches: reducedMotion }))
  )
  Object.defineProperty(SVGElement.prototype, 'getTotalLength', {
    configurable: true,
    value: vi.fn(() => 100),
  })
  animate = vi.fn(() => {
    const animation = { cancel: vi.fn(), onfinish: null }
    animations.push(animation)
    return animation
  })
  Object.defineProperty(SVGElement.prototype, 'animate', {
    configurable: true,
    value: animate,
  })
})
afterEach(() => {
  delete (SVGElement.prototype as Partial<SVGPathElement>).getTotalLength
  delete (SVGElement.prototype as Partial<SVGPathElement>).animate
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('BoardNotation animation lifecycle', () => {
  it('keeps editing previews static until replay and preserves disabled animation settings', async () => {
    const wrapper = mountNotation({ shape: shape(), previewOnly: true, replay: 0 })
    await flushPromises()
    expect(animate).not.toHaveBeenCalled()
    await wrapper.setProps({ replay: 1 })
    await flushPromises()
    expect(animate).toHaveBeenCalled()
    const calls = animate.mock.calls.length
    await wrapper.setProps({ shape: shape(false), replay: 2 })
    await flushPromises()
    expect(animate.mock.calls.length).toBe(calls)
    wrapper.unmount()
  })
  it('orders path animations within the configured duration after group and annotation delays', async () => {
    const wrapper = mountNotation({ shape: shape(), groupDelay: 900 })
    await flushPromises()
    const paths = wrapper.findAll('path')
    expect(paths.length).toBeGreaterThan(0)
    expect(animate).toHaveBeenCalledTimes(paths.length)
    const duration = 600 / paths.length
    animate.mock.calls.forEach((args, index) => {
      expect(args[0]).toEqual([{ strokeDashoffset: '100' }, { strokeDashoffset: '0' }])
      expect(args[1]).toMatchObject({
        duration,
        delay: 1000 + duration * index,
        fill: 'both',
      })
    })
    expect(paths[0].attributes('style')).toContain('stroke-dasharray: 100')
    animations[0].onfinish!()
    expect(paths[0].attributes('style') ?? '').not.toContain('stroke-dasharray')
    expect(animations[0].cancel).toHaveBeenCalledOnce()
    wrapper.unmount()
  })

  it('replays static annotations on demand and cancels earlier animations before replay', async () => {
    const wrapper = mountNotation({
      shape: shape(false),
      replay: 0,
      animateOnReplay: true,
    })
    await flushPromises()
    expect(animate).not.toHaveBeenCalled()
    await wrapper.setProps({ replay: 1 })
    await flushPromises()
    const previous = [...animations]
    expect(previous.length).toBeGreaterThan(0)
    await wrapper.setProps({ replay: 2 })
    await flushPromises()
    previous.forEach((animation) => expect(animation.cancel).toHaveBeenCalledOnce())
    expect(animations.length).toBe(previous.length * 2)
    wrapper.unmount()
  })

  it('respects reduced motion even when replay requests animation', async () => {
    reducedMotion = true
    const wrapper = mountNotation({ shape: shape(), replay: 0, animateOnReplay: true })
    await flushPromises()
    await wrapper.setProps({ replay: 1 })
    await flushPromises()
    expect(animate).not.toHaveBeenCalled()
    expect(wrapper.get('path').attributes('style') ?? '').not.toContain(
      'stroke-dasharray'
    )
    wrapper.unmount()
  })

  it('cancels animations and clears dash styles when unmounted', async () => {
    const wrapper = mountNotation({ shape: shape() })
    await flushPromises()
    const paths = wrapper.findAll('path').map((path) => path.element as SVGPathElement)
    wrapper.unmount()
    animations.forEach((animation) => expect(animation.cancel).toHaveBeenCalledOnce())
    paths.forEach((path) => expect(path.style.strokeDasharray).toBe(''))
  })
})
