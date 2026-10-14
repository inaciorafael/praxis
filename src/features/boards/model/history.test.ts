import { describe, expect, it } from 'vitest'
import type { BoardElement } from '@/shared/types/board'
import { createHistory } from './history'
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
