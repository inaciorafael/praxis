import type {
  BoardElement,
  PaperBackground,
  PaperColorScheme,
} from '@/shared/types/board'

/** Bounded, read-only projection for library thumbnails; never save as a Board. */
export type BoardPreview = {
  id: string
  revision: number
  background: PaperBackground
  colorScheme: PaperColorScheme
  elements: BoardElement[]
  bounds: { x: number; y: number; width: number; height: number }
}
