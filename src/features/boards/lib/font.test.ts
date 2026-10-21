import { afterEach, expect, it, vi } from 'vitest'

const originalFonts = Object.getOwnPropertyDescriptor(document, 'fonts')
afterEach(() => {
  vi.unstubAllGlobals()
  if (originalFonts) Object.defineProperty(document, 'fonts', originalFonts)
  else Reflect.deleteProperty(document, 'fonts')
})

it('loads genuine regular and bold faces once and embeds both in handwritten exports', async () => {
  vi.resetModules()
  const add = vi.fn()
  Object.defineProperty(document, 'fonts', { configurable: true, value: { add } })
  const constructed: { weight?: string; style?: string }[] = []
  vi.stubGlobal('FontFace', class {
    constructor(_family: string, _source: string, descriptors: { weight?: string; style?: string }) {
      constructed.push(descriptors)
    }
    async load() { return this }
  })
  const fetchFont = vi.fn(async () => ({ ok: true, blob: async () => new Blob(['font'], { type: 'font/woff2' }) }))
  vi.stubGlobal('fetch', fetchFont)
  const { loadBoardFont, embedBoardFont } = await import('./font')
  await Promise.all([loadBoardFont(), loadBoardFont()])
  expect(constructed).toEqual([{ weight: '400', style: 'normal' }, { weight: '700', style: 'normal' }])
  expect(add).toHaveBeenCalledTimes(2)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  svg.innerHTML = '<text data-handwritten="true" font-weight="700" font-style="italic">Ideias</text>'
  await embedBoardFont(svg)
  expect(svg.querySelector('style')?.textContent).toContain('font-weight:400')
  expect(svg.querySelector('style')?.textContent).toContain('font-weight:700')
  expect(fetchFont).toHaveBeenCalledTimes(2)
  expect(svg.querySelector('text')?.getAttribute('font-style')).toBe('italic')
})
