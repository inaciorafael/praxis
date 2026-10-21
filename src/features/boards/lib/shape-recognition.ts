import type { BoardElement, BoardPoint } from '@/shared/types/board'

export type RecognizedShape = Pick<
  BoardElement,
  'x' | 'y' | 'width' | 'height' | 'angle'
> & {
  kind: 'line' | 'ellipse' | 'rectangle' | 'triangle'
}
const distance = (a: BoardPoint, b: BoardPoint) => Math.hypot(b.x - a.x, b.y - a.y)
function deviation(p: BoardPoint, a: BoardPoint, b: BoardPoint) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    length = dx * dx + dy * dy
  const t = length
    ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / length))
    : 0
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy)
}
function simplify(points: BoardPoint[], tolerance: number): BoardPoint[] {
  if (points.length < 3) return points
  let farthest = 0,
    index = 0
  for (let i = 1; i < points.length - 1; i++) {
    const d = deviation(points[i]!, points[0]!, points[points.length - 1]!)
    if (d > farthest) {
      farthest = d
      index = i
    }
  }
  if (farthest <= tolerance) return [points[0]!, points[points.length - 1]!]
  return [
    ...simplify(points.slice(0, index + 1), tolerance).slice(0, -1),
    ...simplify(points.slice(index), tolerance),
  ]
}

/** Conservative single-stroke recognition. Runs only after an intentional hold. */
export function recognizeShape(
  input: readonly BoardPoint[],
  zoom = 1
): RecognizedShape | null {
  if (
    input.length < 3 ||
    input.some((p) => !Number.isFinite(p.x) || !Number.isFinite(p.y))
  )
    return null
  // Bound work independently of tablet sampling frequency; retain the last endpoint.
  const points = input.filter(
    (_, i) => i % Math.max(1, Math.ceil(input.length / 256)) === 0
  )
  if (points[points.length - 1] !== input[input.length - 1])
    points.push(input[input.length - 1]!)
  const first = points[0]!,
    last = points[points.length - 1]!
  const x = Math.min(...points.map((p) => p.x)),
    y = Math.min(...points.map((p) => p.y))
  const width = Math.max(...points.map((p) => p.x)) - x,
    height = Math.max(...points.map((p) => p.y)) - y
  const diagonal = Math.hypot(width, height)
  if (diagonal * zoom < 48) return null
  const length = points.slice(1).reduce((sum, p, i) => sum + distance(points[i]!, p), 0)
  const chord = distance(first, last)
  if (
    chord >= length * 0.95 &&
    points.every((p) => deviation(p, first, last) <= Math.max(2 / zoom, chord * 0.035))
  )
    return {
      kind: 'line',
      x: first.x,
      y: first.y,
      width: last.x - first.x,
      height: last.y - first.y,
      angle: 0,
    }
  if (
    width * zoom < 24 ||
    height * zoom < 24 ||
    chord > diagonal * 0.2 ||
    length > diagonal * 3.7
  )
    return null

  // Start at an extreme point rather than wherever the user happened to begin.
  const ring = points.slice(0, -1)
  const start = ring.reduce((best, p, i) => (p.x < ring[best]!.x ? i : best), 0)
  const ordered = [...ring.slice(start), ...ring.slice(0, start)]
  const opposite = ordered.reduce(
    (best, p, i) =>
      distance(p, ordered[0]!) > distance(ordered[best]!, ordered[0]!) ? i : best,
    0
  )
  const vertices = [
    ...simplify(ordered.slice(0, opposite + 1), diagonal * 0.045).slice(0, -1),
    ...simplify([...ordered.slice(opposite), ordered[0]!], diagonal * 0.045).slice(0, -1),
  ]
  // Remove seam points that lie along an edge.
  let changed = true
  while (changed && vertices.length > 3) {
    changed = false
    for (let i = 0; i < vertices.length; i++) {
      if (
        deviation(
          vertices[i]!,
          vertices[(i + vertices.length - 1) % vertices.length]!,
          vertices[(i + 1) % vertices.length]!
        ) <
        diagonal * 0.05
      ) {
        vertices.splice(i, 1)
        changed = true
        break
      }
    }
  }
  if (vertices.length === 4) {
    const right = vertices.every((p, i) => {
      const a = vertices[(i + 3) % 4]!,
        b = vertices[(i + 1) % 4]!
      return (
        Math.abs((a.x - p.x) * (b.x - p.x) + (a.y - p.y) * (b.y - p.y)) /
          (distance(a, p) * distance(b, p)) <
        0.25
      )
    })
    if (right) {
      const a = vertices[0]!,
        b = vertices[1]!,
        c = vertices[2]!,
        d = vertices[3]!
      const w = (distance(a, b) + distance(c, d)) / 2,
        h = (distance(b, c) + distance(d, a)) / 2
      const cx = vertices.reduce((s, p) => s + p.x, 0) / 4,
        cy = vertices.reduce((s, p) => s + p.y, 0) / 4
      return {
        kind: 'rectangle',
        x: cx - w / 2,
        y: cy - h / 2,
        width: w,
        height: h,
        angle: Math.atan2(b.y - a.y, b.x - a.x),
      }
    }
  }
  if (vertices.length === 3) {
    for (let i = 0; i < 3; i++) {
      const apex = vertices[i]!
      let a = vertices[(i + 1) % 3]!,
        b = vertices[(i + 2) % 3]!
      if ((b.x - a.x) * (apex.y - a.y) - (b.y - a.y) * (apex.x - a.x) > 0) [a, b] = [b, a]
      const w = distance(a, b),
        mx = (a.x + b.x) / 2,
        my = (a.y + b.y) / 2
      const h = Math.abs((b.x - a.x) * (apex.y - my) - (b.y - a.y) * (apex.x - mx)) / w
      const offset =
        Math.abs((apex.x - mx) * (b.x - a.x) + (apex.y - my) * (b.y - a.y)) / w
      if (offset < w * 0.18 && h * zoom >= 24) {
        const angle = Math.atan2(b.y - a.y, b.x - a.x),
          cx = mx + (Math.sin(angle) * h) / 2,
          cy = my - (Math.cos(angle) * h) / 2
        return {
          kind: 'triangle',
          x: cx - w / 2,
          y: cy - h / 2,
          width: w,
          height: h,
          angle,
        }
      }
    }
  }
  const cx = x + width / 2,
    cy = y + height / 2
  const errors = points.map((p) =>
    Math.abs(Math.hypot((p.x - cx) / (width / 2), (p.y - cy) / (height / 2)) - 1)
  )
  const sectors = new Set(
    points.map(
      (p) =>
        Math.floor(
          ((Math.atan2((p.y - cy) / height, (p.x - cx) / width) + Math.PI) * 4) / Math.PI
        ) % 8
    )
  )
  if (
    errors.reduce((s, e) => s + e, 0) / errors.length < 0.1 &&
    Math.max(...errors) < 0.28 &&
    sectors.size === 8
  )
    return { kind: 'ellipse', x, y, width, height, angle: 0 }
  return null
}
