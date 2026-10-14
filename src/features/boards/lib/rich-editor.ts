import type { JSONContent } from '@tiptap/vue-3'
import type { BoardRichRun, BoardRichText } from '@/shared/types/board'

export const richRunDefaults: Omit<BoardRichRun, 'text'> = {
  bold: false, italic: false, underline: false, font: 'handwritten', fontSize: 22,
  color: '#263238', highlight: 'none',
}

export function safeRichAttributes(value: Record<string, unknown> = {}) {
  return {
    font: value.font === 'sans' ? 'sans' : 'handwritten',
    fontSize: typeof value.fontSize === 'number' && Number.isFinite(value.fontSize)
      ? Math.max(8, Math.min(72, value.fontSize)) : 22,
    color: typeof value.color === 'string' && /^#[\da-f]{6}$/i.test(value.color) ? value.color : '#263238',
    highlight: ['yellow', 'green', 'pink', 'blue'].includes(String(value.highlight)) ? value.highlight : 'none',
  }
}

export function richTextToEditor(document: BoardRichText): JSONContent {
  const content: JSONContent[] = []
  for (const paragraph of document.paragraphs) {
    const node: JSONContent = {
      type: 'paragraph', attrs: { textAlign: paragraph.align },
      content: paragraph.runs.filter(run => run.text.length).map(run => ({
        type: 'text', text: run.text,
        marks: [
          { type: 'boardStyle', attrs: safeRichAttributes(run) },
          ...(run.bold ? [{ type: 'bold' }] : []),
          ...(run.italic ? [{ type: 'italic' }] : []),
          ...(run.underline ? [{ type: 'underline' }] : []),
        ],
      })),
    }
    if (paragraph.list === 'none') content.push(node)
    else {
      const type = paragraph.list === 'bullet' ? 'bulletList' : 'orderedList'
      const item = { type: 'listItem', content: [node] }
      const previous = content[content.length - 1]
      if (previous?.type === type) previous.content?.push(item)
      else content.push({ type, content: [item] })
    }
  }
  return { type: 'doc', content: content.length ? content : [{ type: 'paragraph' }] }
}

export function editorToRichText(document: JSONContent): BoardRichText {
  const paragraphs: BoardRichText['paragraphs'] = []
  function visit(node: JSONContent, list: 'none' | 'bullet' | 'ordered' = 'none') {
    if (node.type === 'paragraph') {
      const runs: BoardRichRun[] = []
      for (const child of node.content ?? []) {
        if (child.type === 'hardBreak') { runs.push({ ...richRunDefaults, text: '\n' }); continue }
        if (child.type !== 'text' || !child.text) continue
        const marks = child.marks ?? []
        const style = safeRichAttributes(marks.find(mark => mark.type === 'boardStyle')?.attrs)
        runs.push({ ...richRunDefaults, ...style, text: child.text,
          bold: marks.some(mark => mark.type === 'bold'), italic: marks.some(mark => mark.type === 'italic'),
          underline: marks.some(mark => mark.type === 'underline'),
        } as BoardRichRun)
      }
      paragraphs.push({ align: node.attrs?.textAlign === 'center' || node.attrs?.textAlign === 'right' ? node.attrs.textAlign : 'left', list, runs })
    } else {
      const nextList = node.type === 'bulletList' ? 'bullet' : node.type === 'orderedList' ? 'ordered' : list
      for (const child of node.content ?? []) visit(child, nextList)
    }
  }
  visit(document)
  return { paragraphs: paragraphs.length ? paragraphs : [{ align: 'left', list: 'none', runs: [] }] }
}
