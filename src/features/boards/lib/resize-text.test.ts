import { describe, it, expect } from 'vitest'
import type { BoardElement } from '@/shared/types/board'
import { resizeTextElement } from './resize-text'
import { elementCorners, rotatePoint } from './geometry'
import { plainToRich } from './rich-text'
const element = {
  id: 'text',
  kind: 'text',
  x: 20,
  y: 40,
  width: 200,
  height: 100,
  text: 'One Two',
  textFont: 'sans',
  angle: 0.5,
  textAutoWidth: true,
} as BoardElement
function document() {
  const rich = plainToRich('One Two', element)
  rich.paragraphs[0]!.runs = [
    { ...rich.paragraphs[0]!.runs[0]!, text: 'One ', fontSize: 14, bold: true },
    { ...rich.paragraphs[0]!.runs[0]!, text: 'Two', fontSize: 28 },
  ]
  return rich
}
describe('text corner scaling', () => {
  it.each(['nw', 'ne', 'sw', 'se'] as const)(
    'scales mixed fonts from %s while preserving the opposite rotated corner',
    (handle) => {
      const original = { ...element, richText: document() }
      const sx = handle.endsWith('e') ? 1 : -1,
        sy = handle.startsWith('s') ? 1 : -1
      const center = { x: 120, y: 90 }
      const p = rotatePoint(
        { x: center.x + sx * 200, y: center.y + sy * 100 },
        center,
        0.5
      )
      const result = resizeTextElement(original, p, {
        handle,
        proportional: true,
        fromCenter: false,
      })
      const old = elementCorners(original),
        next = elementCorners({ ...original, ...result })
      const opposite = { nw: 2, ne: 3, sw: 1, se: 0 }[handle]
      expect(next[opposite]!.x).toBeCloseTo(old[opposite]!.x)
      expect(next[opposite]!.y).toBeCloseTo(old[opposite]!.y)
      expect(result.richText.paragraphs[0]!.runs.map((run) => run.fontSize)).toEqual([
        21, 42,
      ])
      expect(result.richText.paragraphs[0]!.runs[0]!.bold).toBe(true)
      expect(original.richText).toEqual(document())
    }
  )
  it('keeps its center with Alt and clamps the entire scale to supported font sizes', () => {
    const original = { ...element, richText: document() }
    const result = resizeTextElement(
      original,
      { x: 2000, y: 2000 },
      { handle: 'se', proportional: true, fromCenter: true }
    )
    expect(result.x + result.width / 2).toBeCloseTo(120)
    expect(result.y + result.height / 2).toBeCloseTo(90)
    expect(result.richText.paragraphs[0]!.runs.map((run) => run.fontSize)).toEqual([
      36, 72,
    ])
  })
  it('can shrink legacy text without mutating its saved document', () => {
    const original = { ...element, angle: 0 }
    const result = resizeTextElement(
      original,
      { x: 120, y: 90 },
      { handle: 'se', proportional: true, fromCenter: false }
    )
    expect(result.richText.paragraphs[0]!.runs[0]!.fontSize).toBe(8)
    expect(original.richText).toBeUndefined()
    expect(result.textAutoWidth).toBe(false)
  })
})
