/** Wrap plain text without introducing midword breaks for ordinary words. */
export function wrapBoardText(text: string, maxCharacters: number, maxLines = Infinity): string[] {
  const width = Math.max(1, Math.floor(maxCharacters))
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    let line = ''
    const words = paragraph.trim().split(/\s+/).filter(Boolean)
    if (!words.length) { lines.push(''); continue }
    for (let word of words) {
      if (line && line.length + 1 + word.length > width) { lines.push(line); line = '' }
      while (word.length > width) {
        lines.push(word.slice(0, width))
        word = word.slice(width)
      }
      line = line ? `${line} ${word}` : word
    }
    lines.push(line)
  }
  return lines.slice(0, Math.max(1, maxLines))
}
