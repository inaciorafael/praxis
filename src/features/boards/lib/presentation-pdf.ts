export type PresentationPdfPage = { jpeg: Uint8Array; width: number; height: number }

const MAX_BYTES = 64 * 1024 * 1024

function validatePage({ jpeg, width, height }: PresentationPdfPage): void {
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width < 1 ||
    height < 1 ||
    width > 8192 ||
    height > 8192 ||
    width * height > 64_000_000
  ) {
    throw new Error('Invalid presentation image dimensions')
  }
  if (
    jpeg.length < 4 ||
    jpeg[0] !== 0xff ||
    jpeg[1] !== 0xd8 ||
    jpeg[jpeg.length - 2] !== 0xff ||
    jpeg[jpeg.length - 1] !== 0xd9
  ) {
    throw new Error('Invalid presentation JPEG')
  }
  let offset = 2
  while (offset + 3 < jpeg.length) {
    if (jpeg[offset++] !== 0xff) break
    while (jpeg[offset] === 0xff) offset++
    const marker = jpeg[offset++]!
    const length = (jpeg[offset]! << 8) | jpeg[offset + 1]!
    if (length < 2 || offset + length > jpeg.length) break
    if (marker === 0xc0 || marker === 0xc2) {
      const actualHeight = (jpeg[offset + 3]! << 8) | jpeg[offset + 4]!
      const actualWidth = (jpeg[offset + 5]! << 8) | jpeg[offset + 6]!
      if (
        length < 17 ||
        jpeg[offset + 2] !== 8 ||
        jpeg[offset + 7] !== 3 ||
        actualWidth !== width ||
        actualHeight !== height
      )
        break
      return
    }
    if (marker === 0xda || marker === 0xd9) break
    offset += length
  }
  throw new Error('Presentation requires an 8-bit RGB JPEG matching its dimensions')
}

/** Embeds canvas JPEGs directly, keeping each scene's aspect ratio without re-encoding. */
export function buildPresentationPdf(pages: PresentationPdfPage[]): Blob {
  if (!pages.length || pages.length > 100)
    throw new Error('A presentation requires 1 to 100 scenes')
  let imageBytes = 0
  for (const page of pages) {
    imageBytes += page.jpeg.byteLength
    if (imageBytes > MAX_BYTES) throw new Error('Presentation exceeds 64 MiB')
    validatePage(page)
  }
  const encoder = new TextEncoder()
  const chunks: Uint8Array[] = []
  const offsets = [0]
  let size = 0
  const append = (value: string | Uint8Array) => {
    const bytes =
      typeof value === 'string' ? encoder.encode(value) : new Uint8Array(value)
    size += bytes.length
    if (size > MAX_BYTES) throw new Error('Presentation exceeds 64 MiB')
    chunks.push(bytes)
  }
  const object = (id: number, body: () => void) => {
    offsets[id] = size
    append(`${id} 0 obj\n`)
    body()
    append('\nendobj\n')
  }
  append('%PDF-1.4\n')
  append(new Uint8Array([0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]))
  object(1, () => append('<< /Type /Catalog /Pages 2 0 R >>'))
  object(2, () =>
    append(
      `<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, index) => `${3 + index * 3} 0 R`).join(' ')}] >>`
    )
  )
  pages.forEach(({ jpeg, width, height }, index) => {
    const id = 3 + index * 3
    const scale = 960 / Math.max(width, height)
    const w = Number((width * scale).toFixed(4))
    const h = Number((height * scale).toFixed(4))
    object(id, () =>
      append(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${w} ${h}] /Resources << /XObject << /Scene ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R >>`
      )
    )
    const command = `q\n${w} 0 0 ${h} 0 0 cm\n/Scene Do\nQ\n`
    object(id + 1, () =>
      append(
        `<< /Length ${encoder.encode(command).length} >>\nstream\n${command}endstream`
      )
    )
    object(id + 2, () => {
      append(
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`
      )
      append(jpeg)
      append('\nendstream')
    })
  })
  const xref = size
  append(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`)
  offsets
    .slice(1)
    .forEach((offset) => append(`${String(offset).padStart(10, '0')} 00000 n \n`))
  append(
    `trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  )
  return new Blob(chunks, { type: 'application/pdf' })
}
