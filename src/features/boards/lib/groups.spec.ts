import { describe, expect, it } from 'vitest'
import type { BoardElement } from '@/shared/types/board'
import { expandGroups, groupBox, transformGroup } from './groups'
const item = (
  id: string,
  x: number,
  patch: Partial<BoardElement> = {}
): BoardElement => ({
  id,
  x,
  y: 0,
  width: 100,
  height: 100,
  groupId: 'group',
  kind: 'rectangle',
  text: '',
  color: 'neutral',
  resolved: false,
  points: [],
  startId: null,
  endId: null,
  taskId: null,
  imageData: null,
  ...patch,
})
describe('Paper groups', () => {
  it('expands only groups touched by selection and creates one group bounding box', () => {
    const elements = [item('a', 0), item('b', 200), item('c', 400, { groupId: 'other' })]
    expect(expandGroups(elements, ['b'])).toEqual(['a', 'b'])
    expect(groupBox(elements, ['a', 'b'])).toMatchObject({
      x: 0,
      y: 0,
      width: 300,
      height: 100,
      angle: 0,
    })
    expect(groupBox(elements, ['a', 'c'])).toBeUndefined()
  })
  it('scales geometry, rotated handwriting, pressure, fonts and connectors together without mutation', () => {
    const elements = [
      item('a', 0),
      item('b', 200, {
        kind: 'draw',
        angle: Math.PI / 4,
        points: [{ x: 10, y: 10, pressure: 0.5 }],
      }),
      item('text', 0, { kind: 'text', text: 'Idea' }),
      item('line', 0, { kind: 'line', width: 300, height: 0 }),
    ]
    const before = structuredClone(elements)
    const resized = transformGroup(
      elements,
      elements.map((e) => e.id),
      { x: 0, y: 0, width: 300, height: 100 },
      { x: 10, y: 20, width: 600, height: 200 }
    )
    expect(resized[1]).toMatchObject({
      x: 410,
      y: 20,
      width: 200,
      points: [{ x: 20, y: 20, pressure: 0.5 }],
    })
    expect(resized[1]!.angle).toBeCloseTo(Math.PI / 4)
    expect(resized[2]!.richText!.paragraphs[0]!.runs[0]!.fontSize).toBe(28)
    expect(resized[3]).toMatchObject({ x: 10, y: 20, width: 600, height: 0 })
    expect(elements).toEqual(before)
  })
  it('rotates member centers and connector endpoints about the group center', () => {
    const elements = [item('a', 0), item('b', 200)]
    const box = groupBox(elements, ['a', 'b'])!
    const rotated = transformGroup(elements, ['a', 'b'], box, box, Math.PI / 2)
    expect(rotated[0]!.x).toBeCloseTo(100)
    expect(rotated[0]!.y).toBeCloseTo(-100)
    expect(rotated[1]!.y).toBeCloseTo(100)
    expect(rotated[0]!.angle).toBeCloseTo(Math.PI / 2)
  })
})
