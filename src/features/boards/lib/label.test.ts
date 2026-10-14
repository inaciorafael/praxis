import { describe, expect, it } from 'vitest'
import type { BoardElement } from '@/shared/types/board'
import {
  BOARD_HANDWRITTEN_FONT,
  BOARD_SANS_FONT,
  labelHighlightPaths,
  labelLayout,
  fitBoardText,
} from './label'

const element = (values: Partial<BoardElement> = {}): BoardElement => ({
  id: 'label-id',
  kind: 'text',
  x: 100,
  y: 200,
  width: 140,
  height: 120,
  text: '',
  color: 'neutral',
  resolved: false,
  points: [],
  startId: null,
  endId: null,
  taskId: null,
  imageData: null,
  ...values,
})
const measure = (text: string) => Array.from(text).length * 10

describe('board text layout and highlights', () => {
  it('keeps legacy text sans and selects the local handwriting font explicitly', () => {
    expect(labelLayout(element(), 'Text', measure).fontFamily).toBe(BOARD_SANS_FONT)
    const layout = labelLayout(element({ textFont: 'handwritten' }), 'Text', measure)
    expect(layout.fontFamily).toBe(BOARD_HANDWRITTEN_FONT)
    expect(layout.fontSize).toBe(22)
    expect(layout.lineHeight).toBe(24)
  })
  it('aligns labels within their container without moving the element', () => {
    const node = element({ kind: 'rectangle', width: 200, height: 120, textAlign: 'center', textVerticalAlign: 'middle' })
    const layout = labelLayout(node, 'hello', measure)
    expect(layout.lines[0]).toMatchObject({ x: 75, y: 64, width: 50 })
    const bottom = labelLayout({ ...node, textAlign: 'right', textVerticalAlign: 'bottom' }, 'hello', measure)
    expect(bottom.lines[0]).toMatchObject({ x: 138, y: 102 })
  })
  it('preserves explicit text containers while growing for overflowing content', () => {
    const node = element({ textBackground: 'rectangle', height: 120 })
    expect(fitBoardText(node, 'small', measure).height).toBe(120)
    expect(fitBoardText(node, 'line\n'.repeat(20), measure).height).toBeGreaterThan(120)
  })
  it('wraps measured words and preserves all free text regardless of height', () => {
    const layout = labelLayout(
      element({ kind: 'note', height: 72 }),
      'hello world again\nnext',
      measure
    )
    expect(layout.lines.map((line) => line.text)).toEqual([
      'hello world',
      'again',
      'next',
    ])
    expect(layout.lines.map((line) => line.y)).toEqual([26, 46, 66])
    expect(
      labelLayout(element({ height: 20 }), 'visible', measure).lines.map(
        (line) => line.text
      )
    ).toEqual(['visible'])
    expect(
      labelLayout(element({ kind: 'note', height: 20 }), 'hidden', measure).lines
    ).toEqual([])
  })
  it('splits long Unicode words without dropping characters', () => {
    const layout = labelLayout(element({ width: 54 }), 'ab😀cd', measure)
    expect(layout.lines.map((line) => line.text)).toEqual(['ab😀', 'cd'])
    expect(layout.lines.every((line) => line.width <= 30)).toBe(true)
  })
  it('highlights only visible nonempty lines and leaves legacy text unmarked', () => {
    const node = element({ kind: 'note', textHighlight: 'yellow', height: 72 })
    const layout = labelLayout(node, 'first\n\nlast\nhidden', measure)
    expect(labelHighlightPaths(node, layout)).toHaveLength(2)
    expect(labelHighlightPaths(element(), layout)).toEqual([])
    expect(
      labelHighlightPaths(node, layout).every(
        (path) => path.stroke === 'none' && path.fill === '#fde875'
      )
    ).toBe(true)
  })
  it('keeps highlights deterministic after movement and distinct between elements', () => {
    const node = element({ textFont: 'handwritten', textHighlight: 'green' })
    const layout = labelLayout(node, 'hand drawn', measure)
    const paths = labelHighlightPaths(node, layout)
    expect(labelHighlightPaths(node, layout)).toEqual(paths)
    expect(labelHighlightPaths({ ...node, x: -500, y: 800 }, layout)).toEqual(paths)
    expect(labelHighlightPaths({ ...node, id: 'different' }, layout)).not.toEqual(paths)
  })
  it('fits automatic width to the longest paragraph and grows for explicit newlines', () => {
    const node = element({ textAutoWidth: true })
    expect(fitBoardText(node, 'hello', measure)).toEqual({ width: 74, height: 36 })
    expect(fitBoardText(node, 'hello\nlonger text\n', measure)).toEqual({
      width: 134,
      height: 72,
    })
    expect(fitBoardText(node, '', measure)).toEqual({ width: 48, height: 36 })
  })
  it('retains manual width and grows enough to display every wrapped line', () => {
    const node = element({ width: 74, height: 36 })
    const text = 'first second third fourth\nfifth'
    const layout = labelLayout(node, text, measure)
    expect(layout.lines.map((line) => line.text).join('')).toBe(
      'first second third fourthfifth'
    )
    expect(fitBoardText(node, text, measure)).toEqual({
      width: 74,
      height: layout.lines.length * 20 + 12,
    })
  })
  it('allows long automatic text lines without imposing a fixed box', () => {
    const node = element({ textAutoWidth: true, textFont: 'handwritten', height: 36 })
    const text = 'x'.repeat(500)
    const dimensions = fitBoardText(node, text, measure)
    const layout = labelLayout(node, text, measure)
    expect(dimensions.width).toBe(5024)
    expect(layout.lines).toHaveLength(1)
    expect(layout.lines.map((line) => line.text).join('')).toBe(text)
    expect(dimensions.height).toBe(layout.lines.length * 24 + 12)
  })
  it('preserves authored indentation, repeated spaces, tabs and blank lines', () => {
    const text = '  first  word\n\n\tsecond'
    const layout = labelLayout(element({ textAutoWidth: true }), text, measure)
    expect(layout.lines.map((line) => line.text)).toEqual([
      '  first  word',
      '',
      '\tsecond',
    ])
  })
})
