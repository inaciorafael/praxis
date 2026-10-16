import type { BoardDrawBrush, BoardElement, BoardPoint } from '@/shared/types/board'
import { sketchSeed } from './sketch'

export const brushPresets: Record<
  BoardDrawBrush,
  { width: number; opacity: number; brush: string; weight: number }
> = {
  graphite: { width: 1.8, opacity: 1, brush: 'HB', weight: 1 },
  fountain: { width: 2.4, opacity: 1, brush: 'HB', weight: 1 },
  ink: { width: 1.6, opacity: 1, brush: 'HB', weight: 1 },
  charcoal: { width: 6, opacity: 0.85, brush: 'charcoal', weight: 0.55 },
  marker: { width: 12, opacity: 0.65, brush: 'marker', weight: 0.5 },
  watercolor: { width: 24, opacity: 0.8, brush: 'HB', weight: 1 },
  spray: { width: 20, opacity: 0.65, brush: 'spray', weight: 0.08 },
}
export type BrushRaster = {
  href: string
  x: number
  y: number
  width: number
  height: number
  elapsed: number
}
const SIZE = 1024
const CACHE_BUDGET = 16 * 1024 * 1024
const cache = new Map<string, BrushRaster>()
let cacheBytes = 0
let engine: Promise<typeof import('p5.brush/standalone')> | undefined
let scratch: HTMLCanvasElement | undefined
let unavailable = false
let queue = Promise.resolve()
let epoch = 0

