import { describe, expect, it } from 'vitest'
import { connectorRoute, connectorLabel } from './connector-path'
import { connectorPoints, bounds } from './geometry'
import { sketchPaths } from './sketch'
import type { BoardElement, BoardConnectorStyle } from '@/shared/types/board'

const arrow: BoardElement = {
  id: 'arrow',
  kind: 'arrow',
  x: 0,
  y: 0,
  width: 300,
  height: 160,
  text: '',
  color: 'neutral',
  resolved: false,
  points: [],
  startId: null,
  endId: null,
  taskId: null,
  imageData: null,
}
describe('connector routes', () => {
  it.each(['straight', 'elbow', 'curve'] as BoardConnectorStyle[])(
    'keeps endpoints and finite geometry in every direction: %s',
    (style) => {
      for (const b of [
        { x: 300, y: 160 },
        { x: -300, y: 160 },
        { x: 10, y: -300 },
        { x: 0, y: 0 },
      ]) {
        const a = { x: 0, y: 0 },
          route = connectorRoute([a, b], style)
        expect(route.points[0]).toEqual(a)
        expect(route.points[route.points.length - 1]).toEqual(b)
        expect(route.d).not.toMatch(/NaN|Infinity/)
        if (style === 'elbow')
          for (let i = 1; i < route.points.length; i++) {
            const p = route.points[i - 1]!,
              q = route.points[i]!
            expect(p.x === q.x || p.y === q.y).toBe(true)
          }
      }
    }
  )
  it('anchors orthogonal routes exactly on shape edges and follows movement', () => {
    const a = {
      ...arrow,
      id: 'a',
      kind: 'rectangle' as const,
      x: 0,
      y: 0,
      width: 100,
      height: 80,
    }
    const b = { ...a, id: 'b', x: 300, y: 160 }
    const link = { ...arrow, connectorStyle: 'elbow' as const, startId: 'a', endId: 'b' }
    expect(Array.from(connectorPoints(link, [a, b]))).toEqual([
      { x: 100, y: 40 },
      { x: 300, y: 200 },
    ])
    b.x = 450
    expect(connectorPoints(link, [a, b])[1]).toEqual({ x: 450, y: 200 })
  })
  it('keeps the port orientation even when shape sizes change the dominant endpoint distance', () => {
    const a = {
      ...arrow,
      id: 'a',
      kind: 'rectangle' as const,
      x: 0,
      y: 0,
      width: 200,
      height: 20,
    }
    const b = { ...a, id: 'b', x: 300, y: 250 }
    const link = { ...arrow, connectorStyle: 'elbow' as const, startId: 'a', endId: 'b' }
    const endpoints = connectorPoints(link, [a, b])
    const route = connectorRoute(endpoints, 'elbow')
    expect(route.points[1]!.y).toBe(endpoints[0].y)
    expect(route.points[route.points.length - 2]!.y).toBe(endpoints[1].y)
  })
  it('renders a cubic and a full-size head with the same exact endpoint', () => {
    const paths = sketchPaths(
      { ...arrow, connectorStyle: 'curve', strokeStyle: 'clean' },
      '#000',
      'none'
    )
    expect(paths[0]!.d).toContain('C150 0 150 160 300 160')
    expect(paths[1]!.d).toContain('L300 160')
    expect(paths[1]!.d).not.toContain('NaN')
  })
  it('includes readable label bounds in fit and export', () => {
    const e = { ...arrow, width: 10, height: 0, text: 'A connection label' }
    const box = bounds([e])
    expect(box.width).toBeGreaterThan(100)
    expect(box.y).toBe(-14)
    expect(connectorLabel(' yes\n  please ', { x: 0, y: 0 }).text).toBe('yes please')
  })
})
