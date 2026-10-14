import { i18n } from '@/shared/lib/i18n/i18n'

export async function prepareBoardExit(): Promise<boolean> {
  window.dispatchEvent(new Event('praxis:commit-board-edit'))
  const { useBoardStore } = await import('@/stores/board.store')
  const board = useBoardStore()
  if (await board.flush()) return true
  return window.confirm(i18n.global.t('boards.discardUnsaved'))
}

export async function clearBoardMemory() {
  const { useBoardStore } = await import('@/stores/board.store')
  useBoardStore().reset()
}
