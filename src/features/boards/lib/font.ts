import fontUrl from '@fontsource/caveat/files/caveat-latin-400-normal.woff2?url'

let fontLoad: Promise<void> | undefined
let fontData: Promise<string> | undefined

export function loadBoardFont(): Promise<void> {
  if (typeof FontFace === 'undefined' || !document.fonts) return Promise.resolve()
  fontLoad ??= (async () => {
    const font = new FontFace('Praxis Caveat', `url("${fontUrl}")`, { weight: '400' })
    await font.load()
    document.fonts.add(font)
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
  fontData ??= (async () => {
    const response = await fetch(fontUrl)
    if (!response.ok) throw new Error('Board font unavailable')
    const blob = await response.blob()
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(new Error('Board font unavailable'))
      reader.readAsDataURL(blob)
    })
  })().catch((error) => {
    fontData = undefined
    throw error
  })
  const style = document.createElementNS('http://www.w3.org/2000/svg', 'style')
  style.textContent = `@font-face{font-family:'Praxis Caveat';src:url('${await fontData}') format('woff2');font-weight:400;font-style:normal;}`
  svg.insertBefore(style, svg.firstChild)
}
