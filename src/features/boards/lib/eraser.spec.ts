import { describe, expect, it } from 'vitest'
import type { BoardElement } from '@/shared/types/board'
import { eraseStrokes } from './eraser'

const stroke = (patch: Partial<BoardElement> = {}): BoardElement => ({
  id: 'stroke',
  kind: 'draw',
  x: 0,
  y: 0,
  width: 100,
  height: 1,
  points: [
    { x: 0, y: 0, pressure: 0.2 },
    { x: 100, y: 0, pressure: 0.8 },
  ],
  text: '',
  color: 'neutral',
  resolved: false,
  startId: null,
  endId: null,
  taskId: null,
  imageData: null,
  strokeWidth: 2,
  strokeStyle: 'pen',
  drawBrush: 'fountain',
  ...patch,
})
describe('Paper eraser', () => {
  it('cuts sparse strokes at exact boundaries and interpolates pressure without changing the source', () => {
    const original = stroke(),
      before = structuredClone(original)
    const erased = eraseStrokes(
      [original],
      { x: 50, y: 0 },
      { x: 50, y: 0 },
      9,
      () => 'fragment'
    )
    expect(erased).toHaveLength(2)
    expect(erased[0]).toMatchObject({
      id: 'stroke',
      x: 0,
      width: 40,
      drawBrush: 'fountain',
    })
    expect(erased[1]).toMatchObject({ id: 'fragment', x: 60, width: 40 })
    expect(erased[0]!.points[1]!.pressure).toBeCloseTo(0.44)
    expect(erased[1]!.points[0]!.pressure).toBeCloseTo(0.56)
    expect(original).toEqual(before)
  })
  it('sweeps between pointer samples, including the middle and rounded ends of a long pass', () => {
    const result = eraseStrokes([stroke()], { x: 50, y: -100 }, { x: 50, y: 100 }, 9)
    expect(result).toHaveLength(2)
    expect(result[0]!.width).toBeCloseTo(40)
    expect(result[1]!.x).toBeCloseTo(60)
  })
  it('preserves text, shapes and distant strokes and removes a completely covered stroke', () => {
    const shape = stroke({ kind: 'rectangle' }),
      text = stroke({ kind: 'text' }),
      far = stroke({ x: 1000 })
    expect(
      eraseStrokes([shape, text, far], { x: 50, y: 0 }, { x: 50, y: 0 }, 10)
    ).toEqual([shape, text, far])
    expect(eraseStrokes([stroke()], { x: 0, y: 0 }, { x: 100, y: 0 }, 10)).toEqual([])
  })
  it('erases rotated strokes in world coordinates and handles single-point marks', () => {
    const result = eraseStrokes(
      [stroke({ angle: Math.PI / 2 })],
      { x: 50.5, y: 0.5 },
      { x: 50.5, y: 0.5 },
      9
    )
    expect(result).toHaveLength(2)
    expect(result.every((element) => element.angle === 0)).toBe(true)
    const dot = stroke({ points: [{ x: 0, y: 0 }] })
    expect(eraseStrokes([dot], { x: 0, y: 0 }, { x: 0, y: 0 }, 10)).toEqual([])
  })
})
