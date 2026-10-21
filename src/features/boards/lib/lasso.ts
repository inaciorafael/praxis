import type { BoardElement, BoardPoint } from '@/shared/types/board'
import {
  connectorOutline,
  elementCorners,
  linePoints,
  polygonVertices,
  rotatePoint,
} from './geometry'

const EPSILON = 1e-7
const cross = (a: BoardPoint, b: BoardPoint) => a.x * b.y - a.y * b.x
const delta = (a: BoardPoint, b: BoardPoint) => ({ x: a.x - b.x, y: a.y - b.y })

/** Boundary-inclusive even/odd containment, including self-intersecting lassos. */
export function pointInLasso(point: BoardPoint, polygon: BoardPoint[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j]!,
      b = polygon[i]!
    const edge = delta(b, a),
      offset = delta(point, a)
    if (
      Math.abs(cross(edge, offset)) <=
        EPSILON * Math.max(1, Math.hypot(edge.x, edge.y)) &&
      point.x >= Math.min(a.x, b.x) - EPSILON &&
      point.x <= Math.max(a.x, b.x) + EPSILON &&
      point.y >= Math.min(a.y, b.y) - EPSILON &&
      point.y <= Math.max(a.y, b.y) + EPSILON
    )
      return true
    if (
      a.y > point.y !== b.y > point.y &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
    )
      inside = !inside
  }
  return inside
}

function distanceToSegment(point: BoardPoint, a: BoardPoint, b: BoardPoint): number {
  const dx = b.x - a.x,
    dy = b.y - a.y
  const lengthSquared = dx * dx + dy * dy
  const t = lengthSquared
    ? Math.max(
        0,
        Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared)
      )
    : 0
  return Math.hypot(point.x - a.x - t * dx, point.y - a.y - t * dy)
}

function segmentsTouch(
  a: BoardPoint,
  b: BoardPoint,
  c: BoardPoint,
  d: BoardPoint,
  tolerance: number
): boolean {
  if (
    Math.max(a.x, b.x) + tolerance < Math.min(c.x, d.x) ||
    Math.max(c.x, d.x) + tolerance < Math.min(a.x, b.x) ||
    Math.max(a.y, b.y) + tolerance < Math.min(c.y, d.y) ||
    Math.max(c.y, d.y) + tolerance < Math.min(a.y, b.y)
  )
    return false
  const direction = delta(b, a),
    edge = delta(d, c)
  const determinant = cross(direction, edge)
  if (Math.abs(determinant) > EPSILON) {
    const offset = delta(c, a)
    const t = cross(offset, edge) / determinant,
      u = cross(offset, direction) / determinant
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true
  }
  return (
    Math.min(
      distanceToSegment(a, c, d),
      distanceToSegment(b, c, d),
      distanceToSegment(c, a, b),
      distanceToSegment(d, a, b)
    ) <=
    tolerance + EPSILON
  )
}

function outline(
  element: BoardElement,
  scene: BoardElement[]
): { points: BoardPoint[]; closed: boolean } {
  if (element.kind === 'arrow')
    return { points: connectorOutline(element, scene, false), closed: false }
  if (element.kind === 'line') return { points: linePoints(element), closed: false }
  const center = { x: element.x + element.width / 2, y: element.y + element.height / 2 }
  const world = (point: BoardPoint) =>
    rotatePoint(
      { x: element.x + point.x, y: element.y + point.y },
      center,
      element.angle ?? 0
    )
  if (element.kind === 'draw') return { points: element.points.map(world), closed: false }
  if (
    element.kind === 'ellipse' ||
    (element.kind === 'text' && element.textBackground === 'ellipse')
  )
    return {
      points: Array.from({ length: 48 }, (_, i) =>
        world({
          x: (element.width / 2) * (1 + Math.cos((i * Math.PI) / 24)),
          y: (element.height / 2) * (1 + Math.sin((i * Math.PI) / 24)),
        })
      ),
      closed: true,
    }
  const polygon = polygonVertices(element)
  return { points: polygon ? polygon.map(world) : elementCorners(element), closed: true }
}

/** Select by overlap with actual geometry, with a screen-scaled margin supplied by the editor. */
export function elementsInLasso(
  elements: BoardElement[],
  polygon: BoardPoint[],
  scene: BoardElement[] = elements,
  tolerance = 0
): string[] {
  if (polygon.length < 3) return []
  let left = Infinity,
    right = -Infinity,
    top = Infinity,
    bottom = -Infinity
  for (const p of polygon) {
    left = Math.min(left, p.x)
    right = Math.max(right, p.x)
    top = Math.min(top, p.y)
    bottom = Math.max(bottom, p.y)
  }
  if (right - left < EPSILON || bottom - top < EPSILON) return []
  return elements
    .filter((element) => {
      const { points, closed } = outline(element, scene)
      if (!points.length) return false
      let minX = Infinity,
        minY = Infinity,
        maxX = -Infinity,
        maxY = -Infinity
      for (const point of points) {
        minX = Math.min(minX, point.x)
        minY = Math.min(minY, point.y)
        maxX = Math.max(maxX, point.x)
        maxY = Math.max(maxY, point.y)
      }
      if (
        maxX + tolerance < left ||
        minX - tolerance > right ||
        maxY + tolerance < top ||
        minY - tolerance > bottom
      )
        return false
      if (points.some((point) => pointInLasso(point, polygon))) return true
      // A small lasso drawn inside a large shape should select that shape too.
      if (closed && polygon.some((point) => pointInLasso(point, points))) return true
      const count = closed ? points.length : Math.max(1, points.length - 1)
      for (let i = 0; i < count; i++) {
        const a = points[i]!,
          b = points[(i + 1) % points.length]!
        for (let j = 0; j < polygon.length; j++) {
          if (
            segmentsTouch(
              a,
              b,
              polygon[j]!,
              polygon[(j + 1) % polygon.length]!,
              tolerance
            )
          )
            return true
        }
      }
      return false
    })
    .map((element) => element.id)
}
