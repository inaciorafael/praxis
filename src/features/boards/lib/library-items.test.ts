import { describe, expect, it } from 'vitest'
import { librarySelection, instantiateLibraryItem } from './library-items'
import type { BoardElement } from '@/shared/types/board'
const shape: BoardElement = {
  id: 'shape',
  kind: 'rectangle',
  x: 100,
  y: 100,
  width: 100,
  height: 80,
  text: 'Idea',
  color: 'neutral',
  resolved: false,
  points: [],
  startId: null,
  endId: null,
  taskId: null,
  imageData: null,
  layerId: 'source',
}
describe('personal library copies', () => {
  it('detaches external connections and tasks without altering the original Paper', () => {
    const target = { ...shape, id: 'target', x: 400 }
    const arrow = {
      ...shape,
      id: 'arrow',
      kind: 'arrow' as const,
      text: 'Yes',
      startId: 'shape',
      endId: 'target',
      width: 300,
      height: 0,
    }
    const task = { ...shape, id: 'task', kind: 'task' as const, taskId: 'official-task' }
    const scene = [shape, target, arrow, task],
      before = JSON.stringify(scene)
    const result = librarySelection(scene, ['shape', 'arrow', 'task'])
    expect(result.find((e) => e.id === 'arrow')!.startId).toBe('shape')
    expect(result.find((e) => e.id === 'arrow')!.endId).toBeNull()
    expect(result.find((e) => e.id === 'task')!.kind).toBe('note')
    expect(result.every((e) => e.layerId === null && e.taskId === null)).toBe(true)
    expect(JSON.stringify(scene)).toBe(before)
  })
  it('creates independent IDs, internal links, a group and active-layer membership on each insertion', () => {
    const arrow = {
      ...shape,
      id: 'arrow',
      kind: 'arrow' as const,
      text: 'Yes',
      startId: 'shape',
      width: 150,
      height: 0,
    }
    const source = librarySelection([shape, arrow], ['shape', 'arrow']),
      before = JSON.stringify(source)
    const first = instantiateLibraryItem(source, { x: 500, y: 500 }, 'destination')
    const second = instantiateLibraryItem(source, { x: 500, y: 500 }, 'destination')
    expect(first[1]!.startId).toBe(first[0]!.id)
    expect(first[0]!.id).not.toBe(second[0]!.id)
    expect(first[0]!.groupId).toBe(first[1]!.groupId)
    expect(first[0]!.layerId).toBe('destination')
    first[0]!.text = 'Changed'
    expect(second[0]!.text).toBe('Idea')
    expect(JSON.stringify(source)).toBe(before)
  })
})

it('preserves separate groups and ungrouped items for clipboard copies', () => {
  const source = [
    { ...shape, id: 'a', groupId: 'g' },
    { ...shape, id: 'b', groupId: 'g' },
    { ...shape, id: 'c', groupId: 'other' },
    { ...shape, id: 'd', groupId: null },
  ]
  const result = instantiateLibraryItem(source, { x: 0, y: 0 }, 'base', false)
  expect(result[0]!.groupId).toBe(result[1]!.groupId)
  expect(result[0]!.groupId).not.toBe('g')
  expect(result[2]!.groupId).not.toBe(result[0]!.groupId)
  expect(result[3]!.groupId).toBeNull()
})
