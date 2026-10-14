import { describe, expect, it } from 'vitest'
import { boardImage } from './image'
function file(bytes: Uint8Array, type = 'image/png', size = bytes.byteLength): File {
  return { type, size, arrayBuffer: async () => bytes.buffer } as File
}
describe('board image guards', () => {
  it('rejects unsupported types and files exceeding 5MiB before reading bytes', async () => {
    await expect(boardImage(file(new Uint8Array(), 'image/svg+xml'))).rejects.toThrow(
      'imageRejected'
    )
    await expect(
      boardImage(file(new Uint8Array(), 'image/png', 5 * 1024 * 1024 + 1))
    ).rejects.toThrow('imageRejected')
  })
  it('rejects a large decompressed PNG before FileReader or browser image decode', async () => {
    const bytes = new Uint8Array(24)
    bytes.set([137, 80, 78, 71, 13, 10, 26, 10], 0)
    bytes.set([73, 72, 68, 82], 12)
    const view = new DataView(bytes.buffer)
    view.setUint32(16, 9000)
    view.setUint32(20, 100)
    await expect(boardImage(file(bytes))).rejects.toThrow('imageRejected')
    view.setUint32(16, 8192)
    view.setUint32(20, 8192)
    await expect(boardImage(file(bytes))).rejects.toThrow('imageRejected')
  })
  it('rejects malformed headers even with an accepted declared MIME type', async () => {
    await expect(boardImage(file(new Uint8Array(30)))).rejects.toThrow('imageRejected')
    await expect(boardImage(file(new Uint8Array(30), 'image/jpeg'))).rejects.toThrow(
      'imageRejected'
    )
    await expect(boardImage(file(new Uint8Array(30), 'image/webp'))).rejects.toThrow(
      'imageRejected'
    )
  })
})
