import type { BoardElement, BoardLayer } from '@/shared/types/board'

export const BASE_LAYER_ID = 'base'
export const MAX_LAYERS = 32
export const defaultLayers = (): BoardLayer[] => [
  { id: BASE_LAYER_ID, name: '', visible: true, locked: false, opacity: 1 },
]
export const copyLayers = (layers?: BoardLayer[]) =>
  (layers?.length ? layers : defaultLayers()).map((layer) => ({ ...layer }))
export const elementLayerId = (element: BoardElement) => element.layerId ?? BASE_LAYER_ID
export const layerFor = (element: BoardElement, layers: BoardLayer[]) =>
  layers.find((layer) => layer.id === elementLayerId(element))
export const editableInLayers = (element: BoardElement, layers: BoardLayer[]) => {
  const layer = layerFor(element, layers)
  return !!layer && layer.visible && layer.opacity > 0 && !layer.locked
}
export function orderedLayerElements(
  elements: BoardElement[],
  layers: BoardLayer[]
): BoardElement[] {
  const buckets = new Map(
    layers
      .filter((layer) => layer.visible && layer.opacity > 0)
      .map((layer) => [layer.id, [] as BoardElement[]])
  )
  for (const element of elements) buckets.get(elementLayerId(element))?.push(element)
  return [...buckets.values()].flat()
}
