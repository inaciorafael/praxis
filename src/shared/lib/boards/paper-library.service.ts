import { invoke } from '@tauri-apps/api/core'
import type { BoardElement } from '@/shared/types/board'
export type PaperLibrarySummary = {
  id: string
  name: string
  revision: number
  elementCount: number
}
export type PaperLibraryItem = Omit<PaperLibrarySummary, 'elementCount'> & {
  elements: BoardElement[]
}
export type PaperLibraryChange =
  | { type: 'add'; id: string; name: string; elements: BoardElement[] }
  | { type: 'rename'; id: string; revision: number; name: string }
  | { type: 'remove'; id: string; revision: number }
export const listPaperLibrary = () => invoke<PaperLibrarySummary[]>('list_paper_library')
export const getPaperLibraryItem = (id: string) =>
  invoke<PaperLibraryItem>('get_paper_library_item', { id })
export const changePaperLibrary = (change: PaperLibraryChange) =>
  invoke<PaperLibrarySummary[]>('change_paper_library', { change })
