import { describe, it, expect } from 'vitest'
import { sceneBox, sceneCamera, sceneAtCamera } from './scenes'
describe('Paper scene geometry', () => {
  it('frames reverse drags and constrains scene proportions', () => {
    const box = sceneBox({ x: 300, y: 200 }, { x: 100, y: 80 }, '16:9')
    expect(box.width / box.height).toBeCloseTo(16 / 9)
    expect(box.x + box.width).toBe(300)
    expect(box.y + box.height).toBe(200)
    expect(sceneBox({ x: 0, y: 0 }, { x: 100, y: 90 }, 'free')).toEqual({
      x: 0,
      y: 0,
      width: 100,
      height: 90,
    })
  })
  it('fits an entire scene in wide and tall viewports with letterboxing', () => {
    const scene = { x: -400, y: 200, width: 1600, height: 900 }
    for (const size of [
      { width: 1200, height: 600 },
      { width: 500, height: 900 },
    ]) {
      const camera = sceneCamera(scene, size)
      expect(scene.x * camera.zoom + camera.x).toBeGreaterThanOrEqual(-0.000001)
      expect(scene.y * camera.zoom + camera.y).toBeGreaterThanOrEqual(-0.000001)
      expect((scene.x + scene.width) * camera.zoom + camera.x).toBeLessThanOrEqual(
        size.width + 0.000001
      )
      expect((scene.y + scene.height) * camera.zoom + camera.y).toBeLessThanOrEqual(
        size.height + 0.000001
      )
    }
  })
  it('creates a scene centered on the current camera without moving content', () => {
    const camera = { x: 70, y: -100, zoom: 2 },
      size = { width: 800, height: 600 }
    const box = sceneAtCamera(camera, size, '4:3')
    expect((box.x + box.width / 2) * camera.zoom + camera.x).toBeCloseTo(400)
    expect((box.y + box.height / 2) * camera.zoom + camera.y).toBeCloseTo(300)
    expect(box.width / box.height).toBeCloseTo(4 / 3)
  })
})
