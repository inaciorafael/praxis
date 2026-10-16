import { describe, expect, it } from 'vitest'
import { writingPaths } from './writing'
import type { BoardElement } from '@/shared/types/board'
const element = {
  id: 'writing',
  kind: 'draw',
  drawBrush: 'fountain',
  strokeWidth: 2.4,
  points: [
    { x: 0, y: 0, pressure: 0.2 },
    { x: 12, y: 16, pressure: 0.8 },
    { x: 26, y: 18, pressure: 0.6 },
  ],
} as BoardElement
describe('writing ink', () => {
  it('renders sketch ink as one solid pressure-sensitive outline with no graphite grain or broad nib', () => {
    const ink = { ...element, drawBrush: 'ink' as const }
    const paths = writingPaths(ink, '#202020')
    expect(paths).toHaveLength(1)
    expect(paths[0]).toMatchObject({
      fill: '#202020',
      stroke: 'none',
      opacity: 1,
      strokeWidth: 0,
    })
    expect(paths[0]!.d.endsWith('Z')).toBe(true)
    expect(writingPaths({ ...ink, x: 500, y: -200, opacity: 0.4 }, '#202020')).toEqual(
      paths
    )
    expect(
      writingPaths(
        { ...ink, points: ink.points.map((point) => ({ ...point, pressure: 1 })) },
        '#202020'
      )
    ).not.toEqual(paths)
    expect(writingPaths(element, '#202020')[0]!.d).not.toBe(paths[0]!.d)
  })
  it('uses pressure and nib direction in a closed ink outline', () => {
    const ink = writingPaths(element, '#123456')
    expect(ink[0]).toMatchObject({ fill: '#123456', stroke: 'none' })
    expect(ink[0]!.d.endsWith('Z')).toBe(true)
    expect(ink[0]!.d).not.toContain('NaN')
    expect(
      writingPaths(
        {
          ...element,
          points: element.points.map((point) => ({ ...point, pressure: 1 })),
        },
        '#123456'
      )[0]!.d
    ).not.toBe(ink[0]!.d)
  })
  it('keeps graphite grain deterministic across movement, opacity and repeated renders', () => {
    const graphite = { ...element, drawBrush: 'graphite' as const }
    const paths = writingPaths(graphite, '#444444')
    expect(paths).toHaveLength(4)
    expect(paths.filter((path) => path.dash)).toHaveLength(3)
    expect(
      writingPaths({ ...graphite, x: 300, y: 500, opacity: 0.3 }, '#444444')
    ).toEqual(paths)
    expect(writingPaths(graphite, '#444444')).toEqual(paths)
  })
  it.each(['graphite', 'fountain', 'ink'] as const)(
    'draws a single point and duplicate points safely with %s',
    (drawBrush) => {
      for (const points of [
        [{ x: 1, y: 1 }],
        [
          { x: 1, y: 1 },
          { x: 1, y: 1 },
        ],
      ]) {
        const paths = writingPaths({ ...element, drawBrush, points }, '#123456')
        expect(paths.length).toBeGreaterThan(0)
        expect(
          paths.every((path) => !path.d.includes('NaN') && !path.d.includes('Infinity'))
        ).toBe(true)
      }
    }
  )
  it('keeps the pencil finer and lighter than graphite', () => {
    const pencil = writingPaths({ ...element, drawBrush: undefined }, '#333', true)
    const graphite = writingPaths({ ...element, drawBrush: 'graphite' }, '#333')
    expect(pencil[1]!.strokeWidth).toBeLessThan(graphite[1]!.strokeWidth)
    expect(pencil[1]!.opacity).toBeLessThan(graphite[1]!.opacity)
  })
  it('varies graphite deposition with pressure and uses irregular grain rather than an even dash pattern', () => {
    const graphite = { ...element, drawBrush: 'graphite' as const }
    const soft = writingPaths(
      {
        ...graphite,
        points: element.points.map((point) => ({ ...point, pressure: 0.2 })),
      },
      '#333333'
    )
    const firm = writingPaths(
      {
        ...graphite,
        points: element.points.map((point) => ({ ...point, pressure: 0.9 })),
      },
      '#333333'
    )
    expect(soft[0]!.d).not.toBe(firm[0]!.d)
    expect(soft[0]!.fill).toBe('#333333')
    const spacing = soft[1]!.dash!.split(' ').map(Number)
    expect(spacing).toHaveLength(10)
    expect(new Set(spacing.filter((_, index) => index % 2 === 1)).size).toBeGreaterThan(1)
    expect(writingPaths({ ...graphite, id: 'other-stroke' }, '#333333')).not.toEqual(
      writingPaths(graphite, '#333333')
    )
  })
})
