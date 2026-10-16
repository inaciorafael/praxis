import type { BoardElement, BoardPoint } from '@/shared/types/board'

export type Camera = { x: number; y: number; zoom: number }
export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 4
export const MAX_POINTS = 2000
export function normalizeAngle(angle: number): number {
  if (!Number.isFinite(angle)) return 0
  const turn = Math.PI * 2
  return ((((angle + Math.PI) % turn) + turn) % turn) - Math.PI
}
export function rotatePoint(
  point: BoardPoint,
  center: BoardPoint,
  angle: number
): BoardPoint {
  const dx = point.x - center.x,
    dy = point.y - center.y
  const cosine = Math.cos(angle),
    sine = Math.sin(angle)
  return { x: center.x + dx * cosine - dy * sine, y: center.y + dx * sine + dy * cosine }
}
function elementCenter(element: BoardElement): BoardPoint {
  return { x: element.x + element.width / 2, y: element.y + element.height / 2 }
}
/** Clockwise corners: north-west, north-east, south-east, south-west. */
export function elementCorners(element: BoardElement): BoardPoint[] {
  const center = elementCenter(element)
  return [
    { x: element.x, y: element.y },
    { x: element.x + element.width, y: element.y },
    { x: element.x + element.width, y: element.y + element.height },
    { x: element.x, y: element.y + element.height },
  ].map((point) => rotatePoint(point, center, element.angle ?? 0))
}
export function pointInElement(element: BoardElement, point: BoardPoint): boolean {
  const local = rotatePoint(point, elementCenter(element), -(element.angle ?? 0))
  return (
    local.x >= Math.min(element.x, element.x + element.width) &&
    local.x <= Math.max(element.x, element.x + element.width) &&
    local.y >= Math.min(element.y, element.y + element.height) &&
    local.y <= Math.max(element.y, element.y + element.height)
  )
}
export type ResizeOptions = {
  handle: 'nw' | 'ne' | 'sw' | 'se'
  proportional: boolean
  fromCenter: boolean
}
/** Resize in the original orientation, keeping the opposite corner or center fixed. */
export function resizeElement(
  element: BoardElement,
  point: BoardPoint,
  options: ResizeOptions
) {
  const center = elementCenter(element)
  const angle = element.angle ?? 0
  const local = rotatePoint(point, center, -angle)
  const sx = options.handle.endsWith('e') ? 1 : -1
  const sy = options.handle.startsWith('s') ? 1 : -1
  const anchor = options.fromCenter
    ? center
    : {
        x: center.x - (sx * Math.abs(element.width)) / 2,
        y: center.y - (sy * Math.abs(element.height)) / 2,
      }
  const multiplier = options.fromCenter ? 2 : 1
  let width = Math.max(24, sx * (local.x - anchor.x) * multiplier)
  let height = Math.max(24, sy * (local.y - anchor.y) * multiplier)
  if (options.proportional) {
    const originalWidth = Math.max(1, Math.abs(element.width))
    const originalHeight = Math.max(1, Math.abs(element.height))
    const scale = Math.max(
      width / originalWidth,
      height / originalHeight,
      24 / originalWidth,
      24 / originalHeight
    )
    width = originalWidth * scale
    height = originalHeight * scale
  }
  const nextCenter = options.fromCenter
    ? center
    : rotatePoint(
        {
          x: anchor.x + (sx * width) / 2,
          y: anchor.y + (sy * height) / 2,
        },
        center,
        angle
      )
  return { x: nextCenter.x - width / 2, y: nextCenter.y - height / 2, width, height }
}
export function worldPoint(point: BoardPoint, camera: Camera): BoardPoint {
  return { x: (point.x - camera.x) / camera.zoom, y: (point.y - camera.y) / camera.zoom }
}
export function zoomAt(camera: Camera, point: BoardPoint, zoom: number): Camera {
  const next = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom))
  const world = worldPoint(point, camera)
  return { x: point.x - world.x * next, y: point.y - world.y * next, zoom: next }
}
export function bounds(elements: BoardElement[], scene: BoardElement[] = elements) {
  if (!elements.length) return { x: 0, y: 0, width: 640, height: 480 }
  const points = elements.flatMap((element) =>
    element.kind === 'arrow' ? connectorPoints(element, scene) : elementCorners(element)
  )
  const x = Math.min(...points.map((point) => point.x))
  const y = Math.min(...points.map((point) => point.y))
  return {
    x,
    y,
    width: Math.max(1, Math.max(...points.map((point) => point.x)) - x),
    height: Math.max(1, Math.max(...points.map((point) => point.y)) - y),
  }
}
export function connectorPoints(
  element: BoardElement,
  elements: BoardElement[]
): [BoardPoint, BoardPoint] {
  const start = elements.find((e) => e.id === element.startId && e.kind !== 'arrow')
  const end = elements.find((e) => e.id === element.endId && e.kind !== 'arrow')
  const center = (target: BoardElement | undefined, fallback: BoardPoint) =>
    target
      ? { x: target.x + target.width / 2, y: target.y + target.height / 2 }
      : fallback
  const a = center(start, { x: element.x, y: element.y })
  const b = center(end, { x: element.x + element.width, y: element.y + element.height })
  function edge(target: BoardElement | undefined, from: BoardPoint, toward: BoardPoint) {
    if (!target) return from
    const localToward = rotatePoint(toward, from, -(target.angle ?? 0))
    const dx = localToward.x - from.x,
      dy = localToward.y - from.y
    if (!dx && !dy) return from
    const rx = Math.max(0.5, Math.abs(target.width) / 2)
    const ry = Math.max(0.5, Math.abs(target.height) / 2)
    const scale =
      target.kind === 'ellipse' ||
      (target.kind === 'text' && target.textBackground === 'ellipse')
        ? 1 / Math.sqrt((dx / rx) ** 2 + (dy / ry) ** 2)
        : Math.min(dx ? rx / Math.abs(dx) : Infinity, dy ? ry / Math.abs(dy) : Infinity)
    return rotatePoint(
      { x: from.x + dx * scale, y: from.y + dy * scale },
      from,
      target.angle ?? 0
    )
  }
  return [edge(start, a, b), edge(end, b, a)]
}
export function normalizedStroke(points: BoardPoint[]) {
  if (!points.length) return { x: 0, y: 0, width: 1, height: 1, points: [] }
  const limited = points.slice(0, MAX_POINTS)
  const x = Math.min(...limited.map((p) => p.x))
  const y = Math.min(...limited.map((p) => p.y))
  return {
    x,
    y,
    width: Math.max(1, Math.max(...limited.map((p) => p.x)) - x),
    height: Math.max(1, Math.max(...limited.map((p) => p.y)) - y),
    points: limited.map((p) => ({ ...p, x: p.x - x, y: p.y - y })),
  }
}
export function exportSize(width: number, height: number) {
  const scale = Math.min(
    1,
    8192 / width,
    8192 / height,
    Math.sqrt(64_000_000 / (width * height))
  )
  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
  }
}
