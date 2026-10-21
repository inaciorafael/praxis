import { mount } from '@vue/test-utils'
import { writeFileSync } from 'node:fs'
import { nextTick } from 'vue'
import { createI18n } from 'vue-i18n'
import { describe, it, vi } from 'vitest'
import BoardCanvas from '../../src/features/boards/components/BoardCanvas.vue'
import type { BoardElement } from '../../src/shared/types/board'
import * as sketch from '../../src/features/boards/lib/sketch'
import * as text from '../../src/features/boards/lib/rich-text'
import {
  createSnapshotHistory,
  copyElements,
  elementSnapshotBytes,
} from '../../src/features/boards/model/history'

vi.mock('../../src/shared/lib/boards/board-export.service', () => ({
  saveBoardPng: vi.fn(),
}))
function scene(): BoardElement[] {
  const base: BoardElement = {
    id: '',
    kind: 'rectangle',
    x: 0,
    y: 0,
    width: 160,
    height: 90,
    text: '',
    color: 'neutral',
    strokeStyle: 'pencil',
    fillColor: '#d8eaff',
    resolved: false,
    points: [],
    startId: null,
    endId: null,
    taskId: null,
    imageData: null,
  }
  const shapes = Array.from({ length: 60 }, (_, i) => ({
    ...base,
    id: `shape-${i}`,
    x: (i % 10) * 200,
    y: Math.floor(i / 10) * 140,
  }))
  const strokes = Array.from({ length: 70 }, (_, i) => ({
    ...base,
    id: `stroke-${i}`,
    kind: 'draw' as const,
    x: (i % 10) * 200,
    y: 1000 + Math.floor(i / 10) * 80,
    width: 150,
    height: 25,
    points: Array.from({ length: 150 }, (_, j) => ({
      x: j,
      y: Math.sin(j / 8) * 10 + 12,
      pressure: 0.5,
    })),
  }))
  const labels = Array.from({ length: 40 }, (_, i) => {
    const element = {
      ...base,
      id: `text-${i}`,
      kind: 'text' as const,
      x: (i % 10) * 200,
      y: 1800 + Math.floor(i / 10) * 100,
      text: `Idea ${i}: visual thinking`,
      textBackground: 'none' as const,
    }
    return { ...element, richText: text.plainToRich(element.text, element) }
  })
  const arrows = Array.from({ length: 30 }, (_, i) => ({
    ...base,
    id: `arrow-${i}`,
    kind: 'arrow' as const,
    startId: `shape-${i}`,
    endId: `shape-${i + 1}`,
    fillColor: undefined,
  }))
  return [...shapes, ...strokes, ...labels, ...arrows]
}
async function pointer(element: Element, type: string, x: number, y: number) {
  const event = new MouseEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y })
  Object.defineProperty(event, 'pointerId', { value: 1 })
  element.dispatchEvent(event)
  await nextTick()
}
describe.skipIf(import.meta.env.VITE_PAPER_PERF !== '1')(
  'Paper CPU benchmark (synthetic, no user data)',
  () => {
    it('records drag, pan and history costs without timing assertions', async () => {
      const shapeSpy = vi.spyOn(sketch, 'sketchPaths')
      const textSpy = vi.spyOn(text, 'layoutRichText')
      const elements = scene()
      const wrapper = mount(BoardCanvas, {
        props: { elements },
        global: {
          plugins: [
            createI18n({
              legacy: false,
              locale: 'en',
              missingWarn: false,
              fallbackWarn: false,
              messages: { en: {} },
            }),
          ],
        },
      })
      await nextTick()
      const viewport = wrapper.get('.board-viewport')
      await viewport.trigger('keydown', { key: 'v' })
      await pointer(
        wrapper.get('[data-element-id="shape-0"]').element,
        'pointerdown',
        100,
        100
      )
      shapeSpy.mockClear()
      textSpy.mockClear()
      const start = performance.now()
      for (let i = 1; i <= 8; i++)
        await pointer(viewport.element, 'pointermove', 100 + i * 4, 100 + i * 2)
      const dragMs = performance.now() - start
      const dragSketchCalls = shapeSpy.mock.calls.length,
        dragTextCalls = textSpy.mock.calls.length
      await pointer(viewport.element, 'pointerup', 132, 116)
      await viewport.trigger('keydown', { key: 'h' })
      await pointer(viewport.element, 'pointerdown', 100, 100)
      shapeSpy.mockClear()
      textSpy.mockClear()
      const panStart = performance.now()
      for (let i = 1; i <= 8; i++)
        await pointer(viewport.element, 'pointermove', 100 + i * 4, 100 + i * 2)
      const panMs = performance.now() - panStart
      const panSketchCalls = shapeSpy.mock.calls.length
      await pointer(viewport.element, 'pointerup', 132, 116)
      wrapper.unmount()
      shapeSpy.mockRestore()
      textSpy.mockRestore()
      let byteChecks = 0
      const history = createSnapshotHistory(
        copyElements,
        (snapshot) => {
          byteChecks++
          return elementSnapshotBytes(snapshot)
        },
        100,
        128 * 1024 * 1024
      )
      const historyStart = performance.now()
      for (let i = 0; i < 40; i++) history.push(elements)
      const result = {
        elements: elements.length,
        strokePoints: 10500,
        moves: 8,
        dragMs: Math.round(dragMs),
        dragSketchCalls,
        dragTextCalls,
        panMs: Math.round(panMs),
        panSketchCalls,
        historyMs: Math.round(performance.now() - historyStart),
        historyByteChecks: byteChecks,
      }
      writeFileSync(
        import.meta.env.VITE_PAPER_PERF_LABEL === 'after'
          ? 'tests/perf/paper-after.json'
          : 'tests/perf/paper-before.json',
        JSON.stringify(result, null, 2) + '\n'
      )
    }, 120000)
  }
)
