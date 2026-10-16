import { RoughGenerator } from 'roughjs/bin/generator'
import type { Drawable, Options } from 'roughjs/bin/core'
import type { BoardElement, BoardPoint } from '@/shared/types/board'
import { writingPaths } from './writing'
import { polygonVertices } from './geometry'
import { elementFillStyle } from './element-style'
import { DEFAULT_SKETCH_OPTIONS } from './sketch-options'

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

/** Sample the imperfect RoughJS outline, then deposit the same ink used by the
 * freehand tools. Merge matching fibers to keep SVG node counts bounded. */
function materialOutline(
  drawable: Drawable,
  element: BoardElement,
  color: string
): SketchPath[] {
  const merged = new Map<string, SketchPath>()
  let points: BoardPoint[] = []
  const flush = () => {
    if (!points.length) return
    const pencil = element.strokeStyle === 'pencil'
    const paths = writingPaths(
      {
        ...element,
        points,
        strokeWidth: element.strokeWidth ?? (pencil ? 1.5 : 2),
        drawBrush: pencil ? undefined : 'ink',
      },
      color,
      pencil
    )
    for (const path of paths) {
      const key = JSON.stringify([
        path.stroke,
        path.fill,
        path.strokeWidth,
        path.opacity,
        path.dash,
      ])
      const existing = merged.get(key)
      if (existing) existing.d += ` ${path.d}`
      else merged.set(key, { ...path })
    }
    points = []
  }
  for (const set of drawable.sets) {
    if (set.type !== 'path') continue
    for (const op of set.ops) {
      const d = op.data
      if (op.op === 'move') {
        flush()
        points.push({ x: d[0]!, y: d[1]! })
      } else if (op.op === 'lineTo') points.push({ x: d[0]!, y: d[1]! })
      else if (op.op === 'bcurveTo' && points.length) {
        const start = points[points.length - 1]!
        const length =
          Math.hypot(d[0]! - start.x, d[1]! - start.y) +
          Math.hypot(d[2]! - d[0]!, d[3]! - d[1]!) +
          Math.hypot(d[4]! - d[2]!, d[5]! - d[3]!)
        const steps = Math.max(3, Math.min(24, Math.ceil(length / 10)))
        for (let step = 1; step <= steps; step++) {
          const t = step / steps,
            u = 1 - t
          points.push({
            x:
              u ** 3 * start.x +
              3 * u ** 2 * t * d[0]! +
              3 * u * t ** 2 * d[2]! +
              t ** 3 * d[4]!,
            y:
              u ** 3 * start.y +
              3 * u ** 2 * t * d[1]! +
              3 * u * t ** 2 * d[3]! +
              t ** 3 * d[5]!,
          })
        }
      }
    }
  }
  flush()
  return [...merged.values()]
}

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
  const settings = element.sketch ?? DEFAULT_SKETCH_OPTIONS
  const dash =
    settings.strokePattern === 'dashed'
      ? `${strokeWidth * 4} ${strokeWidth * 3}`
      : settings.strokePattern === 'dotted'
        ? `0 ${strokeWidth * 3}`
        : element.kind === 'frame' && !element.sketch
          ? '8 6'
          : undefined
  const hatched =
    ['rectangle', 'ellipse', 'triangle', 'hexagon'].includes(element.kind) ||
    !!element.fillStyle
  const options: Options = {
    seed: sketchSeed(element.id),
    stroke,
    fill: fill === 'transparent' || hatched ? undefined : fill,
    fillStyle: 'solid',
    strokeWidth,
    roughness: (pencil ? 1.85 : 0.55) * settings.roughness,
    bowing: (pencil ? 1.6 : 0.45) * settings.bowing,
    disableMultiStroke: !pencil,
    // Shapes can have imperfect corners; linked arrow tips keep exact anchors.
    preserveVertices: !pencil || element.kind === 'arrow',
    ...(pencil
      ? {
          maxRandomnessOffset: Math.min(
            2,
            Math.max(
              0.5,
              Math.min(Math.abs(element.width), Math.abs(element.height)) / 24
            )
          ),
        }
      : {}),
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
  const withFill = (outline: SketchPath[]): SketchPath[] => {
    if (!hatched || fill === 'transparent' || fill === 'none') return outline
    const fillOptions: Options = {
      ...options,
      stroke: 'none',
      fill,
      fillStyle: elementFillStyle(element),
      hachureAngle: settings.hachureAngle,
      // Bound the number of hatch lines even for very large shapes.
      hachureGap: Math.max(
        settings.hachureGap,
        Math.max(Math.abs(element.width), Math.abs(element.height)) / 180
      ),
      fillWeight: 0.85,
      roughness: pencil ? 0.65 : 0.35,
      disableMultiStrokeFill: true,
    }
    const vertices = polygonVertices(element)
    const drawing =
      element.kind === 'ellipse'
        ? generator.ellipse(
            element.width / 2,
            element.height / 2,
            element.width,
            element.height,
            fillOptions
          )
        : vertices
          ? generator.polygon(
              vertices.map((p) => [p.x, p.y]),
              fillOptions
            )
          : generator.rectangle(0, 0, element.width, element.height, fillOptions)
    return [
      ...generator
        .toPaths(drawing)
        .map((info) => ({ ...info, fill: info.fill ?? 'none', opacity: 1 })),
      ...outline,
    ]
  }
  const rough = (drawable: ReturnType<RoughGenerator['rectangle']>): SketchPath[] => {
    const paths = generator.toPaths(drawable).map((info) => ({
      ...info,
      fill: info.fill ?? 'none',
      opacity: info.stroke === 'none' ? 1 : opacity,
      dash: info.stroke === 'none' ? undefined : dash,
    }))
    // Dashed borders must remain stroked paths: ink contours are filled polygons.
    if (dash || element.kind === 'draw' || element.kind === 'frame') return paths
    return [
      ...paths.filter((info) => info.stroke === 'none'),
      ...materialOutline(drawable, element, stroke),
    ]
  }
  if (element.kind === 'line') {
    if (clean) return [path(`M0 0 L${element.width} ${element.height}`)]
    return rough(
      generator.line(0, 0, element.width, element.height, { ...options, fill: undefined })
    )
  }
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
    if (pencil && !element.drawBrush) return writingPaths(element, stroke, true)
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
      roughness: pencil ? 0.55 : 0.35,
      maxRandomnessOffset: 0.8,
      bowing: 0.2,
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
      return withFill([
        path(
          `M0 ${ry} A${rx} ${ry} 0 1 0 ${rx * 2} ${ry} A${rx} ${ry} 0 1 0 0 ${ry} Z`,
          'none'
        ),
      ])
    }
    return withFill(
      rough(
        generator.ellipse(
          element.width / 2,
          element.height / 2,
          element.width,
          element.height,
          options
        )
      )
    )
  }
  const vertices = polygonVertices(element)
  if (vertices) {
    if (clean)
      return withFill([
        path(
          vertices
            .map((point, index) => `${index ? 'L' : 'M'}${point.x} ${point.y}`)
            .join(' ') + ' Z',
          'none'
        ),
      ])
    return withFill(
      rough(
        generator.polygon(
          vertices.map((point) => [point.x, point.y]),
          options
        )
      )
    )
  }
  if (clean)
    return withFill([
      path(`M0 0 H${element.width} V${element.height} H0 Z`, hatched ? 'none' : fill),
    ])
  return withFill(
    rough(generator.rectangle(0, 0, element.width, element.height, options))
  )
}
