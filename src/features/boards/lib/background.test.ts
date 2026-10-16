import { describe, expect, it } from 'vitest'
import {
  appendPaperBackground,
  paperBackgroundStyle,
  paperInk,
  paperPalette,
  paperTextInk,
} from './background'

describe('Paper backgrounds', () => {
  it('makes arbitrary authored dark text readable while leaving drawings and light mode unchanged', () => {
    const luminance = (hex: string) =>
      [1, 3, 5]
        .map((start) => parseInt(hex.slice(start, start + 2), 16) / 255)
        .reduce(
          (sum, value, index) =>
            sum +
            (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) *
              [0.2126, 0.7152, 0.0722][index]!,
          0
        )
    for (const color of ['#000000', '#1c2924', '#123abc', '#660011', '#263238']) {
      const adapted = paperTextInk(color, 'dark')
      expect(
        (luminance(adapted) + 0.05) / (luminance(paperPalette('dark').paper) + 0.05)
      ).toBeGreaterThanOrEqual(4.5)
      expect(paperTextInk(color, 'light')).toBe(color)
    }
    expect(paperTextInk('#fae2a9', 'dark')).toBe('#fae2a9')
    expect(paperInk('#000000', 'dark')).toBe('#000000')
    expect(paperTextInk('invalid', 'dark')).toBe('invalid')
    for (const [ink, background] of [
      ['#242424', '#707070'],
      ['#ffffff', '#ffffff'],
      ['#e6e6e6', '#f2f5fc'],
      ['#567891', '#999999'],
    ]) {
      const adapted = paperTextInk(ink!, 'light', background)
      const foregroundLuminance = luminance(adapted)
      const backgroundLuminance = luminance(background!)
      expect(
        (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
          (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
      ).toBeGreaterThanOrEqual(4.5)
    }
  })
  it('keeps legacy Papers plain and light and moves guides with world-space camera navigation', () => {
    expect(paperBackgroundStyle().backgroundColor).toBe('#ffffff')
    expect(paperBackgroundStyle().backgroundImage).toBe('none')
    for (const scheme of ['light', 'dark'] as const) {
      for (const pattern of ['grid', 'ruled', 'dots'] as const) {
        const original = paperBackgroundStyle(pattern, scheme)
        const moved = paperBackgroundStyle(pattern, scheme, { x: -43, y: 89, zoom: 2 })
        expect(moved.backgroundPosition).toBe('-43px 89px')
        expect(moved.backgroundSize).toBe(pattern === 'ruled' ? '64px 64px' : '48px 48px')
        expect(moved.backgroundColor).toBe(original.backgroundColor)
        expect(moved.backgroundImage).toContain(paperPalette(scheme).guide)
        expect(moved.backgroundImage).toContain(pattern === 'dots' ? '1.6px' : '2px')
      }
    }
  })

  it('distinguishes a square grid, horizontal notebook lines, dots and a smooth page in both schemes', () => {
    for (const scheme of ['light', 'dark'] as const) {
      expect(paperBackgroundStyle('plain', scheme).backgroundImage).toBe('none')
      expect(paperBackgroundStyle('grid', scheme).backgroundImage).toContain('90deg')
      expect(paperBackgroundStyle('ruled', scheme).backgroundImage).not.toContain('90deg')
      expect(paperBackgroundStyle('ruled', scheme).backgroundImage).toContain(
        'linear-gradient'
      )
      expect(paperBackgroundStyle('dots', scheme).backgroundImage).toContain(
        'radial-gradient'
      )
    }
    expect(paperPalette('dark').paper).not.toBe(paperPalette('light').paper)
    expect(paperPalette('dark').ink).not.toBe(paperPalette('light').ink)
  })

  it('exports the same guide spacing and colors behind drawings, anchored to world coordinates', () => {
    const area = { x: -137, y: -219, width: 840, height: 600 }
    for (const scheme of ['light', 'dark'] as const) {
      for (const background of ['plain', 'grid', 'ruled', 'dots'] as const) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
        const scene = document.createElementNS(svg.namespaceURI, 'g')
        scene.setAttribute('data-scene', '')
        svg.append(scene)
        const rect = appendPaperBackground(svg, area, background, scheme)
        expect(rect.nextElementSibling).toBe(scene)
        for (const [key, value] of Object.entries(area))
          expect(rect.getAttribute(key)).toBe(String(value))
        if (background === 'plain') {
          expect(svg.querySelector('pattern')).toBeNull()
          expect(rect.getAttribute('fill')).toBe(paperPalette(scheme).paper)
          continue
        }
        const pattern = svg.querySelector('pattern')!
        const step = background === 'ruled' ? '32' : '24'
        expect(pattern.getAttribute('patternUnits')).toBe('userSpaceOnUse')
        expect(pattern.getAttribute('width')).toBe(step)
        expect(pattern.getAttribute('height')).toBe(step)
        expect(pattern.querySelector('rect')!.getAttribute('fill')).toBe(
          paperPalette(scheme).paper
        )
        expect(rect.getAttribute('fill')).toBe(`url(#${pattern.id})`)
        if (background === 'dots') {
          expect(pattern.querySelector('circle')!.getAttribute('fill')).toBe(
            paperPalette(scheme).guide
          )
          expect(pattern.querySelector('circle')!.getAttribute('cx')).toBe('12')
          expect(pattern.querySelector('circle')!.getAttribute('r')).toBe('0.8')
        } else {
          const path = pattern.querySelector('path')!
          expect(path.getAttribute('stroke')).toBe(paperPalette(scheme).guide)
          expect(path.getAttribute('stroke-width')).toBe('1')
          expect(path.getAttribute('d')).toBe(
            background === 'grid' ? 'M0 0.5 H24 M0.5 0 V24' : 'M0 0.5 H32'
          )
        }
      }
    }
  })

  it('adapts default inks to dark rendering without changing stored custom colors', () => {
    const stored = { defaultInk: '#252a34', customInk: '#123AbC' }
    expect(paperInk(stored.defaultInk, 'dark')).toBe(paperPalette('dark').ink)
    expect(paperInk(stored.defaultInk, 'light')).toBe(stored.defaultInk)
    expect(paperInk(stored.customInk, 'dark')).toBe(stored.customInk)
    expect(paperInk(stored.customInk, 'light')).toBe(stored.customInk)
    expect(stored).toEqual({ defaultInk: '#252a34', customInk: '#123AbC' })
  })
})
