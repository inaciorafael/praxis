import { invoke } from '@tauri-apps/api/core'
import type { Board, BoardSummary, BoardTaskResult, CreateBoardInput, SaveBoardInput } from '@/shared/types/board'
import type { Task } from '@/shared/types/task'
import { todayLocalDate } from '@/shared/lib/tasks/task.rules'
import { reloadActiveDataFile } from '@/shared/lib/vault/vault.service'

export const listBoards = () => invoke<BoardSummary[]>('list_boards')
export const reloadBoardVault = () => reloadActiveDataFile()
export const getBoard = (id: string) => invoke<Board>('get_board', { id })
export const createBoard = (input: CreateBoardInput) => invoke<Board>('create_board', { input })
export const saveBoard = (input: SaveBoardInput) => invoke<Board>('save_board', { input })
export const deleteBoard = (id: string, expectedRevision: number) => invoke<void>('delete_board', { id, expectedRevision })
export const getBoardTasks = (boardId: string) => invoke<Task[]>('get_board_tasks', { boardId, today: todayLocalDate() })
export const createBoardTask = (boardId: string, elementId: string, expectedRevision: number, operationId: string, title: string, notes: string | null) =>
  invoke<BoardTaskResult>('create_board_task', { boardId, elementId, expectedRevision, operationId, title, notes })
