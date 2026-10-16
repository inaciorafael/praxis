import type { BoardElement, BoardScene } from '@/shared/types/board'
import { copyElements, createSnapshotHistory, elementSnapshotBytes } from './history'
import { copyScenes } from '../lib/scenes'
export type PaperSnapshot = { elements: BoardElement[]; scenes: BoardScene[] }
export const createPaperHistory = () =>
  createSnapshotHistory<PaperSnapshot>(
    (snapshot) => ({
      elements: copyElements(snapshot.elements),
      scenes: copyScenes(snapshot.scenes),
    }),
    (snapshot) =>
      elementSnapshotBytes(snapshot.elements) +
      snapshot.scenes.reduce((bytes, scene) => bytes + 256 + scene.title.length * 2, 0)
  )
