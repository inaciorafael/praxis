import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BoardElement } from '@/shared/types/board'

const brush = vi.hoisted(() =>
  Object.fromEntries(
    [
      'load',
      'clear',
      'seed',
      'noiseSeed',
      'noField',
      'noFill',
      'noHatch',
      'noMass',
      'noWash',
      'push',
      'translate',
      'noStroke',
      'fill',
      'fillBleed',
      'fillTexture',
      'circle',
      'polygon',
      'set',
      'spline',
      'render',
      'pop',
    ].map((name) => [name, vi.fn()])
  )
)
vi.mock('p5.brush/standalone', () => brush)
const element = (values: Partial<BoardElement> = {}): BoardElement => ({
  id: 'ink',
  kind: 'draw',
  x: 0,
  y: 0,
  width: 100,
  height: 50,
  text: '',
  color: 'neutral',
  resolved: false,
  points: [
    { x: 0, y: 0, pressure: 0.3 },
    { x: 100, y: 50, pressure: 1 },
  ],
  startId: null,
  endId: null,
  taskId: null,
  imageData: null,
  drawBrush: 'graphite',
  strokeWidth: 2,
  ...values,
})
async function module() {
  return import('./artistic-brush')
}
beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    callback(0)
    return 1
  })
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})
function canvas(webgl = true) {
  const drawImage = vi.fn(),
    loseContext = vi.fn()
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(((
    kind: string
  ) =>
    kind === 'webgl2'
      ? webgl
        ? { getExtension: () => ({ loseContext }) }
        : null
      : { drawImage }) as never)
  vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue(
    'data:image/png;base64,c3Ryb2tl'
  )
  return { drawImage, loseContext }
}
describe('artistic brush geometry and cache identity', () => {
  it('bounds raster dimensions and reduces long stroke sampling while retaining endpoints', async () => {
    const { brushGeometry } = await module()
    const points = Array.from({ length: 2000 }, (_, index) => ({
      x: index * 40,
      y: Math.sin(index) * 700,
    }))
    const geometry = brushGeometry(element({ points, strokeWidth: 32 }))
    expect(geometry.pixelWidth).toBeLessThanOrEqual(1024)
    expect(geometry.pixelHeight).toBeLessThanOrEqual(1024)
    expect(geometry.points.length).toBeLessThanOrEqual(182)
    expect(geometry.x).toBe(-96)
    expect(geometry.width).toBe(points[points.length - 1]!.x + 192)
    expect(geometry.points[0]!.x).toBeCloseTo(96 * geometry.scale)
    expect(geometry.points[geometry.points.length - 1]!.x).toBeCloseTo(
      (points[points.length - 1]!.x + 96) * geometry.scale
    )
  })
  it('normalizes missing, out-of-range and non-finite pressure safely', async () => {
    const { brushGeometry } = await module()
    const geometry = brushGeometry(
      element({
        points: [undefined, -2, 5, NaN, Infinity].map((pressure, index) => ({
          x: index * 10,
          y: 0,
          pressure,
        })),
      })
    )
    expect(
      geometry.points.every(
        (point) =>
          Number.isFinite(point.pressure) && point.pressure >= 0.1 && point.pressure <= 1
      )
    ).toBe(true)
    expect(geometry.points[0]!.pressure).toBe(0.65)
    expect(geometry.points[1]!.pressure).toBe(0.1)
    expect(geometry.points[2]!.pressure).toBe(1)
  })
  it('varies watercolor outline with pressure without modifying input points', async () => {
    const { brushOutline } = await module()
    const low = [
      { x: 0, y: 0, pressure: 0.1 },
      { x: 100, y: 0, pressure: 0.1 },
    ]
    const high = low.map((point) => ({ ...point, pressure: 1 }))
    expect(brushOutline(high, 20)[0]![1]).toBeGreaterThan(brushOutline(low, 20)[0]![1]!)
    expect(low[0]!.y).toBe(0)
  })
  it('reuses ink after translation/rotation/opacity but invalidates changed material/color/pressure', async () => {
    const { artisticBrushKey } = await module()
    const stroke = element(),
      key = artisticBrushKey(stroke, '#123456')
    expect(
      artisticBrushKey({ ...stroke, x: 900, y: -30, angle: 1, opacity: 0.3 }, '#123456')
    ).toBe(key)
    expect(artisticBrushKey({ ...stroke, drawBrush: 'marker' }, '#123456')).not.toBe(key)
    expect(artisticBrushKey(stroke, '#ffffff')).not.toBe(key)
    expect(
      artisticBrushKey(
        {
          ...stroke,
          points: stroke.points.map((point) => ({ ...point, pressure: 0.1 })),
        },
        '#123456'
      )
    ).not.toBe(key)
  })
})
describe('lazy artistic brush rendering', () => {
  it('serializes drawing on one engine and reuses committed snapshots from cache', async () => {
    const { drawImage } = canvas(),
      { renderArtisticBrush, cachedArtisticBrush } = await module()
    const stroke = element(),
      originalPoints = JSON.stringify(stroke.points)
    const [first, duplicate, other] = await Promise.all([
      renderArtisticBrush(stroke, '#123456'),
      renderArtisticBrush(stroke, '#123456'),
      renderArtisticBrush(element({ id: 'other', drawBrush: 'watercolor' }), '#123456'),
    ])
    expect(first?.href).toBe('data:image/png;base64,c3Ryb2tl')
    expect(duplicate).toBe(first)
    expect(other).not.toBeNull()
    expect(brush.load).toHaveBeenCalledTimes(1)
    expect(brush.render).toHaveBeenCalledTimes(2)
    expect(brush.push).toHaveBeenCalledTimes(2)
    expect(brush.pop).toHaveBeenCalledTimes(2)
    expect(brush.spline).toHaveBeenCalledTimes(1)
    expect(brush.polygon).toHaveBeenCalledTimes(1)
    expect(drawImage).toHaveBeenCalledTimes(2)
    expect(cachedArtisticBrush({ ...stroke, x: 20 }, '#123456')).toBe(first)
    expect(JSON.stringify(stroke.points)).toBe(originalPoints)
  })
  it('cancels queued work and clears private ink while retaining one warm graphics context', async () => {
    const { loseContext } = canvas(),
      { renderArtisticBrush, releaseArtisticBrushes, cachedArtisticBrush } =
        await module()
    await renderArtisticBrush(element(), '#123456')
    const pending = renderArtisticBrush(element({ id: 'queued' }), '#123456')
    releaseArtisticBrushes()
    expect(await pending).toBeNull()
    await Promise.resolve()
    await Promise.resolve()
    expect(cachedArtisticBrush(element(), '#123456')).toBeUndefined()
    expect(loseContext).not.toHaveBeenCalled()
    expect(brush.clear).toHaveBeenCalledTimes(2)
    expect(brush.load).toHaveBeenCalledTimes(1)
    expect(brush.render).toHaveBeenCalledTimes(1)
  })
  it('returns a graceful fallback when WebGL2 is unavailable', async () => {
    canvas(false)
    const { renderArtisticBrush } = await module()
    expect(await renderArtisticBrush(element(), '#123456')).toBeNull()
    expect(await renderArtisticBrush(element({ id: 'second' }), '#123456')).toBeNull()
    expect(brush.load).not.toHaveBeenCalled()
    expect(brush.render).not.toHaveBeenCalled()
  })
  it('restores ink from vector data after release on the same bounded graphics surface', async () => {
    const { loseContext } = canvas()
    const { renderArtisticBrush, releaseArtisticBrushes } = await module()
    const stroke = element({ drawBrush: 'marker' })
    const before = await renderArtisticBrush(stroke, '#123456')
    releaseArtisticBrushes()
    const after = await renderArtisticBrush(stroke, '#123456')
    expect(before?.href).toBe(after?.href)
    expect(after).not.toBe(before)
    expect(loseContext).not.toHaveBeenCalled()
    expect(brush.load).toHaveBeenCalledTimes(1)
    expect(brush.clear).toHaveBeenCalledTimes(3)
    expect(brush.render).toHaveBeenCalledTimes(2)
    expect(brush.spline.mock.calls[1]).toEqual(brush.spline.mock.calls[0])
  })
})
