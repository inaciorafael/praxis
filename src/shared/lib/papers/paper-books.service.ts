import { invoke } from '@tauri-apps/api/core'

export type PaperBook = { id: string; name: string; revision: number; paperIds: string[] }
export type PaperBookChange =
  | { type: 'create'; name: string }
  | { type: 'rename'; id: string; revision: number; name: string }
  | { type: 'remove'; id: string; revision: number }
  | {
      type: 'move'
      paperId: string
      bookId: string | null
      expectedBookId: string | null
    }

export const listPaperBooks = () => invoke<PaperBook[]>('list_paper_books')
export const changePaperBooks = (change: PaperBookChange) =>
  invoke<PaperBook[]>('change_paper_books', { change })
