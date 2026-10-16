import { invoke } from '@tauri-apps/api/core'
import type { BoardPreview } from '@/features/boards/lib/preview-model'

export const getBoardPreview = (id: string) =>
  invoke<BoardPreview>('get_board_preview', { id })
