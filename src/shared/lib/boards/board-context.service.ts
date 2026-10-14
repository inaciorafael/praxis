import { invoke } from '@tauri-apps/api/core'
import type { BoardTaskReference } from '@/shared/types/board'
import type { TaskSearchResult } from '@/shared/types/task'
import { todayLocalDate } from '@/shared/lib/tasks/task.rules'

export function listTaskBoardReferences(taskId: string) {
  return invoke<BoardTaskReference[]>('list_task_board_refs', { taskId })
}

export function getBoardTaskDetails(boardId: string, taskId: string) {
  return invoke<TaskSearchResult>('get_board_task_details', { boardId, taskId, today: todayLocalDate() })
}
