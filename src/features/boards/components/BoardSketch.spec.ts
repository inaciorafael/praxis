import { mount } from '@vue/test-utils'
import { nextTick, reactive } from 'vue'
import { describe, expect, it, vi } from 'vitest'
import type { BoardElement } from '@/shared/types/board'
import * as sketch from '../lib/sketch'
import BoardSketch from './BoardSketch.vue'
import BoardStrokeHitArea from './BoardStrokeHitArea.vue'
const base: BoardElement = {
  id: 'shape',
  kind: 'rectangle',
  x: 100,
  y: 80,
  width: 140,
  height: 100,
  text: '',
  color: 'neutral',
  strokeStyle: 'pencil',
  resolved: false,
  points: [],
  startId: null,
  endId: null,
  taskId: null,
  imageData: null,
}
describe('stable local drawing geometry', () => {
  it('does not regenerate RoughJS for translation, rotation, opacity or label edits; geometry and style still update', async () => {
    const generate = vi.spyOn(sketch, 'sketchPaths')
    const element = reactive({ ...base })
    const wrapper = mount(BoardSketch, {
      props: { element, stroke: '#252a34', fill: '#d8eaff' },
    })
    const paths = wrapper.findAll('path').map((path) => path.attributes('d'))
    const initial = generate.mock.calls.length
    element.x = 500
    element.y = 320
    element.angle = 1
    element.opacity = 0.5
    element.text = 'Updated label'
    await nextTick()
    expect(generate).toHaveBeenCalledTimes(initial)
    expect(wrapper.attributes('transform')).toBe('translate(500 320)')
    expect(wrapper.findAll('path').map((path) => path.attributes('d'))).toEqual(paths)
    element.width = 220
    await nextTick()
    expect(generate.mock.calls.length).toBeGreaterThan(initial)
    expect(wrapper.findAll('path').map((path) => path.attributes('d'))).not.toEqual(paths)
    const resized = generate.mock.calls.length
    element.sketch = {
      strokePattern: 'dashed',
      roughness: 1,
      bowing: 1,
      hachureAngle: 0,
      hachureGap: 8,
    }
    await nextTick()
    expect(generate.mock.calls.length).toBeGreaterThan(resized)
    wrapper.unmount()
    generate.mockRestore()
  })
  it('preserves anchored arrow path output in world coordinates', () => {
    const element = { ...base, kind: 'arrow' as const }
    const endpoints: [{ x: number; y: number }, { x: number; y: number }] = [
      { x: 240, y: 180 },
      { x: 430, y: 260 },
    ]
    const expected = sketch.sketchPaths(element, '#252a34', 'transparent', endpoints)
    const wrapper = mount(BoardSketch, {
      props: { element, endpoints, stroke: '#252a34', fill: 'transparent' },
    })
    expect(wrapper.findAll('path').map((path) => path.attributes('d'))).toEqual(
      expected.map((path) => path.d)
    )
    wrapper.unmount()
  })
  it('keeps local handwriting hit paths stable while changing translation and zoom', async () => {
    const element = reactive({
      ...base,
      kind: 'draw' as const,
      points: [
        { x: 0, y: 0 },
        { x: 20, y: 15 },
        { x: 40, y: 0 },
      ],
    })
    const wrapper = mount(BoardStrokeHitArea, { props: { element, zoom: 1 } })
    const path = wrapper.get('path').attributes('d')
    element.x = 400
    element.y = 250
    await wrapper.setProps({ zoom: 2 })
    expect(wrapper.get('path').attributes('d')).toBe(path)
    expect(wrapper.get('path').attributes('stroke-width')).toBe('6')
    expect(wrapper.attributes('transform')).toBe('translate(400 250)')
    element.points.push({ x: 60, y: 20 })
    await nextTick()
    expect(wrapper.get('path').attributes('d')).toContain('L60 20')
    wrapper.unmount()
  })
})

it('updates only the visibility overlay when zooming and strips it for export', async () => {
 const generate = vi.spyOn(sketch,'sketchPaths')
 const element = {...base,strokeWidth:0.5}
 const wrapper = mount(BoardSketch,{props:{element,stroke:'#202124',fill:'transparent',zoom:0.1}})
 expect(wrapper.find('[data-zoom-ink]').exists()).toBe(true)
 const initial=generate.mock.calls.length
 await wrapper.setProps({zoom:0.05})
 expect(generate.mock.calls.length).toBe(initial)
 const exported=wrapper.element.cloneNode(true) as Element
 exported.querySelectorAll('[data-editor-only]').forEach(node=>node.remove())
 expect(exported.querySelector('[data-zoom-ink]')).toBeNull()
 await wrapper.setProps({zoom:1})
 expect(wrapper.find('[data-zoom-ink]').exists()).toBe(false)
 expect(element.strokeWidth).toBe(0.5)
 wrapper.unmount()
 generate.mockRestore()
})
