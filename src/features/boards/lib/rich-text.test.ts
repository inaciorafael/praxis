import { describe, expect, it } from 'vitest'
import type { BoardElement, BoardRichRun, BoardRichText } from '@/shared/types/board'
import {
  fitRichText,
  layoutRichText,
  plainToRich,
  richHighlightPaths,
  richTextPlain,
} from './rich-text'

const element = {
  id: 'rich',
  kind: 'text',
  x: 0,
  y: 0,
  width: 124,
  height: 36,
  text: '',
  color: 'neutral',
  resolved: false,
  points: [],
  startId: null,
  endId: null,
  taskId: null,
  imageData: null,
} satisfies BoardElement
const run = (text: string, changes: Partial<BoardRichRun> = {}): BoardRichRun => ({
  text,
  bold: false,
  italic: false,
  underline: false,
  font: 'sans',
  fontSize: 14,
  color: '#252a34',
  highlight: 'none',
  ...changes,
})
const document = (runs: BoardRichRun[]): BoardRichText => ({
  paragraphs: [{ align: 'left', list: 'none', runs }],
})
const measure = (text: string, font: string) =>
  (Array.from(text).length * Number(font.match(/(\d+)px/)?.[1])) / 2

describe('rich board text', () => {
  it('draws a continuous marker across words of the same marked phrase', () => {
    const value = document([run('a full marked phrase', { highlight: 'yellow' })])
    const layout = layoutRichText({ ...element, textAutoWidth: true }, value, measure)
    expect(layout.lines[0]!.runs.length).toBeGreaterThan(1)
    expect(richHighlightPaths(element, layout)).toHaveLength(2)
  })
  it('positions rich text vertically while preserving authored paragraph alignment', () => {
    const node: BoardElement = {
      ...element,
      width: 200,
      height: 120,
      textBackground: 'ellipse',
      textAlign: 'right',
      textVerticalAlign: 'middle',
    }
    const value = document([run('abc')])
    value.paragraphs[0]!.align = 'center'
    const layout = layoutRichText(node, value, measure)
    expect(layout.lines[0]!.runs[0]!.x).toBe(89.5)
    expect(layout.lines[0]!.runs[0]!.y).toBe(66)
    expect(layout.height).toBe(120)
    expect(plainToRich('abc', node).paragraphs[0]!.align).toBe('right')
  })
  it('migrates plain paragraphs preserving spacing and inherited handwriting/highlight', () => {
    const value = plainToRich('  hello\n\nworld', {
      ...element,
      textFont: 'handwritten',
      textHighlight: 'pink',
    })
    expect(richTextPlain(value)).toBe('  hello\n\nworld')
    expect(value.paragraphs[0]!.runs[0]).toMatchObject({
      font: 'handwritten',
      fontSize: 22,
      highlight: 'pink',
    })
  })
  it('wraps mixed fonts without losing whitespace, Unicode, or manual line breaks', () => {
    const value = document([
      run('hello  '),
      run('世界😀longword', { fontSize: 24, bold: true, italic: true }),
      run('\n final'),
    ])
    const layout = layoutRichText(element, value, measure)
    expect(
      layout.lines
        .flatMap((line) => line.runs)
        .map((part) => part.text)
        .join('')
    ).toBe(richTextPlain(value).replace(/\n/g, ''))
    expect(layout.lines.length).toBeGreaterThan(2)
    expect(layout.lines.every((line) => line.width <= 100)).toBe(true)
    expect(
      layout.lines
        .flatMap((line) => line.runs)
        .some((part) => part.bold && part.italic && part.fontSize === 24)
    ).toBe(true)
    expect(fitRichText(element, value, measure).height).toBeGreaterThan(36)
  })
  it('uses natural width for automatic text and aligns within manual width', () => {
    const value = document([run('abc')])
    value.paragraphs[0]!.align = 'right'
    expect(layoutRichText(element, value, measure).lines[0]!.runs[0]!.x).toBe(91)
    value.paragraphs[0]!.align = 'center'
    expect(layoutRichText(element, value, measure).lines[0]!.runs[0]!.x).toBe(51.5)
    expect(
      fitRichText(
        { ...element, textAutoWidth: true },
        document([run('long sentence here')]),
        measure
      ).width
    ).toBe(150)
  })
  it('numbers consecutive ordered paragraphs and keeps list prefixes out of plain content', () => {
    const value: BoardRichText = {
      paragraphs: [
        { align: 'left', list: 'ordered', runs: [run('first')] },
        { align: 'left', list: 'ordered', runs: [run('second')] },
        { align: 'left', list: 'bullet', runs: [run('third')] },
      ],
    }
    const layout = layoutRichText({ ...element, textAutoWidth: true }, value, measure)
    expect(
      layout.lines.map((line) => line.runs.map((part) => part.text).join(''))
    ).toEqual(['1. first', '2. second', '• third'])
    expect(richTextPlain(value)).toBe('first\nsecond\nthird')
  })
  it('highlights only marked runs with stable scene geometry', () => {
    const value = document([
      run('normal'),
      run('marked', { highlight: 'yellow', underline: true, color: '#ff0000' }),
    ])
    const layout = layoutRichText({ ...element, textAutoWidth: true }, value, measure)
    const paths = richHighlightPaths(element, layout)
    expect(paths.length).toBeGreaterThan(0)
    expect(paths.every((path) => path.stroke === '#fde875' && path.fill === 'none')).toBe(
      true
    )
    expect(richHighlightPaths({ ...element, x: 900, y: -200 }, layout)).toEqual(paths)
    expect(
      richHighlightPaths(
        element,
        layoutRichText(element, document([run('plain')]), measure)
      )
    ).toEqual([])
  })
})
