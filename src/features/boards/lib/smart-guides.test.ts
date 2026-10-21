import { describe, expect, it } from 'vitest'
import { createGuideIndex, smartGuides } from './smart-guides'
const box = (x: number, y = 0, width = 100, height = 100) => ({ x, y, width, height })
describe('smart guides', () => {
  it('matches borders and centers in both directions without mutating geometry', () => {
    const target = box(300, 200),
      moving = box(304, 60),
      original = { ...moving }
    const result = smartGuides(moving, createGuideIndex([target]), 6)
    expect(result.dx).toBe(-4)
    expect(
      result.guides.some((g) => g.kind === 'alignment' && g.x1 === 350 && g.x2 === 350)
    ).toBe(true)
    expect(moving).toEqual(original)
    expect(smartGuides(box(-4, 204), createGuideIndex([box(0, 200)]), 6).dy).toBe(-4)
  })
  it('suggests equal gaps between neighbors', () => {
    const result = smartGuides(box(154), createGuideIndex([box(0), box(300)]), 6)
    expect(result.dx).toBe(-4)
    const gaps = result.guides.filter((g) => g.kind === 'spacing')
    expect(gaps).toHaveLength(2)
    expect(gaps.map((g) => g.label)).toEqual(['50', '50'])
  })
  it('repeats horizontal and vertical spacing before or after two objects', () => {
    expect(smartGuides(box(294), createGuideIndex([box(0), box(150)]), 6).dx).toBe(6)
    expect(smartGuides(box(-146), createGuideIndex([box(0), box(150)]), 6).dx).toBe(-4)
    const result = smartGuides(box(0, 294), createGuideIndex([box(0, 0), box(0, 150)]), 6)
    expect(result.dy).toBe(6)
    expect(result.guides.filter((g) => g.kind === 'spacing').map((g) => g.label)).toEqual(
      ['50', '50']
    )
  })
  it('does not suggest equal spacing for unrelated rows', () => {
    const result = smartGuides(box(294, 500), createGuideIndex([box(0), box(150)]), 6)
    expect(result.guides.filter((g) => g.kind === 'spacing')).toHaveLength(0)
  })
  it('respects locked axes, empty references and zoom-scaled tolerance', () => {
    const index = createGuideIndex([box(0)])
    expect(smartGuides(box(4, 4), index, 6, 'x').dx).toBe(0)
    expect(smartGuides(box(4, 4), index, 3).guides).toHaveLength(0)
    expect(smartGuides(box(10, 10), createGuideIndex([]), 6)).toEqual({
      dx: 0,
      dy: 0,
      guides: [],
    })
  })
})
