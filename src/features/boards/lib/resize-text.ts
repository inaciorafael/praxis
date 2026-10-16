import type { BoardElement, BoardPoint } from '@/shared/types/board'
import { resizeElement, rotatePoint, type ResizeOptions } from './geometry'
import { plainToRich } from './rich-text'

/** Scale from the gesture's original document, preserving mixed run proportions. */
export function resizeTextElement(
  element: BoardElement,
  point: BoardPoint,
  options: ResizeOptions
) {
  const richText = JSON.parse(
    JSON.stringify(element.richText ?? plainToRich(element.text, element))
  ) as NonNullable<BoardElement['richText']>
  const runs = richText.paragraphs.flatMap((paragraph) => paragraph.runs)
  const requested = resizeElement(element, point, { ...options, proportional: true })
  const sizes = runs.map((run) => run.fontSize)
  const minimum = Math.min(...sizes, 72),
    maximum = Math.max(...sizes, 8)
  const factor = Math.max(
    8 / minimum,
    Math.min(72 / maximum, requested.width / Math.max(1, element.width))
  )
  for (const run of runs)
    run.fontSize = Math.max(8, Math.min(72, Number((run.fontSize * factor).toFixed(3))))
  const width = element.width * factor,
    height = element.height * factor
  const center = { x: element.x + element.width / 2, y: element.y + element.height / 2 }
  const sx = options.handle.endsWith('e') ? 1 : -1,
    sy = options.handle.startsWith('s') ? 1 : -1
  const nextCenter = options.fromCenter
    ? center
    : rotatePoint(
        {
          x: center.x + (sx * (width - element.width)) / 2,
          y: center.y + (sy * (height - element.height)) / 2,
        },
        center,
        element.angle ?? 0
      )
  return {
    x: nextCenter.x - width / 2,
    y: nextCenter.y - height / 2,
    width,
    height,
    richText,
    textAutoWidth: false,
  }
}