/** Translation, rotation and opacity do not change the ink texture. */
export function artisticBrushKey(element: BoardElement, color: string) {
  return JSON.stringify([
    element.id,
    element.drawBrush,
    element.strokeWidth ?? 2,
    color,
    element.points,
  ])
}
export function cachedArtisticBrush(element: BoardElement, color: string) {
  const key = artisticBrushKey(element, color),
    raster = cache.get(key)
  if (raster) {
    cache.delete(key)
    cache.set(key, raster)
  }
  return raster
}
export function brushGeometry(element: BoardElement) {
  const width = element.strokeWidth ?? 2
  const margin = Math.max(8, width * 3)
  const points = element.points.length ? element.points : [{ x: 0, y: 0 }]
  const x = Math.min(...points.map((point) => point.x)) - margin
  const y = Math.min(...points.map((point) => point.y)) - margin
  const w = Math.max(1, Math.max(...points.map((point) => point.x)) - x + margin)
  const h = Math.max(1, Math.max(...points.map((point) => point.y)) - y + margin)
  let length = 0
  for (let i = 1; i < points.length; i++)
    length += Math.hypot(points[i]!.x - points[i - 1]!.x, points[i]!.y - points[i - 1]!.y)
  const scale = Math.min(2, (SIZE - 2) / w, (SIZE - 2) / h, 6000 / Math.max(1, length))
  const step = Math.max(1, Math.ceil((points.length - 1) / 180))
  const sampled = points.filter(
    (_, index) => index % step === 0 || index === points.length - 1
  )
  return {
    x,
    y,
    width: w,
    height: h,
    scale,
    pixelWidth: Math.max(1, Math.ceil(w * scale)),
    pixelHeight: Math.max(1, Math.ceil(h * scale)),
    points: sampled.map((point) => ({
      x: (point.x - x) * scale,
      y: (point.y - y) * scale,
      pressure:
        typeof point.pressure === 'number' && Number.isFinite(point.pressure)
          ? Math.max(0.1, Math.min(1, point.pressure))
          : 0.65,
    })),
  }
}
export function brushOutline(points: BoardPoint[], width: number): number[][] {
  const side = (sign: number) =>
    points.map((point, index) => {
      const before = points[Math.max(0, index - 1)]!,
        after = points[Math.min(points.length - 1, index + 1)]!
      const dx = after.x - before.x,
        dy = after.y - before.y,
        length = Math.hypot(dx, dy) || 1
      const radius = (width * (0.25 + (point.pressure ?? 0.65) * 0.75)) / 2
      return [
        point.x - ((sign * dy) / length) * radius,
        point.y + ((sign * dx) / length) * radius,
      ]
    })
  return [...side(1), ...side(-1).reverse()]
}
async function renderer() {
  if (unavailable) throw new Error('WebGL2 unavailable')
  engine ??= import('p5.brush/standalone')
  const brush = await engine
  if (!scratch) {
    scratch = document.createElement('canvas')
    scratch.width = SIZE
    scratch.height = SIZE
    if (
      !scratch.getContext('webgl2', {
        premultipliedAlpha: true,
        preserveDrawingBuffer: true,
      })
    ) {
      unavailable = true
      throw new Error('WebGL2 unavailable')
    }
    brush.load(scratch)
  }
  return brush
}
function remember(key: string, raster: BrushRaster) {
  const bytes = raster.href.length * 2
  while (cache.size && (cacheBytes + bytes > CACHE_BUDGET || cache.size >= 64)) {
    const oldest = cache.keys().next().value!,
      value = cache.get(oldest)!
    cacheBytes -= value.href.length * 2
    cache.delete(oldest)
  }
  if (bytes <= CACHE_BUDGET) {
    cache.set(key, raster)
    cacheBytes += bytes
  }
}
export async function renderArtisticBrush(
  element: BoardElement,
  color: string
): Promise<BrushRaster | null> {
  if (!element.drawBrush) return null
  const cached = cachedArtisticBrush(element, color)
  if (cached) return cached
  const snapshot: BoardElement = JSON.parse(JSON.stringify(element))
  const key = artisticBrushKey(snapshot, color),
    current = epoch
  const task = queue.then(async () => {
    if (current !== epoch) return null
    const alreadyRendered = cachedArtisticBrush(snapshot, color)
    if (alreadyRendered) return alreadyRendered
    // Yield once per committed stroke, never maintain an idle drawing loop.
    await new Promise<void>((resolve) => setTimeout(resolve, 0))
    try {
      const brush = await renderer()
      if (current !== epoch) return null
      const started = performance.now(),
        geometry = brushGeometry(snapshot),
        preset = brushPresets[snapshot.drawBrush!]!
      brush.clear()
      brush.seed(sketchSeed(snapshot.id))
      brush.noiseSeed(sketchSeed(snapshot.id))
      brush.noField()
      brush.noFill()
      brush.noHatch()
      brush.noMass()
      brush.noWash()
      brush.push()
      brush.translate(-SIZE / 2, -SIZE / 2)
      try {
        if (snapshot.drawBrush === 'watercolor') {
          brush.noStroke()
          brush.fill(color, 110)
          brush.fillBleed(0.12, 'out', 0)
          brush.fillTexture(0.25, 0.2)
          if (geometry.points.length < 2)
            brush.circle(
              geometry.points[0]!.x,
              geometry.points[0]!.y,
              ((snapshot.strokeWidth ?? preset.width) * geometry.scale) / 2,
              0.15
            )
          else
            brush.polygon(
              brushOutline(
                geometry.points,
                (snapshot.strokeWidth ?? preset.width) * geometry.scale
              )
            )
        } else {
          brush.set(
            preset.brush,
            color,
            Math.max(
              0.08,
              (snapshot.strokeWidth ?? preset.width) * geometry.scale * preset.weight
            )
          )
          const points = geometry.points.map((point) => [
            point.x,
            point.y,
            0.3 + point.pressure * 0.7,
          ])
          if (points.length === 1)
            points.push([points[0]![0]! + 0.1, points[0]![1]! + 0.1, points[0]![2]!])
          brush.spline(points, 0)
        }
        brush.render()
      } finally {
        brush.pop()
      }
      const crop = document.createElement('canvas')
      crop.width = geometry.pixelWidth
      crop.height = geometry.pixelHeight
      const context = crop.getContext('2d')
      if (!context || !scratch) throw new Error('Unable to capture brush')
      context.drawImage(
        scratch,
        0,
        0,
        crop.width,
        crop.height,
        0,
        0,
        crop.width,
        crop.height
      )
      const raster = {
        href: crop.toDataURL('image/png'),
        x: geometry.x,
        y: geometry.y,
        width: geometry.width,
        height: geometry.height,
        elapsed: performance.now() - started,
      }
      remember(key, raster)
      return raster
    } catch {
      unavailable = true
      return null
    }
  })
  queue = task.then(
    () => undefined,
    () => undefined
  )
  return task
}
export function releaseArtisticBrushes() {
  epoch++
  cache.clear()
  cacheBytes = 0
  queue = queue.then(async () => {
    if (scratch && engine) {
      try {
        ;(await engine).clear()
      } catch {
        scratch = undefined
      }
    }
    unavailable = false
  })
}
export function applyBrushRaster(group: Element, raster: BrushRaster) {
  const image = document.createElementNS('http://www.w3.org/2000/svg', 'image')
  for (const key of ['x', 'y', 'width', 'height'] as const)
    image.setAttribute(key, String(raster[key]))
  image.setAttribute('href', raster.href)
  image.setAttribute('preserveAspectRatio', 'none')
  group.replaceChildren(image)
}
