import type { BoardPoint, BoardScene } from '@/shared/types/board'
import type { Camera } from './geometry'

export const MAX_SCENES = 100
export type SceneRatio = BoardScene['aspectRatio']
export const copyScenes = (scenes: readonly BoardScene[]) =>
  scenes.map((scene) => ({ ...scene }))
export function sceneBox(start: BoardPoint, end: BoardPoint, aspectRatio: SceneRatio) {
  let width = Math.max(24, Math.abs(end.x - start.x))
  let height = Math.max(24, Math.abs(end.y - start.y))
  if (aspectRatio !== 'free') {
    const ratio = aspectRatio === '16:9' ? 16 / 9 : 4 / 3
    width = Math.max(width, height * ratio)
    height = width / ratio
  }
  return {
    x: end.x < start.x ? start.x - width : start.x,
    y: end.y < start.y ? start.y - height : start.y,
    width,
    height,
  }
}
export function sceneCamera(
  scene: Pick<BoardScene, 'x' | 'y' | 'width' | 'height'>,
  size: { width: number; height: number },
  padding = 0
): Camera {
  const zoom = Math.max(
    0.001,
    Math.min(
      (Math.max(1, size.width) - padding * 2) / scene.width,
      (Math.max(1, size.height) - padding * 2) / scene.height
    )
  )
  return {
    zoom,
    x: size.width / 2 - (scene.x + scene.width / 2) * zoom,
    y: size.height / 2 - (scene.y + scene.height / 2) * zoom,
  }
}
export function sceneAtCamera(
  camera: Camera,
  size: { width: number; height: number },
  aspectRatio: SceneRatio
) {
  const ratio =
    aspectRatio === '16:9'
      ? 16 / 9
      : aspectRatio === '4:3'
        ? 4 / 3
        : size.width / size.height
  const width = Math.min(size.width * 0.75, size.height * 0.75 * ratio) / camera.zoom
  const height = width / ratio
  return {
    x: (size.width / 2 - camera.x) / camera.zoom - width / 2,
    y: (size.height / 2 - camera.y) / camera.zoom - height / 2,
    width,
    height,
  }
}
