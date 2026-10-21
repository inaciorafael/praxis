import type { BoardElement } from '@/shared/types/board'

export function sameValue(left: unknown, right: unknown): boolean {
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
  connectorStyle: element.connectorStyle ?? 'straight',
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
    ...(e.sketch ? { sketch: { ...e.sketch } } : {}),
    points: e.points.map((p) => ({ ...p })),
    ...(e.richText ? { richText: JSON.parse(JSON.stringify(e.richText)) } : {}),
    ...(e.textAnnotation
      ? { textAnnotation: JSON.parse(JSON.stringify(e.textAnnotation)) }
      : {}),
  }))
export const elementSnapshotBytes = (snapshot: BoardElement[]) =>
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
export function createHistory(limit = 100, byteBudget = 20 * 1024 * 1024) {
  return createSnapshotHistory(copyElements, elementSnapshotBytes, limit, byteBudget)
}

export function createSnapshotHistory<T>(
  copy: (snapshot: T) => T,
  bytes: (snapshot: T) => number,
  limit = 100,
  byteBudget = 20 * 1024 * 1024
) {
  type Entry = { snapshot: T; bytes: number }
  const undo: Entry[] = []
  const redo: Entry[] = []
  let totalBytes = 0
  function append(stack: Entry[], snapshot: T) {
    const isolated = copy(snapshot)
    const entry = { snapshot: isolated, bytes: bytes(isolated) }
    stack.push(entry)
    totalBytes += entry.bytes
  }
  function trim() {
    while (
      (totalBytes > byteBudget || undo.length + redo.length > limit) &&
      (undo.length || redo.length)
    ) {
      const removed = undo.length ? undo.shift()! : redo.shift()!
      totalBytes -= removed.bytes
    }
  }
  return {
    get canUndo() {
      return undo.length > 0
    },
    get canRedo() {
      return redo.length > 0
    },
    push(snapshot: T) {
      for (const entry of redo) totalBytes -= entry.bytes
      redo.length = 0
      append(undo, snapshot)
      trim()
    },
    undo(current: T) {
      const previous = undo.pop()
      if (!previous) return null
      totalBytes -= previous.bytes
      append(redo, current)
      trim()
      return previous.snapshot
    },
    redo(current: T) {
      const next = redo.pop()
      if (!next) return null
      totalBytes -= next.bytes
      append(undo, current)
      trim()
      return next.snapshot
    },
    clear() {
      undo.length = 0
      redo.length = 0
      totalBytes = 0
    },
  }
}
