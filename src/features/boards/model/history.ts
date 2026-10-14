import type { BoardElement } from '@/shared/types/board'

export const copyElements = (elements: BoardElement[]): BoardElement[] =>
  elements.map((e) => ({ ...e, points: e.points.map((p) => ({ ...p })) }))
export function createHistory(limit = 100, byteBudget = 20 * 1024 * 1024) {
  const undo: BoardElement[][] = []
  const redo: BoardElement[][] = []
  const bytes = (snapshot: BoardElement[]) =>
    snapshot.reduce(
      (total, element) =>
        total +
        256 +
        element.text.length * 2 +
        (element.imageData?.length ?? 0) * 2 +
        element.points.length * 16,
      0
    )
  function trim() {
    let total = [...undo, ...redo].reduce((sum, snapshot) => sum + bytes(snapshot), 0)
    while (
      (total > byteBudget || undo.length + redo.length > limit) &&
      (undo.length || redo.length)
    ) {
      const removed = undo.length ? undo.shift()! : redo.shift()!
      total -= bytes(removed)
    }
  }
  return {
    push(elements: BoardElement[]) {
      undo.push(copyElements(elements))
      redo.length = 0
      trim()
    },
    undo(current: BoardElement[]) {
      const previous = undo.pop()
      if (!previous) return null
      redo.push(copyElements(current))
      trim()
      return previous
    },
    redo(current: BoardElement[]) {
      const next = redo.pop()
      if (!next) return null
      undo.push(copyElements(current))
      trim()
      return next
    },
    clear() {
      undo.length = 0
      redo.length = 0
    },
  }
}
