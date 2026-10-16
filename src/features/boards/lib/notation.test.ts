import { describe, expect, it } from 'vitest'
import {
  annotationBounds,
  annotationTypes,
  defaultAnnotation,
  finishNotationExport,
  notationPaths,
  safeAnnotation,
} from './notation'

const rects = [
  { x: 10, y: 20, width: 100, height: 25 },
  { x: 10, y: 55, width: 60, height: 25 },
]
describe('Rough Notation scene adapter', () => {
  it('rejects unsupported types and bounds corrupt persisted configuration', () => {
    expect(safeAnnotation({ type: 'unknown' })).toBeNull()
    expect(safeAnnotation(null)).toBeNull()
    expect(
      safeAnnotation({
        type: 'box',
        color: 'url(unsafe)',
        strokeWidth: 100,
        padding: [-1, 100, NaN, 7],
        iterations: 99,
        animationDuration: 1,
        animationDelay: Infinity,
        brackets: ['top', 'top', 'invalid'],
        multiline: false,
        rtl: true,
        animate: true,
      })
    ).toEqual({
      ...defaultAnnotation('box'),
      strokeWidth: 8,
      padding: [0, 24, 5, 7],
      iterations: 4,
      animationDuration: 100,
      animationDelay: 0,
      brackets: ['top'],
      multiline: false,
      rtl: true,
      animate: true,
    })
    expect(
      safeAnnotation({
        type: 'highlight',
        strokeWidth: NaN,
        padding: [1, 2, 3],
        iterations: -5,
        animationDuration: 9000,
        animationDelay: -10,
        brackets: [],
      })
    ).toMatchObject({
      color: '#fde875',
      strokeWidth: 2,
      padding: 5,
      iterations: 1,
      animationDuration: 5000,
      animationDelay: 0,
      brackets: ['right'],
    })
  })
  it.each(annotationTypes)(
    'renders real %s paths deterministically without animation artifacts',
    (type) => {
      const config = { ...defaultAnnotation(type), iterations: 3, animate: true }
      const first = notationPaths({ config, rects, seed: 'text-example' })
      expect(first.length).toBeGreaterThan(0)
      expect(
        first.every((path) => path.d.startsWith('M') && !/NaN|Infinity/.test(path.d))
      ).toBe(true)
      expect(
        first.every((path) => path.stroke === config.color && path.strokeWidth > 0)
      ).toBe(true)
      expect(
        first.every((path) => path.opacity === (type === 'highlight' ? 0.65 : 1))
      ).toBe(true)
      // A different animation option bypasses the cache while keeping final geometry identical.
      expect(
        notationPaths({
          config: { ...config, animate: false, animationDelay: 200 },
          rects,
          seed: 'text-example',
        })
      ).toEqual(first)
      expect(notationPaths({ config, rects, seed: 'another-element' })).not.toEqual(first)
    }
  )
  it('honors padding, brackets and right-to-left drawing', () => {
    const box = defaultAnnotation('box')
    expect(
      notationPaths({ config: { ...box, padding: [1, 2, 3, 4] }, rects, seed: 'padding' })
    ).not.toEqual(
      notationPaths({ config: { ...box, padding: 0 }, rects, seed: 'padding' })
    )
    const bracket = defaultAnnotation('bracket')
    const right = notationPaths({ config: bracket, rects, seed: 'bracket' })
    const both = notationPaths({
      config: { ...bracket, brackets: ['left', 'right'] },
      rects,
      seed: 'bracket',
    })
    expect(both.length).toBe(right.length * 2)
    const underline = { ...defaultAnnotation(), iterations: 1 }
    expect(
      notationPaths({ config: { ...underline, rtl: true }, rects, seed: 'rtl' })
    ).not.toEqual(notationPaths({ config: underline, rects, seed: 'rtl' }))
  })
  it('draws each visual line or one enclosing rectangle and skips empty geometry', () => {
    const config = defaultAnnotation('box')
    expect(annotationBounds(rects)).toEqual({ x: 10, y: 20, width: 100, height: 60 })
    const perLine = notationPaths({ config, rects, seed: 'multiline' })
    const whole = notationPaths({
      config: { ...config, multiline: false },
      rects,
      seed: 'multiline',
    })
    expect(perLine.length).toBe(whole.length * 2)
    expect(whole).toEqual(
      notationPaths({
        config: { ...config, multiline: false },
        rects: [annotationBounds(rects)],
        seed: 'multiline',
      })
    )
    expect(notationPaths({ config, rects: [], seed: 'empty' })).toEqual([])
    expect(
      notationPaths({
        config,
        rects: [{ x: 0, y: 0, width: 0, height: 4 }],
        seed: 'zero',
      })
    ).toEqual([])
  })
  it('exports complete static annotations while preserving unrelated dashed scene paths', () => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    svg.innerHTML =
      '<g data-notation><path d="M0 0 L20 0" stroke-dasharray="20" stroke-dashoffset="10" style="stroke-dasharray:20;stroke-dashoffset:10;animation:draw 800ms;color:red" /></g><path data-connector stroke-dasharray="4 4" />'
    finishNotationExport(svg)
    const annotation = svg.querySelector('[data-notation] path') as SVGPathElement
    expect(annotation.hasAttribute('stroke-dasharray')).toBe(false)
    expect(annotation.hasAttribute('stroke-dashoffset')).toBe(false)
    expect(annotation.style.strokeDasharray).toBe('')
    expect(annotation.style.strokeDashoffset).toBe('')
    expect(annotation.style.animation).toBe('')
    expect(annotation.style.color).toBe('red')
    expect(annotation.getAttribute('d')).toBe('M0 0 L20 0')
    expect(svg.querySelector('[data-connector]')?.getAttribute('stroke-dasharray')).toBe(
      '4 4'
    )
  })
})
