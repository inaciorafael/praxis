import { describe, expect, it } from 'vitest'

import { pickTagColorByName, resolveTagColor } from '@/shared/lib/tags/tag-color'

describe('pickTagColorByName', () => {
  it('returns the same color for the same normalized tag name', () => {
    expect(pickTagColorByName('Work')).toEqual(pickTagColorByName(' work '))
  })

  it('returns an e-ink background and text color', () => {
    const color = pickTagColorByName('personal')

    expect(color.background).toMatch(/^rgba\(/)
    expect(color.text).toMatch(/^#[0-9A-F]{6}$/)
  })

  it('uses the persisted color instead of recalculating it from the name', () => {
    const color = resolveTagColor('#A85F1F', 'personal')

    expect(color.key).toBe('rust')
    expect(color.text).toBe('#A85F1F')
  })

  it('creates a soft background for a valid custom persisted color', () => {
    const color = resolveTagColor('#336699', 'custom')

    expect(color.background).toBe('#33669926')
    expect(color.text).toBe('#336699')
  })
})
