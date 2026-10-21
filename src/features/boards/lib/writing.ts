import type { BoardElement, BoardPoint } from '@/shared/types/board'
import type { SketchPath } from './sketch'

export function isWritingBrush(element: BoardElement) {
  return ['graphite', 'fountain', 'ink'].includes(element.drawBrush ?? '')
}
const number = (value: number) => Number(value.toFixed(3))
const position = (point: BoardPoint) => `${number(point.x)} ${number(point.y)}`
function smoothPath(points: BoardPoint[]) {
  if (points.length < 2) return ''
  let path = `M${position(points[0]!)}`
  for (let index = 1; index < points.length - 1; index++) {
    const point = points[index]!,
      next = points[index + 1]!
    path += ` Q${position(point)} ${number((point.x + next.x) / 2)} ${number((point.y + next.y) / 2)}`
  }
  return `${path} L${position(points[points.length - 1]!)}`
}
function dot(point: BoardPoint, radius: number) {
  return `M${number(point.x - radius)} ${number(point.y)} a${number(radius)} ${number(radius)} 0 1 0 ${number(radius * 2)} 0 a${number(radius)} ${number(radius)} 0 1 0 ${number(-radius * 2)} 0`
}

/** Identical vector ink during the gesture, after release, and in SVG/PNG export. */
export function writingPaths(
  element: BoardElement,
  color: string,
  pencil = false
): SketchPath[] {
  const points = element.points.filter(
    (point) => Number.isFinite(point.x) && Number.isFinite(point.y)
  )
  if (!points.length) return []
  const width = Math.max(
    0.5,
    Math.min(
      32,
      element.strokeWidth ??
        (pencil
          ? 1.2
          : element.drawBrush === 'fountain'
            ? 2.4
            : element.drawBrush === 'ink'
              ? 1.6
              : 1.8)
    )
  )
  const path = (
    d: string,
    opacity: number,
    strokeWidth = width,
    fill = 'none',
    stroke = color
  ): SketchPath => ({ d, opacity, strokeWidth, fill, stroke, ink: true })
  const pressure = (point: BoardPoint) =>
    Math.max(0.05, Math.min(1, point.pressure ?? 0.6))
  if (element.drawBrush === 'ink' && !pencil) {
    if (points.every((point) => point.x === points[0]!.x && point.y === points[0]!.y))
      return [
        path(
          dot(points[0]!, width * (0.2 + pressure(points[0]!) * 0.3)),
          1,
          0,
          color,
          'none'
        ),
      ]
    let distance = 0
    const left: BoardPoint[] = [],
      right: BoardPoint[] = []
    points.forEach((point, index) => {
      const before = points[Math.max(0, index - 1)]!
      const after = points[Math.min(points.length - 1, index + 1)]!
      if (index) distance += Math.hypot(point.x - before.x, point.y - before.y)
      const dx = after.x - before.x,
        dy = after.y - before.y
      const length = Math.hypot(dx, dy)
      const nx = length ? -dy / length : 0,
        ny = length ? dx / length : 1
      // Round nib: follows the hand without the fountain pen's calligraphic angle.
      // Distance-based grain stays stable while the pointer adds new samples.
      const grain = 1 + Math.sin(distance * 0.32) * 0.025
      const entry = Math.min(1, 0.45 + distance / Math.max(2, width * 2))
      const radius = width * 0.5 * (0.4 + pressure(point) * 0.6) * grain * entry
      left.push({ x: point.x + nx * radius, y: point.y + ny * radius })
      right.push({ x: point.x - nx * radius, y: point.y - ny * radius })
    })
    const outline = `${smoothPath(left)} L${position(right[right.length - 1]!)} ${smoothPath([...right].reverse()).replace(/^M[^Q L]+ [^Q L]+/, '')} Z`
    return [path(outline, 1, 0, color, 'none')]
  }
  if (element.drawBrush === 'fountain' && !pencil) {
    if (points.length === 1)
      return [
        path(
          dot(points[0]!, width * (0.25 + pressure(points[0]!) * 0.3)),
          0.94,
          0,
          color,
          'none'
        ),
      ]
    // A broad nib varies with stroke direction; pressure changes deposited ink.
    const left: BoardPoint[] = [],
      right: BoardPoint[] = []
    points.forEach((point, index) => {
      const before = points[Math.max(0, index - 1)]!,
        after = points[Math.min(points.length - 1, index + 1)]!
      const dx = after.x - before.x,
        dy = after.y - before.y,
        length = Math.hypot(dx, dy)
      const nx = length ? -dy / length : 0,
        ny = length ? dx / length : 1
      const nib = 0.28 + 0.72 * Math.abs((nx + ny) / Math.SQRT2)
      const radius = (width * nib * (0.35 + 0.65 * pressure(point))) / 2
      left.push({ x: point.x + nx * radius, y: point.y + ny * radius })
      right.push({ x: point.x - nx * radius, y: point.y - ny * radius })
    })
    const outline = `${smoothPath(left)} L${position(right[right.length - 1]!)} ${smoothPath([...right].reverse()).replace(/^M[^Q L]+ [^Q L]+/, '')} Z`
    return [
      path(outline, 0.94, 0, color, 'none'),
      path(smoothPath(points), 0.18, width * 0.16),
    ]
  }
  // Fine overlapping fibers and small gaps suggest graphite on paper, without
  // repainting the completed gesture through a separate bitmap renderer.
  if (points.length === 1)
    return [path(dot(points[0]!, width * 0.3), pencil ? 0.52 : 0.68, 0, color, 'none')]
  const seed =
    Array.from(element.id).reduce(
      (hash, char) => Math.imul(hash ^ char.charCodeAt(0), 16777619),
      2166136261
    ) >>> 0
  let distance = 0
  const distances = points.map((point, index) => {
    if (index)
      distance += Math.hypot(
        point.x - points[index - 1]!.x,
        point.y - points[index - 1]!.y
      )
    return distance
  })
  const grain = (distance: number, phase: number) =>
    Math.sin((seed % 997) + distance * 0.16 + phase) * 0.6 +
    Math.sin((seed % 281) + distance * 0.57 + phase * 1.7) * 0.4
  const normal = (index: number) => {
    const before = points[Math.max(0, index - 1)]!,
      after = points[Math.min(points.length - 1, index + 1)]!
    const length = Math.hypot(after.x - before.x, after.y - before.y) || 1
    return { x: -(after.y - before.y) / length, y: (after.x - before.x) / length }
  }
  const edges = (sign: number) =>
    points.map((point, index) => {
      const direction = normal(index)
      const deposited = 0.45 + pressure(point) * 0.55
      const irregularity = 1 + grain(distances[index]!, 2) * 0.18
      const start = Math.min(1, 0.65 + distances[index]! / 8)
      const radius = width * 0.43 * deposited * irregularity * start
      return {
        x: point.x + direction.x * radius * sign,
        y: point.y + direction.y * radius * sign,
      }
    })
  const left = edges(1),
    right = edges(-1)
  const body = `${smoothPath(left)} L${position(right[right.length - 1]!)} ${smoothPath([...right].reverse()).replace(/^M[^Q L]+ [^Q L]+/, '')} Z`
  const fibers = [-0.24, 0, 0.24].map((offset, index) => {
    const shifted = points.map((point, i) => {
      const direction = normal(i)
      const jitter = grain(distances[i]!, index * 2.7) * Math.min(0.6, 0.12 + width * 0.1)
      const spread = offset * width * (0.55 + pressure(point) * 0.45) + jitter
      return {
        x: point.x + direction.x * spread,
        y: point.y + direction.y * spread,
      }
    })
    const gaps = Array.from({ length: 10 }, (_, part) => {
      const noise = (Math.sin((seed % 991) + index * 3.7 + part * 2.31) + 1) / 2
      return number(width * (part % 2 ? 0.06 + noise * 0.28 : 0.8 + noise * 2.8))
    }).join(' ')
    return {
      ...path(smoothPath(shifted), pencil ? 0.24 : 0.34, width * (pencil ? 0.26 : 0.32)),
      dash: gaps,
    }
  })
  return [path(body, pencil ? 0.23 : 0.3, 0, color, 'none'), ...fibers]
}
