import type { BoardElement, BoardRichText, BoardRichRun } from '@/shared/types/board'
import {
  BOARD_HANDWRITTEN_FONT,
  boardInkColor,
  BOARD_SANS_FONT,
  preserveTextBoxHeight,
  textVerticalOffset,
  type MeasureLabel,
} from './label'
import { type SketchPath } from './sketch'
import { markerPaths } from './marker'

export type RichLayoutRun = BoardRichRun & {
  x: number
  y: number
  width: number
  fontFamily: string
}
export type RichLayoutLine = {
  runs: RichLayoutRun[]
  width: number
  height: number
  y: number
}
export type RichTextLayout = { lines: RichLayoutLine[]; width: number; height: number }

export function richTextPlain(document: BoardRichText): string {
  return document.paragraphs
    .map((paragraph) => paragraph.runs.map((run) => run.text).join(''))
    .join('\n')
}

export function plainToRich(text: string, element: BoardElement): BoardRichText {
  return {
    paragraphs: text
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => ({
        align: element.textAlign ?? 'left',
        list: 'none',
        runs: [
          {
            text: line,
            bold: false,
            italic: false,
            underline: false,
            font: element.textFont ?? 'sans',
            fontSize: element.textFont === 'handwritten' ? 22 : 14,
            color: boardInkColor(element),
            highlight: element.textHighlight ?? 'none',
          },
        ],
      })),
  }
}

let context: CanvasRenderingContext2D | null | undefined
function measureText(text: string, font: string) {
  if (context === undefined) {
    try {
      context =
        typeof document === 'undefined'
          ? null
          : document.createElement('canvas').getContext('2d')
    } catch {
      context = null
    }
  }
  if (context) {
    context.font = font
    return context.measureText(text).width
  }
  return (
    Array.from(text).length *
    Number.parseFloat(font.match(/([\d.]+)px/)?.[1] ?? '14') *
    0.55
  )
}

function typography(run: BoardRichRun) {
  const fontFamily = run.font === 'handwritten' ? BOARD_HANDWRITTEN_FONT : BOARD_SANS_FONT
  return {
    fontFamily,
    font: `${run.italic ? 'italic' : 'normal'} ${run.bold ? '700' : '400'} ${run.fontSize}px ${fontFamily}`,
  }
}

/** Scene-unit layout shared by SVG and element sizing; authored whitespace is retained. */
export function layoutRichText(
  element: BoardElement,
  document: BoardRichText,
  measure: MeasureLabel = measureText
): RichTextLayout {
  const available = element.textAutoWidth ? Infinity : Math.max(24, element.width - 24)
  const lines: RichLayoutLine[] = []
  let top = 12
  let ordered = 0
  for (const paragraph of document.paragraphs) {
    ordered = paragraph.list === 'ordered' ? ordered + 1 : 0
    const first = paragraph.runs[0] ?? plainToRich('', element).paragraphs[0]!.runs[0]!
    const prefix =
      paragraph.list === 'bullet'
        ? '• '
        : paragraph.list === 'ordered'
          ? `${ordered}. `
          : ''
    const source = prefix
      ? [{ ...first, text: prefix, highlight: 'none' as const }, ...paragraph.runs]
      : paragraph.runs
    let runs: RichLayoutRun[] = []
    let width = 0
    let height = Math.max(20, first.fontSize * 1.25)
    const flush = () => {
      const alignment = paragraph.align
      const offset = Number.isFinite(available)
        ? alignment === 'center'
          ? (available - width) / 2
          : alignment === 'right'
            ? available - width
            : 0
        : 0
      const baseline = top + height * 0.8
      lines.push({
        runs: runs.map((run) => ({
          ...run,
          x: run.x + Math.max(0, offset),
          y: baseline,
        })),
        width,
        height,
        y: baseline,
      })
      top += height
      runs = []
      width = 0
      height = Math.max(20, first.fontSize * 1.25)
    }
    for (const run of source) {
      const { fontFamily, font } = typography(run)
      const normalized = run.text.replace(/\r\n?/g, '\n')
      for (const token of normalized.match(/\n|[^\S\n]+|[^\s]+/g) ?? []) {
        if (token === '\n') {
          flush()
          continue
        }
        if (width && width + measure(token, font) > available) flush()
        let piece = ''
        const append = () => {
          if (!piece) return
          const measured = measure(piece, font)
          runs.push({
            ...run,
            text: piece,
            fontFamily,
            x: 12 + width,
            y: 0,
            width: measured,
          })
          width += measured
          height = Math.max(height, run.fontSize * 1.25)
          piece = ''
        }
        for (const character of Array.from(token)) {
          if (
            width + measure(piece + character, font) > available &&
            (width > 0 || piece)
          ) {
            append()
            flush()
          }
          piece += character
        }
        append()
      }
    }
    flush()
  }
  const verticalOffset = textVerticalOffset(element, top - 12)
  for (const line of lines) {
    line.y += verticalOffset
    for (const run of line.runs) run.y += verticalOffset
  }
  return {
    lines,
    width: element.textAutoWidth
      ? Math.max(48, Math.ceil(Math.max(0, ...lines.map((line) => line.width))) + 24)
      : Math.max(48, element.width),
    height: preserveTextBoxHeight(element, Math.max(36, Math.ceil(top + 6))),
  }
}

export function fitRichText(
  element: BoardElement,
  document: BoardRichText,
  measure?: MeasureLabel
) {
  const { width, height } = layoutRichText(element, document, measure)
  return { width, height }
}

export function richHighlightPaths(
  element: BoardElement,
  layout: RichTextLayout
): SketchPath[] {
  return layout.lines.flatMap((line) => {
    const segments: RichLayoutRun[] = []
    let previous: RichLayoutRun | undefined
    for (const run of line.runs) {
      if (run.highlight === 'none' || !run.text || run.width <= 0) {
        previous = undefined
        continue
      }
      if (
        previous &&
        previous.highlight === run.highlight &&
        previous.fontSize === run.fontSize &&
        Math.abs(previous.x + previous.width - run.x) < 0.1
      ) {
        previous.width += run.width
      } else {
        previous = { ...run }
        segments.push(previous)
      }
    }
    return segments.flatMap((run) =>
      markerPaths(
        run.highlight,
        run.x - 2,
        run.y - run.fontSize * 0.7,
        run.width + 4,
        run.fontSize * 0.85,
        element.id
      )
    )
  })
}
