export type GuideBox = { x: number; y: number; width: number; height: number }
export type SmartGuide = {
  x1: number
  y1: number
  x2: number
  y2: number
  kind: 'alignment' | 'spacing'
  label?: string
}
type Axis = 'x' | 'y'
const size = (b: GuideBox, axis: Axis) => (axis === 'x' ? b.width : b.height)
const end = (b: GuideBox, axis: Axis) => b[axis] + size(b, axis)
const other = (axis: Axis): Axis => (axis === 'x' ? 'y' : 'x')
const overlaps = (a: GuideBox, b: GuideBox, axis: Axis) =>
  Math.min(end(a, other(axis)), end(b, other(axis))) >
  Math.max(a[other(axis)], b[other(axis)])
export function createGuideIndex(boxes: GuideBox[]) {
  const sorted = (axis: Axis) => [...boxes].sort((a, b) => a[axis] - b[axis])
  return { x: sorted('x'), y: sorted('y') }
}
export type GuideIndex = ReturnType<typeof createGuideIndex>
type Match = { delta: number; guides: SmartGuide[]; priority: number }

function gapGuide(a: GuideBox, b: GuideBox, axis: Axis): SmartGuide {
  const cross = other(axis)
  const position =
    (Math.max(a[cross], b[cross]) + Math.min(end(a, cross), end(b, cross))) / 2
  const gap = Math.max(0, b[axis] - end(a, axis))
  return axis === 'x'
    ? {
        x1: end(a, axis),
        y1: position,
        x2: b.x,
        y2: position,
        kind: 'spacing',
        label: String(Math.round(gap)),
      }
    : {
        x1: position,
        y1: end(a, axis),
        x2: position,
        y2: b.y,
        kind: 'spacing',
        label: String(Math.round(gap)),
      }
}

/** References are snapshotted/sorted once per drag. No scene mutation or persisted guide state. */
export function smartGuides(
  box: GuideBox,
  index: GuideIndex,
  tolerance: number,
  locked?: Axis
) {
  function match(axis: Axis): Match | undefined {
    if (locked === axis) return
    let best: Match | undefined
    function offer(value: Match) {
      if (Math.abs(value.delta) > tolerance) return
      if (
        !best ||
        Math.abs(value.delta) < Math.abs(best.delta) - 1e-6 ||
        (Math.abs(Math.abs(value.delta) - Math.abs(best.delta)) < 1e-6 &&
          value.priority > best.priority)
      )
        best = value
    }
    const references = index[axis]
    for (const target of references) {
      for (const sourceAnchor of [0, 0.5, 1])
        for (const targetAnchor of [0, 0.5, 1]) {
          const coordinate = target[axis] + size(target, axis) * targetAnchor
          const delta = coordinate - (box[axis] + size(box, axis) * sourceAnchor)
          if (Math.abs(delta) > tolerance) continue
          const cross = other(axis),
            low = Math.min(box[cross], target[cross]) - 12,
            high = Math.max(end(box, cross), end(target, cross)) + 12
          offer({
            delta,
            priority: sourceAnchor === 0.5 && targetAnchor === 0.5 ? 2 : 1,
            guides: [
              axis === 'x'
                ? { x1: coordinate, y1: low, x2: coordinate, y2: high, kind: 'alignment' }
                : {
                    x1: low,
                    y1: coordinate,
                    x2: high,
                    y2: coordinate,
                    kind: 'alignment',
                  },
            ],
          })
        }
    }
    const corridor = references.filter((target) => overlaps(box, target, axis))
    const before = corridor
      .filter((target) => end(target, axis) <= box[axis] + tolerance)
      .reduce<
        GuideBox | undefined
      >((near, target) => (!near || end(target, axis) > end(near, axis) ? target : near), undefined)
    const after = corridor.find((target) => target[axis] >= end(box, axis) - tolerance)
    if (before && after && before !== after) {
      const gap = (after[axis] - end(before, axis) - size(box, axis)) / 2
      if (gap >= 0) {
        const delta = end(before, axis) + gap - box[axis]
        const corrected = { ...box, [axis]: box[axis] + delta }
        offer({
          delta,
          priority: 3,
          guides: [gapGuide(before, corrected, axis), gapGuide(corrected, after, axis)],
        })
      }
    }
    // Reuse the gap between adjacent references before or after the dragged item.
    for (let i = 1; i < corridor.length; i++) {
      const a = corridor[i - 1]!,
        b = corridor[i]!,
        gap = b[axis] - end(a, axis)
      if (gap <= 0 || !overlaps(a, b, axis)) continue
      if (end(b, axis) <= box[axis] + tolerance) {
        const delta = end(b, axis) + gap - box[axis],
          corrected = { ...box, [axis]: box[axis] + delta }
        offer({
          delta,
          priority: 3,
          guides: [gapGuide(a, b, axis), gapGuide(b, corrected, axis)],
        })
      } else if (a[axis] >= end(box, axis) - tolerance) {
        const delta = a[axis] - gap - end(box, axis),
          corrected = { ...box, [axis]: box[axis] + delta }
        offer({
          delta,
          priority: 3,
          guides: [gapGuide(corrected, a, axis), gapGuide(a, b, axis)],
        })
      }
    }
    return best
  }
  const x = match('x'),
    y = match('y')
  return {
    dx: x?.delta ?? 0,
    dy: y?.delta ?? 0,
    guides: [...(x?.guides ?? []), ...(y?.guides ?? [])],
  }
}
