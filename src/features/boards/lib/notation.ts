import { renderAnnotation } from 'rough-notation/lib/render.js'
import type { BoardAnnotationType, BoardTextAnnotation } from '@/shared/types/board'
import { sketchSeed } from './sketch'

export const annotationTypes: BoardAnnotationType[] = [
  'underline',
  'box',
  'circle',
  'highlight',
  'strike-through',
  'crossed-off',
  'bracket',
]
export function defaultAnnotation(
  type: BoardAnnotationType = 'underline'
): BoardTextAnnotation {
  return {
    type,
    color: type === 'highlight' ? '#fde875' : '#e07a28',
    strokeWidth: 2,
    padding: 5,
    iterations: 2,
    brackets: ['right'],
    animate: false,
    animationDuration: 800,
    animationDelay: 0,
    multiline: true,
    rtl: false,
  }
}
const number = (value: unknown, fallback: number, min: number, max: number) =>
  typeof value === 'number' && Number.isFinite(value)
    ? Math.max(min, Math.min(max, value))
    : fallback
export function safeAnnotation(value: unknown): BoardTextAnnotation | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  if (!annotationTypes.includes(v.type as BoardAnnotationType)) return null
  const defaults = defaultAnnotation(v.type as BoardAnnotationType)
  const padding =
    Array.isArray(v.padding) && [2, 4].includes(v.padding.length)
      ? (v.padding.map((item) => number(item, 5, 0, 24)) as
          | [number, number]
          | [number, number, number, number])
      : number(v.padding, 5, 0, 24)
  const sides = ['top', 'right', 'bottom', 'left'] as const
  const brackets = Array.isArray(v.brackets)
    ? [
        ...new Set(
          v.brackets.filter((side): side is (typeof sides)[number] =>
            sides.includes(side)
          )
        ),
      ]
    : []
  return {
    ...defaults,
    color:
      typeof v.color === 'string' && /^#[\da-f]{6}$/i.test(v.color)
        ? v.color
        : defaults.color,
    strokeWidth: number(v.strokeWidth, 2, 0.5, 8),
    padding,
    iterations: Math.round(number(v.iterations, 2, 1, 4)),
    brackets: brackets.length ? brackets : ['right'],
    animate: v.animate === true,
    animationDuration: Math.round(number(v.animationDuration, 800, 100, 5000)),
    animationDelay: Math.round(number(v.animationDelay, 0, 0, 5000)),
    multiline: v.multiline !== false,
    rtl: v.rtl === true,
  }
}
export type AnnotationRect = { x: number; y: number; width: number; height: number }
export type AnnotationShape = {
  config: BoardTextAnnotation
  rects: AnnotationRect[]
  seed: string
}
export type AnnotationPath = {
  d: string
  stroke: string
  strokeWidth: number
  opacity: number
}
const cache = new Map<string, AnnotationPath[]>()

/** Isolated adapter for the pinned Rough Notation renderer: scene geometry, no layout observers. */
export function notationPaths(shape: AnnotationShape): AnnotationPath[] {
  const key = JSON.stringify(shape)
  const existing = cache.get(key)
  if (existing) return existing
  const paths: AnnotationPath[] = []
  const config = safeAnnotation(shape.config)
  if (!config || typeof document === 'undefined') return paths
  const rects = config.multiline ? shape.rects : [annotationBounds(shape.rects)]
  for (const [index, rect] of rects.entries()) {
    if (rect.width <= 0 || rect.height <= 0) continue
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    renderAnnotation(
      svg,
      { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
      { ...config, animate: false },
      0,
      config.animationDuration,
      sketchSeed(`${shape.seed}:${index}`)
    )
    for (const path of svg.querySelectorAll('path'))
      paths.push({
        d: path.getAttribute('d')!,
        stroke: config.color,
        strokeWidth: Number(path.getAttribute('stroke-width')),
        opacity: config.type === 'highlight' ? 0.65 : 1,
      })
  }
  if (cache.size >= 256) cache.delete(cache.keys().next().value!)
  cache.set(key, paths)
  return paths
}
export function annotationBounds(rects: AnnotationRect[]): AnnotationRect {
  if (!rects.length) return { x: 0, y: 0, width: 0, height: 0 }
  const x = Math.min(...rects.map((rect) => rect.x)),
    y = Math.min(...rects.map((rect) => rect.y))
  return {
    x,
    y,
    width: Math.max(...rects.map((rect) => rect.x + rect.width)) - x,
    height: Math.max(...rects.map((rect) => rect.y + rect.height)) - y,
  }
}

/** Export static final marks even while the on-screen drawing is being animated. */
export function finishNotationExport(svg: SVGSVGElement) {
  svg.querySelectorAll('[data-notation] path').forEach((path) => {
    const style = (path as SVGPathElement).style
    style.removeProperty('stroke-dasharray')
    style.removeProperty('stroke-dashoffset')
    style.removeProperty('animation')
    path.removeAttribute('stroke-dasharray')
    path.removeAttribute('stroke-dashoffset')
  })
}
