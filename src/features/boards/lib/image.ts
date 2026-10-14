const MAX_BYTES = 5 * 1024 * 1024
export async function boardImage(
  file: File
): Promise<{ data: string; width: number; height: number }> {
  if (
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    file.size > MAX_BYTES
  )
    throw new Error('imageRejected')
  const buffer = new Uint8Array(await file.arrayBuffer())
  const view = new DataView(buffer.buffer)
  let width = 0
  let height = 0
  if (
    file.type === 'image/png' &&
    buffer.length >= 24 &&
    [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => buffer[index] === byte) &&
    String.fromCharCode(...buffer.slice(12, 16)) === 'IHDR'
  ) {
    width = view.getUint32(16)
    height = view.getUint32(20)
  } else if (file.type === 'image/jpeg' && buffer[0] === 255 && buffer[1] === 216) {
    let offset = 2
    while (offset + 8 < buffer.length) {
      if (buffer[offset] !== 255) break
      const marker = buffer[offset + 1]!
      if (marker === 217 || marker === 218) break
      const length = view.getUint16(offset + 2)
      if (length < 2 || offset + 2 + length > buffer.length) break
      if (
        [192, 193, 194, 195, 197, 198, 199, 201, 202, 203, 205, 206, 207].includes(marker)
      ) {
        height = view.getUint16(offset + 5)
        width = view.getUint16(offset + 7)
        break
      }
      offset += length + 2
    }
  } else if (
    file.type === 'image/webp' &&
    buffer.length >= 30 &&
    String.fromCharCode(...buffer.slice(0, 4)) === 'RIFF' &&
    String.fromCharCode(...buffer.slice(8, 12)) === 'WEBP'
  ) {
    const kind = String.fromCharCode(...buffer.slice(12, 16))
    if (kind === 'VP8X') {
      width = 1 + buffer[24]! + (buffer[25]! << 8) + (buffer[26]! << 16)
      height = 1 + buffer[27]! + (buffer[28]! << 8) + (buffer[29]! << 16)
    } else if (kind === 'VP8 ') {
      width = view.getUint16(26, true) & 16383
      height = view.getUint16(28, true) & 16383
    } else if (kind === 'VP8L' && buffer[20] === 47) {
      width = 1 + buffer[21]! + ((buffer[22]! & 63) << 8)
      height = 1 + (buffer[22]! >> 6) + (buffer[23]! << 2) + ((buffer[24]! & 15) << 10)
    }
  }
  if (!width || !height || width > 8192 || height > 8192 || width * height > 64_000_000)
    throw new Error('imageRejected')
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
  const image = new Image()
  image.src = data
  await image.decode()
  if (image.naturalWidth !== width || image.naturalHeight !== height)
    throw new Error('imageRejected')
  return { data, width, height }
}
