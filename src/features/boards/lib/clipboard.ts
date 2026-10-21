import type { BoardElement } from '@/shared/types/board'

export const PAPER_CLIPBOARD_MIME = 'application/x-praxis-paper-elements'
const PREFIX = 'praxis-paper-elements:1\n'
const MAX_BYTES = 20 * 1024 * 1024
export type PaperClipboard = { copyId: string; elements: BoardElement[] }

function withinBudget(value: string) {
  return (
    value.length <= MAX_BYTES && new TextEncoder().encode(value).byteLength <= MAX_BYTES
  )
}
/** The prefix distinguishes Paper data from ordinary text and future formats. */
export function encodePaperClipboard(elements: BoardElement[]): string {
  if (!elements.length || elements.length > 2000) throw new Error('limit')
  const value = PREFIX + JSON.stringify({ copyId: crypto.randomUUID(), elements })
  if (!withinBudget(value)) throw new Error('limit')
  return value
}
export function decodePaperClipboard(value: string): PaperClipboard | null {
  if (!value.startsWith('praxis-paper-elements:')) return null
  if (!value.startsWith(PREFIX) || !withinBudget(value)) throw new Error('invalid')
  let payload: unknown
  try {
    payload = JSON.parse(value.slice(PREFIX.length))
  } catch {
    throw new Error('invalid')
  }
  if (!payload || typeof payload !== 'object') throw new Error('invalid')
  const record = payload as Record<string, unknown>
  if (
    typeof record.copyId !== 'string' ||
    !record.copyId ||
    record.copyId.length > 100 ||
    !Array.isArray(record.elements) ||
    !record.elements.length ||
    record.elements.length > 2000 ||
    record.elements.some((e) => !e || typeof e !== 'object')
  )
    throw new Error('invalid')
  // Rust validates every element before it is used to calculate geometry or mutate the Paper.
  return { copyId: record.copyId, elements: record.elements as BoardElement[] }
}
