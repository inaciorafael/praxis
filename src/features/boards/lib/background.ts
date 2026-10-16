import type { PaperBackground, PaperColorScheme } from '@/shared/types/board'
import type { Camera } from './geometry'

export const paperPalette = (scheme: PaperColorScheme = 'light') =>
  scheme === 'dark'
    ? { paper: '#20242c', guide: '#3d4654', ink: '#e8edf5', muted: '#abb7c9' }
    : { paper: '#ffffff', guide: '#dce3eb', ink: '#252a34', muted: '#646d7b' }

export function paperBackgroundStyle(
  background: PaperBackground = 'plain',
  scheme: PaperColorScheme = 'light',
  camera: Camera = { x: 0, y: 0, zoom: 1 }
) {
  const { paper, guide, ink, muted } = paperPalette(scheme)
  const step = (background === 'ruled' ? 32 : 24) * camera.zoom
  const line = `${guide} ${camera.zoom}px, transparent ${camera.zoom}px`
  const image =
    background === 'grid'
      ? `linear-gradient(${line}), linear-gradient(90deg, ${line})`
      : background === 'ruled'
        ? `linear-gradient(${line})`
        : background === 'dots'
          ? `radial-gradient(${guide} ${0.8 * camera.zoom}px, transparent ${0.9 * camera.zoom}px)`
          : 'none'
  return {
    backgroundColor: paper,
    backgroundImage: image,
    backgroundSize: `${step}px ${step}px`,
    backgroundPosition: `${camera.x}px ${camera.y}px`,
    '--paper-canvas-ink': ink,
    '--paper-canvas-muted': muted,
  }
}

/** Patterns use world coordinates so navigation and export retain the same spacing. */
export function appendPaperBackground(
  svg: SVGSVGElement,
  area: { x: number; y: number; width: number; height: number },
  background: PaperBackground = 'plain',
  scheme: PaperColorScheme = 'light'
) {
  const ns = 'http://www.w3.org/2000/svg'
  const { paper, guide } = paperPalette(scheme)
  const rect = document.createElementNS(ns, 'rect')
  rect.setAttribute('data-paper-background', background)
  for (const [key, value] of Object.entries(area)) rect.setAttribute(key, String(value))
  rect.setAttribute('fill', paper)
  if (background !== 'plain') {
    const step = background === 'ruled' ? 32 : 24
    const defs = document.createElementNS(ns, 'defs')
    const pattern = document.createElementNS(ns, 'pattern')
    pattern.setAttribute('id', 'praxis-paper-pattern')
    pattern.setAttribute('patternUnits', 'userSpaceOnUse')
    pattern.setAttribute('width', String(step))
    pattern.setAttribute('height', String(step))
    const base = document.createElementNS(ns, 'rect')
    base.setAttribute('width', String(step))
    base.setAttribute('height', String(step))
    base.setAttribute('fill', paper)
    pattern.append(base)
    if (background === 'dots') {
      const dot = document.createElementNS(ns, 'circle')
      dot.setAttribute('cx', String(step / 2))
      dot.setAttribute('cy', String(step / 2))
      dot.setAttribute('r', '0.8')
      dot.setAttribute('fill', guide)
      pattern.append(dot)
    } else {
      const path = document.createElementNS(ns, 'path')
      path.setAttribute(
        'd',
        background === 'grid' ? `M0 0.5 H${step} M0.5 0 V${step}` : `M0 0.5 H${step}`
      )
      path.setAttribute('stroke', guide)
      path.setAttribute('stroke-width', '1')
      path.setAttribute('fill', 'none')
      pattern.append(path)
    }
    defs.append(pattern)
    svg.prepend(defs)
    rect.setAttribute('fill', 'url(#praxis-paper-pattern)')
  }
  svg.insertBefore(rect, svg.querySelector('[data-scene]'))
  return rect
}

const darkInk: Record<string, string> = {
  '#252a34': '#e8edf5',
  '#263238': '#e8edf5',
  '#985610': '#e8bb74',
  '#397349': '#96d6a7',
  '#285bb5': '#92b8ff',
  '#b13f60': '#f4a1ba',
  '#7846ac': '#c6a5ef',
}
export function paperInk(color: string, scheme: PaperColorScheme = 'light') {
  return scheme === 'dark' ? (darkInk[color.toLowerCase()] ?? color) : color
}

/** Render-only contrast for authored text; drawing and persisted colors stay intact. */
export function paperTextInk(
  color: string,
  scheme: PaperColorScheme = 'light',
  background?: string
) {
  const hasBackground =
    typeof background === 'string' && /^#[\da-f]{6}$/i.test(background)
  if ((!hasBackground && scheme !== 'dark') || !/^#[\da-f]{6}$/i.test(color)) return color
  const channels = (hex: string) =>
    [1, 3, 5].map((start) => parseInt(hex.slice(start, start + 2), 16))
  const luminance = (rgb: number[]) =>
    rgb.reduce((total, channel, index) => {
      const value = channel / 255
      return (
        total +
        (value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4) *
          [0.2126, 0.7152, 0.0722][index]!
      )
    }, 0)
  const backgroundLuminance = luminance(
    channels(hasBackground ? background! : paperPalette(scheme).paper)
  )
  const original = channels(color)
  const contrast = (ink: number) =>
    (Math.max(ink, backgroundLuminance) + 0.05) /
    (Math.min(ink, backgroundLuminance) + 0.05)
  // Handwritten glyphs have fine strokes: use stronger contrast on dark paper.
  const minimumContrast = hasBackground ? 4.5 : 7
  const readable = (rgb: number[]) => contrast(luminance(rgb)) >= minimumContrast
  if (readable(original)) return color
  const target = contrast(0) > contrast(1) ? 0 : 255
  const mix = (amount: number) =>
    original.map((channel) => Math.round(channel + (target - channel) * amount))
  let low = 0,
    high = 1
  for (let step = 0; step < 16; step++) {
    const middle = (low + high) / 2
    if (readable(mix(middle))) high = middle
    else low = middle
  }
  return `#${mix(high)
    .map((channel) => channel.toString(16).padStart(2, '0'))
    .join('')}`
}
