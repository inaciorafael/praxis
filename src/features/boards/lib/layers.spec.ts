import { describe, expect, it } from 'vitest'
import type { BoardElement } from '@/shared/types/board'
import {
  copyLayers,
  defaultLayers,
  editableInLayers,
  orderedLayerElements,
} from './layers'
const element = (id: string, layerId?: string) => ({ id, layerId }) as BoardElement
describe('Paper layers', () => {
  it('projects legacy content onto a default layer without changing the document', () => {
    const legacy = [element('a'), element('b')]
    const before = structuredClone(legacy)
    expect(orderedLayerElements(legacy, defaultLayers())).toEqual(legacy)
    expect(editableInLayers(legacy[0]!, defaultLayers())).toBe(true)
    expect(legacy).toEqual(before)
  })
  it('preserves order within each layer, hides invisible layers and protects locked layers', () => {
    const layers = [
      ...defaultLayers(),
      { id: 'top', name: 'Top', visible: true, locked: true, opacity: 0.5 },
    ]
    const elements = [element('top-1', 'top'), element('base-1'), element('top-2', 'top')]
    expect(orderedLayerElements(elements, layers).map((e) => e.id)).toEqual([
      'base-1',
      'top-1',
      'top-2',
    ])
    expect(editableInLayers(elements[0]!, layers)).toBe(false)
    const changed = copyLayers(layers)
    changed[1]!.visible = false
    expect(orderedLayerElements(elements, changed).map((e) => e.id)).toEqual(['base-1'])
    expect(layers[1]!.visible).toBe(true)
  })
})
