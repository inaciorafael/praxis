import type { BoardConnectorStyle, BoardPoint } from '@/shared/types/board'

export type ConnectorEndpoints = [BoardPoint, BoardPoint] & {
  axis?: 'horizontal' | 'vertical'
}

export function localConnectorEndpoints(
  endpoints: readonly [BoardPoint, BoardPoint],
  origin: BoardPoint
): ConnectorEndpoints {
  return Object.assign(
    endpoints.map((p) => ({ x: p.x - origin.x, y: p.y - origin.y })) as [
      BoardPoint,
      BoardPoint,
    ],
    {
      axis: (endpoints as ConnectorEndpoints).axis,
    }
  )
}

/** Shared by rendering, hit testing, region selection and export. */
export function connectorRoute(
  endpoints: readonly [BoardPoint, BoardPoint],
  style: BoardConnectorStyle = 'straight'
) {
  const [a, b] = endpoints
  const axis = (endpoints as ConnectorEndpoints).axis
  const horizontal = axis
    ? axis === 'horizontal'
    : Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)
  const middle = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
  const controls = horizontal
    ? [
        { x: middle.x, y: a.y },
        { x: middle.x, y: b.y },
      ]
    : [
        { x: a.x, y: middle.y },
        { x: b.x, y: middle.y },
      ]
  let points: BoardPoint[] = [a, b]
  let d = `M${a.x} ${a.y} L${b.x} ${b.y}`
  if (style === 'elbow') {
    points = [a, ...controls, b].filter(
      (p, i, all) =>
        i === 0 || Math.hypot(p.x - all[i - 1]!.x, p.y - all[i - 1]!.y) > 1e-6
    )
    d = points.map((p, i) => `${i ? 'L' : 'M'}${p.x} ${p.y}`).join(' ')
  } else if (style === 'curve') {
    const [c, e] = controls as [BoardPoint, BoardPoint]
    d = `M${a.x} ${a.y} C${c.x} ${c.y} ${e.x} ${e.y} ${b.x} ${b.y}`
    // Bounded samples for region selection; the rendered curve stays a cubic.
    points = Array.from({ length: 25 }, (_, i) => {
      const t = i / 24,
        u = 1 - t
      return {
        x: u ** 3 * a.x + 3 * u ** 2 * t * c.x + 3 * u * t ** 2 * e.x + t ** 3 * b.x,
        y: u ** 3 * a.y + 3 * u ** 2 * t * c.y + 3 * u * t ** 2 * e.y + t ** 3 * b.y,
      }
    })
  }
  return {
    d,
    points,
    middle,
    tangent:
      style === 'curve' && Math.hypot(b.x - controls[1]!.x, b.y - controls[1]!.y) > 1e-6
        ? controls[1]!
        : points[Math.max(0, points.length - 2)]!,
  }
}

export function connectorLabel(text: string, middle: BoardPoint) {
  const label = text.replace(/\s+/g, ' ').trim().slice(0, 80)
  const width = Math.max(32, [...label].length * 9.6 + 16)
  return { text: label, x: middle.x - width / 2, y: middle.y - 14, width, height: 28 }
}
