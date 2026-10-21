import { invoke } from '@tauri-apps/api/core'
import type { BoardElement } from '@/shared/types/board'

export const validatePaperClipboard = (elements: BoardElement[]) =>
  invoke<BoardElement[]>('validate_paper_clipboard', { elements })
