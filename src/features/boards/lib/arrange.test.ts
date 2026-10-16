import { describe, expect, it } from 'vitest'
import type { BoardElement } from '@/shared/types/board'
import { arrangeElements, type Arrangement } from './arrange'
import { bounds, connectorPoints } from './geometry'

function shape(id: string, values: Partial<BoardElement> = {}): BoardElement {
  return {
    id,
    kind: 'rectangle',
    x: 0,
    y: 0,
    width: 100,
    height: 50,
    text: '',
    color: 'neutral',
    resolved: false,
    points: [],
    startId: null,
    endId: null,
    taskId: null,
    imageData: null,
    ...values,
  }
}

describe('selection arrangement', () => {
  it.each<Arrangement>(['left', 'center', 'right', 'top', 'middle', 'bottom'])(
    'aligns %s using rotated visual bounds without resizing',
    (action) => {
      const scene = [
        shape('a', { angle: Math.PI / 2 }),
        shape('b', { x: 250, y: 130, angle: Math.PI / 4 }),
      ]
      const original = scene.map((item) => ({
        width: item.width,
        height: item.height,
        angle: item.angle,
      }))
      const before = bounds(scene)
      arrangeElements(scene, ['a', 'b'], action)
      for (const [index, item] of scene.entries()) {
        const box = bounds([item])
        if (action === 'left') expect(box.x).toBeCloseTo(before.x)
        if (action === 'center')
          expect(box.x + box.width / 2).toBeCloseTo(before.x + before.width / 2)
        if (action === 'right')
          expect(box.x + box.width).toBeCloseTo(before.x + before.width)
        if (action === 'top') expect(box.y).toBeCloseTo(before.y)
        if (action === 'middle')
          expect(box.y + box.height / 2).toBeCloseTo(before.y + before.height / 2)
        if (action === 'bottom')
          expect(box.y + box.height).toBeCloseTo(before.y + before.height)
        expect({ width: item.width, height: item.height, angle: item.angle }).toEqual(
          original[index]
        )
      }
    }
  )

  it.each(['horizontal', 'vertical'] as const)(
    'distributes unequal sizes %s with equal gaps and fixed outer objects',
    (action) => {
      const horizontal = action === 'horizontal'
      const axis = horizontal ? 'x' : 'y'
      const size = horizontal ? 'width' : 'height'
      const scene = [
        shape('first', { [axis]: 10, [size]: 40 }),
        shape('middle', { [axis]: 110, [size]: 80 }),
        shape('last', { [axis]: 400, [size]: 30 }),
      ]
      const first = { ...scene[0]! }
      const last = { ...scene[2]! }
      arrangeElements(scene, ['last', 'first', 'middle'], action)
      expect(scene[0]).toEqual(first)
      expect(scene[2]).toEqual(last)
      expect(scene[1]![axis] - (scene[0]![axis] + scene[0]![size])).toBeCloseTo(
        scene[2]![axis] - (scene[1]![axis] + scene[1]![size])
      )
      expect(scene[1]![horizontal ? 'y' : 'x']).toBe(0)
    }
  )

  it('keeps connector geometry intact while linked endpoints follow moved shapes', () => {
    const a = shape('a')
    const b = shape('b', { x: 300, y: 120 })
    const arrow = shape('arrow', {
      kind: 'arrow',
      x: 20,
      y: 10,
      width: 450,
      height: 150,
      startId: 'a',
      endId: 'b',
    })
    const untouched = shape('unselected', { x: 900 })
    const scene = [a, b, arrow, untouched]
    const storedArrow = { ...arrow }
    const oldEndpoints = connectorPoints(arrow, scene)
    arrangeElements(scene, ['a', 'b', 'arrow'], 'left')
    expect(arrow).toEqual(storedArrow)
    expect(untouched.x).toBe(900)
    const endpoints = connectorPoints(arrow, scene)
    expect(endpoints).not.toEqual(oldEndpoints)
    expect(endpoints[0]).toEqual({ x: 50, y: 50 })
    expect(endpoints[1]).toEqual({ x: 50, y: 120 })
  })

  it.each(['horizontal', 'vertical'] as const)(
    'does not distribute fewer than three eligible shapes %s',
    (action) => {
      const scene = [
        shape('a'),
        shape('b', { x: 200 }),
        shape('arrow', { kind: 'arrow' }),
      ]
      const before = structuredClone(scene)
      arrangeElements(
        scene,
        scene.map((item) => item.id),
        action
      )
      expect(scene).toEqual(before)
    }
  )
})
