import fontUrl from '@fontsource/caveat/files/caveat-latin-400-normal.woff2?url'
import boldFontUrl from '@fontsource/caveat/files/caveat-latin-700-normal.woff2?url'

const faces = [{ url: fontUrl, weight: '400' }, { url: boldFontUrl, weight: '700' }]

let fontLoad: Promise<void> | undefined
let fontData: Promise<string[]> | undefined

export function loadBoardFont(): Promise<void> {
  if (typeof FontFace === 'undefined' || !document.fonts) return Promise.resolve()
  fontLoad ??= (async () => {
    const loaded = await Promise.all(faces.map(async ({ url, weight }) => {
      const font = new FontFace('Praxis Caveat', `url("${url}")`, { weight, style: 'normal' })
      await font.load()
      return font
    }))
    for (const font of loaded) document.fonts.add(font)
  })().catch((error) => {
    fontLoad = undefined
    throw error
  })
  return fontLoad
}

/** SVG images cannot resolve the app's external font assets. Embed the same font. */
export async function embedBoardFont(svg: SVGSVGElement): Promise<void> {
  if (!svg.querySelector('[data-handwritten]')) return
  await loadBoardFont()
  fontData ??= Promise.all(faces.map(async ({ url }) => {
    const response = await fetch(url)
    if (!response.ok) throw new Error('Board font unavailable')
    const blob = await response.blob()
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Board font unavailable'))
      reader.readAsDataURL(blob)
    })
  })).catch((error) => {
    fontData = undefined
    throw error
  })
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  const data = await fontData
  style.textContent = faces.map((face, index) => `@font-face{font-family:'Praxis Caveat';src:url('${data[index]}') format('woff2');font-weight:${face.weight};font-style:normal;}`).join('')
  svg.insertBefore(style, svg.firstChild)
}
