import { invoke } from '@tauri-apps/api/core'
import type { Board, BoardSummary } from '@/shared/types/board'
import type { Task } from '@/shared/types/task'
import { todayLocalDate } from '@/shared/lib/tasks/task.rules'

export const listTaskPapers = (taskId: string) =>
  invoke<BoardSummary[]>('list_task_papers', { taskId })

function notifyLinksChanged() {
  window.dispatchEvent(new Event('praxis:paper-links-changed'))
}

export const createTaskPaper = async (taskId: string, title: string, operationId: string) => {
  const paper = await invoke<Board>('create_task_paper', { taskId, title, operationId })
  notifyLinksChanged()
  return paper
}

export const attachTaskPaper = async (taskId: string, paperId: string) => {
  await invoke<void>('attach_task_paper', { taskId, paperId })
  notifyLinksChanged()
}

export const detachTaskPaper = async (taskId: string, paperId: string) => {
  await invoke<void>('detach_task_paper', { taskId, paperId })
  notifyLinksChanged()
}

export const listPaperTaskContexts = (paperId: string) =>
  invoke<Task[]>('list_paper_task_contexts', { paperId, today: todayLocalDate() })
