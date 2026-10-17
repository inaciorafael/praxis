import type { BoardElement, BoardScene, BoardLayer } from '@/shared/types/board'
import { copyElements, createSnapshotHistory, elementSnapshotBytes } from './history'
import { copyScenes } from '../lib/scenes'
export type PaperSnapshot = {
  elements: BoardElement[]
  scenes: BoardScene[]
  layers?: BoardLayer[]
}
export const createPaperHistory = () =>
  createSnapshotHistory<PaperSnapshot>(
    (snapshot) => ({
      elements: copyElements(snapshot.elements),
      scenes: copyScenes(snapshot.scenes),
      ...(snapshot.layers
        ? { layers: snapshot.layers.map((layer) => ({ ...layer })) }
        : {}),
    }),
    (snapshot) =>
      elementSnapshotBytes(snapshot.elements) +
      (snapshot.layers?.length ?? 0) * 256 +
      snapshot.scenes.reduce((bytes, scene) => bytes + 256 + scene.title.length * 2, 0)
  )
