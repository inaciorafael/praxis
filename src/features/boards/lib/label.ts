import type { BoardElement, PaperColorScheme } from '@/shared/types/board'
import { paperInk } from './background'
import { type SketchPath } from './sketch'
import { markerPaths } from './marker'

export const BOARD_HANDWRITTEN_FONT = '"Praxis Caveat", cursive'
export const BOARD_SANS_FONT = 'sans-serif'
export function boardInkColor(element: BoardElement, scheme: PaperColorScheme = 'light') {
  if (element.strokeColor) return element.strokeColor
  return paperInk(
    {
      neutral: '#252a34',
      amber: '#985610',
      sage: '#397349',
      blue: '#285bb5',
      rose: '#b13f60',
      purple: '#7846ac',
    }[element.color],
    scheme
  )
}
export const TEXT_HIGHLIGHT_COLORS = {
  yellow: '#fde875',
  green: '#b9edaa',
  pink: '#ffc4d8',
  blue: '#bce2ff',
} as const

export type LabelLine = { text: string; x: number; y: number; width: number }
export type LabelLayout = {
  fontFamily: string
  fontSize: number
  lineHeight: number
  lines: LabelLine[]
}
export type MeasureLabel = (text: string, font: string) => number

const TEXT_PADDING = 24

export function textVerticalOffset(element: BoardElement, contentHeight: number) {
  const available = Math.max(
    0,
    element.height - TEXT_PADDING - (element.taskId ? 20 : 0) - contentHeight
  )
  return element.textVerticalAlign === 'bottom'
    ? available
    : element.textVerticalAlign === 'middle'
      ? available / 2
      : 0
}

export function preserveTextBoxHeight(element: BoardElement, naturalHeight: number) {
  const hasContainer = element.textBackground && element.textBackground !== 'none'
  return hasContainer ||
    (element.textVerticalAlign && element.textVerticalAlign !== 'top')
    ? Math.max(element.height, naturalHeight)
    : naturalHeight
}

export function boardTextTypography(element: BoardElement) {
  const handwritten = element.textFont === 'handwritten'
  return {
    fontFamily: handwritten ? BOARD_HANDWRITTEN_FONT : BOARD_SANS_FONT,
    fontSize: handwritten ? 22 : 14,
    lineHeight: handwritten ? 24 : 20,
  }
}

function textWidth(element: BoardElement, label: string, measure: MeasureLabel) {
  if (element.kind !== 'text') return element.width
  if (!element.textAutoWidth) return Math.max(48, element.width)
  const { fontSize, fontFamily } = boardTextTypography(element)
  const naturalWidth = Math.max(
    0,
    ...label
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((paragraph) => measure(paragraph, `${fontSize}px ${fontFamily}`))
  )
  return Math.max(48, Math.ceil(naturalWidth) + TEXT_PADDING)
}

let context: CanvasRenderingContext2D | null | undefined

function measureText(text: string, font: string): number {
  if (context === undefined) {
    context =
      typeof document === 'undefined'
        ? null
        : document.createElement('canvas').getContext('2d')
  }
  if (context) {
    context.font = font
    return context.measureText(text).width
  }
  // SSR/test environments have no canvas. Actual rendering measures the bundled font.
  return Array.from(text).length * Number.parseFloat(font) * 0.55
}

/** Layout uses scene units so zoom and camera movement never change wrapping. */
export function labelLayout(
  element: BoardElement,
  label: string,
  measure: MeasureLabel = measureText
): LabelLayout {
  const { fontFamily, fontSize, lineHeight } = boardTextTypography(element)
  const font = `${fontSize}px ${fontFamily}`
  const availableWidth = Math.max(0, textWidth(element, label, measure) - TEXT_PADDING)
  const statusSpace = element.taskId ? 20 : 0
  const maxLines =
    element.kind === 'text'
      ? Infinity
      : Math.max(0, Math.floor((element.height - 12 - statusSpace) / lineHeight))
  const lines: LabelLine[] = []
  let stopped = false
  const append = (text: string) => {
    if (lines.length >= maxLines) {
      stopped = true
      return
    }
    lines.push({
      text,
      x: 12,
      y: 26 + lines.length * lineHeight,
      width: measure(text, font),
    })
  }
  if (availableWidth === 0 || maxLines === 0)
    return { fontFamily, fontSize, lineHeight, lines }
  for (const paragraph of label.replace(/\r\n?/g, '\n').split('\n')) {
    if (stopped) break
    let line = ''
    if (element.kind === 'text') {
      // Keep authored spaces and tabs, including indentation and blank paragraphs.
      for (const token of paragraph.match(/\s+|\S+/g) ?? []) {
        if (line && measure(line + token, font) > availableWidth) {
          append(line)
          line = ''
        }
        for (const character of Array.from(token)) {
          if (line && measure(line + character, font) > availableWidth) {
            append(line)
            line = ''
          }
          line += character
        }
      }
      append(line)
      continue
    }
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word
      if (line && measure(candidate, font) > availableWidth) {
        append(line)
        line = ''
      }
      if (stopped) break
      if (measure(word, font) <= availableWidth) {
        line = line ? `${line} ${word}` : word
        continue
      }
      // Split oversized words by Unicode code point without dropping content.
      for (const character of Array.from(word)) {
        if (line && measure(line + character, font) > availableWidth) {
          append(line)
          line = ''
        }
        if (stopped) break
        line += character
      }
    }
    if (!stopped) append(line)
  }
  const verticalOffset = textVerticalOffset(element, lines.length * lineHeight)
  const boxWidth = textWidth(element, label, measure)
  for (const line of lines) {
    line.x =
      element.textAlign === 'center'
        ? (boxWidth - line.width) / 2
        : element.textAlign === 'right'
          ? boxWidth - 12 - line.width
          : 12
    line.y += verticalOffset
  }
  return { fontFamily, fontSize, lineHeight, lines }
}

/** Free text grows vertically; manually sized text retains its wrapping width. */
export function fitBoardText(
  element: BoardElement,
  label: string,
  measure: MeasureLabel = measureText
): { width: number; height: number } {
  const width = textWidth(element, label, measure)
  const layout = labelLayout({ ...element, width }, label, measure)
  return {
    width,
    height: preserveTextBoxHeight(
      element,
      Math.max(
        36,
        layout.lines.length * layout.lineHeight + 12 + (element.taskId ? 20 : 0)
      )
    ),
  }
}

/** One seeded solid Rough.js stroke behind each visible line of text. */
export function labelHighlightPaths(
  element: BoardElement,
  layout: LabelLayout
): SketchPath[] {
  const highlight = element.textHighlight ?? 'none'
  if (highlight === 'none') return []
  return layout.lines.flatMap((line) => {
    if (!line.text || line.width <= 0) return []
    return markerPaths(
      highlight,
      line.x - 2,
      line.y - layout.fontSize * 0.7,
      line.width + 4,
      layout.fontSize * 0.85,
      element.id
    )
  })
}
