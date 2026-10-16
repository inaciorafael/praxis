import type { BoardElement } from '@/shared/types/board'
import { bounds } from './geometry'

export type Arrangement =
  | 'left'
  | 'center'
  | 'right'
  | 'top'
  | 'middle'
  | 'bottom'
  | 'horizontal'
  | 'vertical'

/** Move geometry, leaving linked connectors to follow their endpoints. */
export function arrangeElements(
  scene: BoardElement[],
  ids: string[],
  action: Arrangement
) {
  const items = scene.filter(
    (element) => ids.includes(element.id) && element.kind !== 'arrow'
  )
  if (items.length < 2) return
  const boxes = items.map((element) => ({ element, box: bounds([element], scene) }))
  const all = bounds(items, scene)
  if (action === 'horizontal' || action === 'vertical') {
    if (items.length < 3) return
    const horizontal = action === 'horizontal'
    const axis = horizontal ? 'x' : 'y'
    const size = horizontal ? 'width' : 'height'
    boxes.sort((a, b) => a.box[axis] - b.box[axis])
    const first = boxes[0]!
    const last = boxes[boxes.length - 1]!
    const extent = last.box[axis] + last.box[size] - first.box[axis]
    const gap =
      (extent - boxes.reduce((sum, item) => sum + item.box[size], 0)) / (boxes.length - 1)
    let position = first.box[axis] + first.box[size] + gap
    for (const item of boxes.slice(1, -1)) {
      item.element[axis] += position - item.box[axis]
      position += item.box[size] + gap
    }
    return
  }
  for (const { element, box } of boxes) {
    if (action === 'left') element.x += all.x - box.x
    if (action === 'center') element.x += all.x + all.width / 2 - box.x - box.width / 2
    if (action === 'right') element.x += all.x + all.width - box.x - box.width
    if (action === 'top') element.y += all.y - box.y
    if (action === 'middle') element.y += all.y + all.height / 2 - box.y - box.height / 2
    if (action === 'bottom') element.y += all.y + all.height - box.y - box.height
  }
}
