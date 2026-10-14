import { RoughGenerator } from 'roughjs/bin/generator'
import type { Options } from 'roughjs/bin/core'
import type { BoardElement, BoardPoint } from '@/shared/types/board'

export type SketchPath = {
  d: string
  stroke: string
  strokeWidth: number
  fill: string
  opacity: number
  dash?: string
  transform?: string
}

const generator = new RoughGenerator()

/** A persisted element id keeps its sketch stable across sessions and movement. */
export function sketchSeed(id: string): number {
  let hash = 2166136261
  for (let index = 0; index < id.length; index++) {
    hash = Math.imul(hash ^ id.charCodeAt(index), 16777619)
  }
  return ((hash >>> 0) % 2147483646) + 1
}

export function arrowHead(start: BoardPoint, end: BoardPoint): BoardPoint[] {
  const distance = Math.hypot(end.x - start.x, end.y - start.y)
  if (distance < 0.001) return []
  const size = Math.min(16, distance * 0.3)
  const angle = Math.atan2(end.y - start.y, end.x - start.x)
  return [
    {
      x: end.x - size * Math.cos(angle - Math.PI / 6),
      y: end.y - size * Math.sin(angle - Math.PI / 6),
    },
    end,
    {
      x: end.x - size * Math.cos(angle + Math.PI / 6),
      y: end.y - size * Math.sin(angle + Math.PI / 6),
    },
  ]
}

/** Geometry is local to the element; the parent owns translation and interaction. */
export function sketchPaths(
  element: BoardElement,
  stroke: string,
  fill: string,
  endpoints?: readonly [BoardPoint, BoardPoint]
): SketchPath[] {
  if (element.kind === 'image') return []
  if (element.kind === 'text') {
    if (!element.textBackground || element.textBackground === 'none') return []
    return sketchPaths({ ...element, kind: element.textBackground }, stroke, fill)
  }
  const style = element.strokeStyle ?? 'clean'
  const clean = style === 'clean'
  const pencil = style === 'pencil'
  const opacity = pencil ? 0.78 : 1
  const strokeWidth = element.strokeWidth ?? (pencil ? 1.5 : 2)
  const dash = element.kind === 'frame' ? '8 6' : undefined
  const options: Options = {
    seed: sketchSeed(element.id),
    stroke,
    fill: fill === 'transparent' ? undefined : fill,
    fillStyle: 'solid',
    strokeWidth,
    roughness: pencil ? 1.35 : 0.55,
    bowing: pencil ? 1.1 : 0.45,
    disableMultiStroke: !pencil,
    preserveVertices: true,
    fixedDecimalPlaceDigits: 3,
  }
  const path = (d: string, pathFill = 'none'): SketchPath => ({
    d,
    stroke,
    strokeWidth: element.strokeWidth ?? 2,
    fill: pathFill,
    opacity,
    dash,
  })
  const rough = (drawable: ReturnType<RoughGenerator['rectangle']>): SketchPath[] =>
    generator.toPaths(drawable).map((info) => ({
      ...info,
      fill: info.fill ?? 'none',
      opacity: info.stroke === 'none' ? 1 : opacity,
      dash: info.stroke === 'none' ? undefined : dash,
    }))
  if (element.kind === 'arrow') {
    const [start, end] = endpoints
      ? (endpoints.map((point) => ({
          x: point.x - element.x,
          y: point.y - element.y,
        })) as [BoardPoint, BoardPoint])
      : [
          { x: 0, y: 0 },
          { x: element.width, y: element.height },
        ]
    const head = arrowHead(start, end)
    if (!head.length) return []
    if (clean)
      return [
        path(`M${start.x} ${start.y} L${end.x} ${end.y}`),
        path(
          `M${head[0]!.x} ${head[0]!.y} L${end.x} ${end.y} L${head[2]!.x} ${head[2]!.y}`
        ),
      ]
    return [
      ...rough(
        generator.line(start.x, start.y, end.x, end.y, { ...options, fill: undefined })
      ),
      ...rough(
        generator.linearPath(
          head.map((point) => [point.x, point.y]),
          { ...options, fill: undefined, seed: sketchSeed(`${element.id}:head`) }
        )
      ),
    ]
  }
  if (element.kind === 'draw') {
    const points = element.points.map((point) => [point.x, point.y] as [number, number])
    if (!points.length) return []
    if (points.length === 1) points.push([points[0]![0] + 0.1, points[0]![1] + 0.1])
    if (clean)
      return [
        path(
          points
            .map((point, index) => `${index ? 'L' : 'M'}${point[0]} ${point[1]}`)
            .join(' ')
        ),
      ]
    const drawingOptions: Options = {
      ...options,
      fill: undefined,
      roughness: pencil ? 0.55 : 0.2,
      maxRandomnessOffset: 0.6,
      bowing: 0.15,
    }
    if (!pencil && points.length > 2)
      return rough(
        generator.curve(points, { ...drawingOptions, disableMultiStroke: true })
      )
    // A pencil follows sampled segments; short pen gestures need only a line.
    return rough(generator.linearPath(points, drawingOptions))
  }
  if (element.kind === 'ellipse') {
    if (clean) {
      const rx = Math.abs(element.width) / 2,
        ry = Math.abs(element.height) / 2
      return [
        path(
          `M0 ${ry} A${rx} ${ry} 0 1 0 ${rx * 2} ${ry} A${rx} ${ry} 0 1 0 0 ${ry} Z`,
          fill
        ),
      ]
    }
    return rough(
      generator.ellipse(
        element.width / 2,
        element.height / 2,
        element.width,
        element.height,
        options
      )
    )
  }
  if (clean) return [path(`M0 0 H${element.width} V${element.height} H0 Z`, fill)]
  return rough(generator.rectangle(0, 0, element.width, element.height, options))
}
