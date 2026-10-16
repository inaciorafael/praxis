import { describe, expect, it } from 'vitest'
import { buildPresentationPdf } from './presentation-pdf'

function page(width = 1600, height = 900) {
  const jpeg = new Uint8Array([
    0xff,
    0xd8,
    0xff,
    0xc0,
    0,
    17,
    8,
    height >> 8,
    height & 255,
    width >> 8,
    width & 255,
    3,
    1,
    0x11,
    0,
    2,
    0x11,
    0,
    3,
    0x11,
    0,
    0xff,
    0xda,
    0,
    2,
    0x80,
    0x81,
    0,
    0xff,
    0xd9,
  ])
  return { jpeg, width, height }
}

async function bytes(blob: Blob): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(reader.error)
    reader.onload = () => resolve(new Uint8Array(reader.result as ArrayBuffer))
    reader.readAsArrayBuffer(blob)
  })
}

describe('presentation PDF', () => {
  it('preserves binary JPEGs, aspect ratios and ordered pages with exact byte offsets', async () => {
    const first = page()
    const second = page(900, 1600)
    const pdf = buildPresentationPdf([first, second])
    expect(pdf.type).toBe('application/pdf')
    const data = await bytes(pdf)
    const text = Array.from(data, (byte) => String.fromCharCode(byte)).join('')
    expect(text.startsWith('%PDF-1.4\n')).toBe(true)
    expect(text).toContain('/Count 2 /Kids [3 0 R 6 0 R]')
    expect(text).toContain('/MediaBox [0 0 960 540]')
    expect(text).toContain('/MediaBox [0 0 540 960]')
    expect(text.match(/\/Filter \/DCTDecode/g)).toHaveLength(2)
    const xref = Number(text.match(/startxref\n(\d+)\n%%EOF/)![1])
    expect(text.slice(xref, xref + 5)).toBe('xref\n')
    const lines = text.slice(xref).split('\n')
    expect(lines[1]).toBe('0 9')
    for (let id = 1; id <= 8; id++) {
      const offset = Number(lines[id + 2]!.slice(0, 10))
      expect(text.slice(offset).startsWith(`${id} 0 obj\n`)).toBe(true)
    }
    const imageStart = text.indexOf('stream\n', text.indexOf('/Subtype /Image')) + 7
    expect(data.slice(imageStart, imageStart + first.jpeg.length)).toEqual(first.jpeg)
  })

  it('rejects empty/oversized presentations and invalid JPEG dimensions or headers', () => {
    expect(() => buildPresentationPdf([])).toThrow('1 to 100')
    expect(() => buildPresentationPdf(Array.from({ length: 101 }, () => page()))).toThrow(
      '1 to 100'
    )
    for (const [width, height] of [
      [0, 100],
      [100, Infinity],
      [1.5, 100],
      [8193, 100],
      [8192, 8192],
    ]) {
      expect(() => buildPresentationPdf([page(width, height)])).toThrow('dimensions')
    }
    expect(() => buildPresentationPdf([{ ...page(), width: 10 }])).toThrow('matching')
    expect(() =>
      buildPresentationPdf([{ ...page(), jpeg: new Uint8Array([1, 2, 3]) }])
    ).toThrow('JPEG')
    const unsupported = page()
    unsupported.jpeg[4] = 0x7f
    expect(() => buildPresentationPdf([unsupported])).toThrow('matching')
    expect(() =>
      buildPresentationPdf([{ ...page(), jpeg: new Uint8Array(64 * 1024 * 1024 + 1) }])
    ).toThrow('64 MiB')
  })
})
