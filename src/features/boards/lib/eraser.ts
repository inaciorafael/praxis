import type { BoardElement, BoardPoint } from '@/shared/types/board'
import { normalizedStroke } from './geometry'

type Interval = [number, number]
const EPSILON = 1e-8
const interpolate = (a: BoardPoint, b: BoardPoint, t: number): BoardPoint => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
  ...(a.pressure !== undefined && b.pressure !== undefined
    ? { pressure: a.pressure + (b.pressure - a.pressure) * t }
    : {}),
})

/** Clip a stroke segment against the exact capsule swept by the eraser.
 * This also catches fast pointer moves and strokes with only two samples. */
function erasedIntervals(
  a: BoardPoint,
  b: BoardPoint,
  start: BoardPoint,
  end: BoardPoint,
  radius: number
): Interval[] {
  const dx = b.x - a.x,
    dy = b.y - a.y
  const intervals: Interval[] = []
  for (const center of [start, end]) {
    const x = a.x - center.x,
      y = a.y - center.y
    const quadratic = dx * dx + dy * dy
    if (quadratic < EPSILON) {
      if (x * x + y * y < radius * radius) intervals.push([0, 1])
      continue
    }
    const linear = 2 * (x * dx + y * dy)
    const discriminant =
      linear * linear - 4 * quadratic * (x * x + y * y - radius * radius)
    if (discriminant <= 0) continue
    const root = Math.sqrt(discriminant)
    const low = Math.max(0, (-linear - root) / (2 * quadratic))
    const high = Math.min(1, (-linear + root) / (2 * quadratic))
    if (high > low) intervals.push([low, high])
  }
  const length = Math.hypot(end.x - start.x, end.y - start.y)
  if (length > EPSILON) {
    const ux = (end.x - start.x) / length,
      uy = (end.y - start.y) / length
    const x = (a.x - start.x) * ux + (a.y - start.y) * uy
    const y = -(a.x - start.x) * uy + (a.y - start.y) * ux
    let low = 0,
      high = 1
    const slabs: [number, number, number, number][] = [
      [x, dx * ux + dy * uy, 0, length],
      [y, -dx * uy + dy * ux, -radius, radius],
    ]
    for (const [origin, delta, min, max] of slabs) {
      if (Math.abs(delta) < EPSILON) {
        if (origin < min || origin > max) {
          high = -1
          break
        }
      } else {
        const t1 = (min - origin) / delta,
          t2 = (max - origin) / delta
        low = Math.max(low, Math.min(t1, t2))
        high = Math.min(high, Math.max(t1, t2))
      }
    }
    if (high > low) intervals.push([low, high])
  }
  const merged: Interval[] = []
  for (const interval of intervals.sort((left, right) => left[0] - right[0])) {
    const last = merged[merged.length - 1]
    if (last && interval[0] <= last[1] + EPSILON) last[1] = Math.max(last[1], interval[1])
    else merged.push([...interval])
  }
  return merged
}

export function eraseStrokes(
  elements: BoardElement[],
  start: BoardPoint,
  end: BoardPoint,
  radius: number,
  makeId: () => string = () => crypto.randomUUID(),
  canErase: (element: BoardElement) => boolean = () => true
): BoardElement[] {
  return elements.flatMap((element) => {
    if (element.kind !== 'draw' || !element.points.length || !canErase(element))
      return [element]
    const angle = element.angle ?? 0,
      cos = Math.cos(angle),
      sin = Math.sin(angle)
    const points = element.points.map((point) => ({
      ...point,
      x:
        element.x +
        element.width / 2 +
        (point.x - element.width / 2) * cos -
        (point.y - element.height / 2) * sin,
      y:
        element.y +
        element.height / 2 +
        (point.x - element.width / 2) * sin +
        (point.y - element.height / 2) * cos,
    }))
    const reach = radius + (element.strokeWidth ?? 2) / 2
    // Reject distant strokes before clipping their segments.
    if (
      !points.some(
        (point) =>
          point.x >= Math.min(start.x, end.x) - reach &&
          point.x <= Math.max(start.x, end.x) + reach &&
          point.y >= Math.min(start.y, end.y) - reach &&
          point.y <= Math.max(start.y, end.y) + reach
      )
    ) {
      const xs = points.map((p) => p.x),
        ys = points.map((p) => p.y)
      if (
        Math.max(...xs) < Math.min(start.x, end.x) - reach ||
        Math.min(...xs) > Math.max(start.x, end.x) + reach ||
        Math.max(...ys) < Math.min(start.y, end.y) - reach ||
        Math.min(...ys) > Math.max(start.y, end.y) + reach
      )
        return [element]
    }
    if (points.length === 1)
      return erasedIntervals(points[0]!, points[0]!, start, end, reach).length
        ? []
        : [element]
    const fragments: BoardPoint[][] = []
    let current: BoardPoint[] = [],
      changed = false
    const flush = () => {
      if (current.length > 1) fragments.push(current)
      current = []
    }
    for (let index = 1; index < points.length; index++) {
      const a = points[index - 1]!,
        b = points[index]!
      const erased = erasedIntervals(a, b, start, end, reach)
      if (!erased.length) {
        if (!current.length) current.push(a)
        current.push(b)
        continue
      }
      changed = true
      let from = 0
      for (const [low, high] of erased) {
        if (low - from > EPSILON) {
          if (!current.length) current.push(interpolate(a, b, from))
          current.push(interpolate(a, b, low))
        }
        flush()
        from = high
      }
      if (1 - from > EPSILON) current.push(interpolate(a, b, from), b)
    }
    flush()
    if (!changed) return [element]
    return fragments.map((fragment, index) => ({
      ...element,
      id: index === 0 ? element.id : makeId(),
      angle: 0,
      ...normalizedStroke(fragment),
    }))
  })
}
