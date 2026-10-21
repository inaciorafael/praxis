import type { BoardElement, BoardPoint } from '@/shared/types/board'
import {
  bounds,
  connectorPoints,
  linePoints,
  normalizeAngle,
  rotatePoint,
} from './geometry'
import { copyElements } from '../model/history'
import { plainToRich } from './rich-text'

export function expandGroups(elements: BoardElement[], ids: string[]): string[] {
  const selected = new Set(ids)
  const groups = new Set(
    elements.filter((e) => selected.has(e.id) && e.groupId).map((e) => e.groupId)
  )
  return elements
    .filter((e) => selected.has(e.id) || (e.groupId && groups.has(e.groupId)))
    .map((e) => e.id)
}

export function groupBox(
  elements: BoardElement[],
  ids: string[]
): BoardElement | undefined {
  if (ids.length < 2) return undefined
  const selected = new Set(ids)
  const chosen = elements.filter((e) => selected.has(e.id))
  if (
    chosen.length < 2 ||
    !chosen[0]!.groupId ||
    !chosen.every((e) => e.groupId === chosen[0]!.groupId)
  )
    return undefined
  return {
    ...chosen[0]!,
    ...bounds(chosen, elements),
    id: `group:${chosen[0]!.groupId}`,
    kind: 'rectangle',
    angle: 0,
  }
}

/** Uniform scale keeps rotated shapes, text and handwriting geometrically consistent. */
export function transformGroup(
  elements: BoardElement[],
  ids: string[],
  origin: { x: number; y: number; width: number; height: number },
  target: { x: number; y: number; width: number; height: number },
  angle = 0,
  onlySelected = false
): BoardElement[] {
  const scale = target.width / Math.max(1, origin.width)
  const center = { x: origin.x + origin.width / 2, y: origin.y + origin.height / 2 }
  const transform = (point: BoardPoint) => {
    const rotated = rotatePoint(point, center, angle)
    return {
      x: target.x + (rotated.x - origin.x) * scale,
      y: target.y + (rotated.y - origin.y) * scale,
    }
  }
  const chosen = new Set(ids)
  // Interactive transforms only need isolated copies of the affected elements.
  const source = onlySelected
    ? elements.filter((element) => chosen.has(element.id))
    : elements
  return copyElements(source).map((element) => {
    if (!chosen.has(element.id)) return element
    if (
      element.text &&
      !element.richText &&
      !['image', 'draw', 'arrow', 'line'].includes(element.kind)
    )
      element.richText = plainToRich(element.text, element)
    if (element.kind === 'arrow' || element.kind === 'line') {
      const [a, b] = (
        element.kind === 'arrow'
          ? connectorPoints(element, elements)
          : linePoints(element)
      ).map(transform)
      element.x = a!.x
      element.y = a!.y
      element.width = b!.x - a!.x
      element.height = b!.y - a!.y
      element.angle = 0
    } else {
      const position = transform({
        x: element.x + element.width / 2,
        y: element.y + element.height / 2,
      })
      element.width *= scale
      element.height *= scale
      element.x = position.x - element.width / 2
      element.y = position.y - element.height / 2
      element.angle = normalizeAngle((element.angle ?? 0) + angle)
      element.points = element.points.map((point) => ({
        ...point,
        x: point.x * scale,
        y: point.y * scale,
      }))
      if (element.kind === 'text') element.textAutoWidth = false
      for (const paragraph of element.richText?.paragraphs ?? [])
        for (const run of paragraph.runs)
          run.fontSize = Math.max(8, Math.min(72, run.fontSize * scale))
    }
    if (element.strokeWidth)
      element.strokeWidth = Math.max(0.5, Math.min(32, element.strokeWidth * scale))
    return element
  })
}
