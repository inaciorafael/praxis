import { describe, expect, it } from 'vitest'
import type { BoardElement } from '@/shared/types/board'
import { createHistory, createSnapshotHistory, sameElements } from './history'
import { plainToRich } from '../lib/rich-text'
import { defaultAnnotation } from '../lib/notation'
const item = (text: string): BoardElement[] => [
  {
    id: 'a',
    kind: 'note',
    x: 0,
    y: 0,
    width: 100,
    height: 80,
    text,
    color: 'neutral',
    resolved: false,
    points: [{ x: 1, y: 2 }],
    startId: null,
    endId: null,
    taskId: null,
    imageData: null,
  },
]
describe('bounded board history', () => {
  it('measures each isolated entry once and preserves budgets across undo, redo, branching and clear', () => {
    let calls = 0
    const history = createSnapshotHistory(
      (value: string) => value,
      (value) => {
        calls++
        return value.length
      },
      100,
      10
    )
    for (let i = 0; i < 4; i++) history.push('123')
    expect(calls).toBe(4)
    expect(history.undo('456')).toBe('123')
    expect(history.redo('789')).toBe('456')
    expect(calls).toBe(6)
    history.undo('abc')
    history.push('def')
    expect(history.canRedo).toBe(false)
    expect(calls).toBe(8)
    history.clear()
    history.push('1234567890')
    expect(history.canUndo).toBe(true)
    history.push('x')
    expect(history.undo('y')).toBe('x')
    expect(history.canUndo).toBe(false)
  })
  it('ignores numeric representation noise without hiding actual geometry or text edits', () => {
    const original = item('initial')
    original[0]!.x = 123.456789
    const saved = item('initial')
    saved[0]!.x = original[0]!.x + Number.EPSILON * original[0]!.x
    expect(sameElements(original, saved)).toBe(true)
    saved[0]!.x = original[0]!.x + 0.000001
    expect(sameElements(original, saved)).toBe(false)
    saved[0]!.x = original[0]!.x
    saved[0]!.text = 'changed'
    expect(sameElements(original, saved)).toBe(false)
  })
  it('isolates rich text and nested annotation options across undo and redo', () => {
    const history = createHistory()
    const initial = item('initial')
    initial[0]!.richText = plainToRich('initial', initial[0]!)
    initial[0]!.textAnnotation = { ...defaultAnnotation('bracket'), padding: [2, 4] }
    initial[0]!.richText.paragraphs[0]!.runs[0]!.annotation = defaultAnnotation('circle')
    history.push(initial)
    initial[0]!.richText.paragraphs[0]!.runs[0]!.fontSize = 40
    initial[0]!.richText.paragraphs[0]!.runs[0]!.annotation!.color = '#123456'
    initial[0]!.textAnnotation.brackets.push('left')
    ;(initial[0]!.textAnnotation.padding as number[])[0] = 20
    const previous = history.undo(initial)!
    expect(previous[0]!.richText!.paragraphs[0]!.runs[0]).toMatchObject({
      fontSize: 14,
      annotation: { color: '#e07a28' },
    })
    expect(previous[0]!.textAnnotation).toMatchObject({
      padding: [2, 4],
      brackets: ['right'],
    })
    initial[0]!.richText.paragraphs[0]!.runs[0]!.fontSize = 70
    const next = history.redo(previous)!
    expect(next[0]!.richText!.paragraphs[0]!.runs[0]!.fontSize).toBe(40)
    expect(history.canRedo).toBe(false)
    expect(history.canUndo).toBe(true)
  })
  it('includes rich text and annotations in the memory budget', () => {
    const history = createHistory(100, 1000)
    const snapshot = item('short')
    snapshot[0]!.richText = plainToRich('x'.repeat(1000), snapshot[0]!)
    history.push(snapshot)
    expect(history.canUndo).toBe(false)
  })
  it('keeps independent geometry snapshots and invalidates redo on a new edit', () => {
    const history = createHistory()
    const initial = item('initial')
    history.push(initial)
    initial[0]!.points[0]!.x = 400
    const previous = history.undo(item('new'))!
    expect(previous[0]!.points[0]!.x).toBe(1)
    expect(history.redo(previous)?.[0]?.text).toBe('new')
    history.undo(item('new'))
    history.push(item('branch'))
    expect(history.redo(item('branch'))).toBeNull()
  })
  it('evicts old snapshots at both count and byte limits', () => {
    const history = createHistory(2)
    for (const text of ['one', 'two', 'three']) history.push(item(text))
    expect(history.undo(item('four'))?.[0]?.text).toBe('three')
    expect(history.undo(item('three'))?.[0]?.text).toBe('two')
    expect(history.undo(item('two'))).toBeNull()
    const small = createHistory(100, 300)
    small.push(item('a'.repeat(1000)))
    expect(small.undo(item('current'))).toBeNull()
  })
})

it('treats backend connector defaults as the same state for every element kind', () => {
  const original = item('text')
  const saved = original.map((element) => ({
    ...element,
    connectorStyle: 'straight' as const,
  }))
  expect(sameElements(original, saved)).toBe(true)
  expect(
    sameElements(
      original,
      saved.map((element) => ({ ...element, connectorStyle: 'curve' as const }))
    )
  ).toBe(false)
})
