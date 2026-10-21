import type { BoardElement, BoardPoint } from '@/shared/types/board'
import { copyElements } from '../model/history'
import { bounds, connectorPoints } from './geometry'

/** Detach external references while retaining the visual geometry of selected arrows. */
export function librarySelection(scene: BoardElement[], ids: string[]): BoardElement[] {
  const selected = new Set(ids)
  const chosen = copyElements(
    scene.filter((e) => selected.has(e.id) && e.kind !== 'iframe')
  )
  const retained = new Set(chosen.map((e) => e.id))
  for (const e of chosen) {
    if (e.kind === 'arrow') {
      const [a, b] = connectorPoints(e, scene)
      Object.assign(e, { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y, angle: 0 })
      if (!e.startId || !retained.has(e.startId)) e.startId = null
      if (!e.endId || !retained.has(e.endId)) e.endId = null
    }
    e.layerId = null
    e.taskId = null
    if (e.kind === 'task') e.kind = 'note'
  }
  const box = bounds(chosen)
  for (const e of chosen) {
    e.x -= box.x
    e.y -= box.y
  }
  return chosen
}

export function instantiateLibraryItem(
  source: BoardElement[],
  center: BoardPoint,
  layerId: string,
  groupAll = true
) {
  const elements = copyElements(source),
    ids = new Map(elements.map((e) => [e.id, crypto.randomUUID()]))
  const group = groupAll && elements.length > 1 ? crypto.randomUUID() : null
  const groups = new Map(
    elements.filter((e) => e.groupId).map((e) => [e.groupId!, crypto.randomUUID()])
  )
  const box = bounds(elements)
  for (const e of elements) {
    e.id = ids.get(e.id)!
    e.startId = e.startId ? (ids.get(e.startId) ?? null) : null
    e.endId = e.endId ? (ids.get(e.endId) ?? null) : null
    e.groupId = groupAll ? group : e.groupId ? groups.get(e.groupId)! : null
    e.layerId = layerId
    e.taskId = null
    e.x += center.x - box.x - box.width / 2
    e.y += center.y - box.y - box.height / 2
  }
  return elements
}
