import type { BoardElement, PaperColorScheme } from '@/shared/types/board'
export function elementFill(element: BoardElement) {
  if (
    !['image', 'draw', 'arrow', 'line'].includes(element.kind) &&
    (element.kind !== 'text' || (element.textBackground ?? 'none') !== 'none') &&
    element.fillColor
  )
    return element.fillColor
  if (element.kind === 'text' && (element.textBackground ?? 'none') !== 'none')
    return element.color === 'neutral'
      ? '#ffffff'
      : `color-mix(in srgb, var(--board-${element.color}) 14%, white)`
  return [
    'text',
    'frame',
    'arrow',
    'line',
    'draw',
    'rectangle',
    'ellipse',
    'triangle',
    'hexagon',
  ].includes(element.kind)
    ? 'transparent'
    : element.color === 'neutral'
      ? 'var(--board-note)'
      : `color-mix(in srgb, var(--board-${element.color}) 14%, white)`
}
export function elementLabelScheme(
  element: BoardElement,
  scheme: PaperColorScheme = 'light'
): PaperColorScheme {
  // Hatched shapes expose the paper between strokes; text contrasts with the
  // paper, rather than treating the hatch color as an opaque background.
  if (elementFillStyle(element) !== 'solid') return scheme
  if (element.fillColor?.startsWith('#')) {
    const color = element.fillColor
    const luminance =
      0.2126 * parseInt(color.slice(1, 3), 16) +
      0.7152 * parseInt(color.slice(3, 5), 16) +
      0.0722 * parseInt(color.slice(5, 7), 16)
    return luminance < 128 ? 'dark' : 'light'
  }
  if (element.fillColor === 'transparent') return scheme
  if (
    ['note', 'question', 'decision', 'task'].includes(element.kind) ||
    (element.kind === 'text' &&
      element.textBackground &&
      element.textBackground !== 'none') ||
    (element.textHighlight && element.textHighlight !== 'none') ||
    element.textAnnotation?.type === 'highlight'
  )
    return 'light'
  return scheme
}

export function elementFillStyle(element: BoardElement) {
  // Keep old documents readable without rendering the retired dot fill.
  if (element.fillStyle === 'dots') return 'hachure'
  return (
    element.fillStyle ??
    (['rectangle', 'ellipse', 'triangle', 'hexagon'].includes(element.kind) ||
    (element.kind === 'text' &&
      ['rectangle', 'ellipse'].includes(element.textBackground ?? 'none'))
      ? 'hachure'
      : 'solid')
  )
}
