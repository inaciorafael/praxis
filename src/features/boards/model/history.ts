import type { BoardElement } from '@/shared/types/board'

function sameValue(left: unknown, right: unknown): boolean {
  if (left === right || (left == null && right == null)) return true
  // JSON round trips through Rust can differ by a few floating-point bits.
  // Treat only representation noise as equal; real edits still reset history.
  if (typeof left === 'number' && typeof right === 'number')
    return (
      Number.isFinite(left) &&
      Number.isFinite(right) &&
      Math.abs(left - right) <=
        Number.EPSILON * 4 * Math.max(1, Math.abs(left), Math.abs(right))
    )
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object')
    return false
  if (Array.isArray(left) || Array.isArray(right))
    return (
      Array.isArray(left) &&
      Array.isArray(right) &&
      left.length === right.length &&
      left.every((value, index) => sameValue(value, right[index]))
    )
  const a = left as Record<string, unknown>,
    b = right as Record<string, unknown>
  const keys = Object.keys(a).filter((key) => a[key] != null)
  return (
    keys.length === Object.keys(b).filter((key) => b[key] != null).length &&
    keys.every((key) => sameValue(a[key], b[key]))
  )
}

/** Rust supplies these defaults on save; property order is not a content change. */
const comparableElement = (element: BoardElement) => ({
  ...element,
  angle: element.angle ?? 0,
  opacity: element.opacity ?? 1,
  strokeStyle: element.strokeStyle ?? 'clean',
  textFont: element.textFont ?? 'sans',
  textHighlight: element.textHighlight ?? 'none',
  textBackground: element.textBackground ?? 'none',
  textAlign: element.textAlign ?? 'left',
  textVerticalAlign: element.textVerticalAlign ?? 'top',
  textAutoWidth: element.textAutoWidth ?? false,
})
export function sameElements(left: BoardElement[], right: BoardElement[]): boolean {
  return (
    left.length === right.length &&
    left.every((element, index) =>
      sameValue(comparableElement(element), comparableElement(right[index]!))
    )
  )
}

export const copyElements = (elements: BoardElement[]): BoardElement[] =>
  elements.map((e) => ({
    ...e,
    points: e.points.map((p) => ({ ...p })),
    ...(e.richText ? { richText: JSON.parse(JSON.stringify(e.richText)) } : {}),
    ...(e.textAnnotation
      ? { textAnnotation: JSON.parse(JSON.stringify(e.textAnnotation)) }
      : {}),
  }))
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
        (element.richText ? JSON.stringify(element.richText).length * 2 : 0) +
        (element.textAnnotation ? JSON.stringify(element.textAnnotation).length * 2 : 0) +
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
    get canUndo() {
      return undo.length > 0
    },
    get canRedo() {
      return redo.length > 0
    },
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
