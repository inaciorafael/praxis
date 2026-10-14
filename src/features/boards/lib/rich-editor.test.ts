import { describe, expect, it } from 'vitest'
import { editorToRichText, richRunDefaults, richTextToEditor, safeRichAttributes } from './rich-editor'
import type { BoardRichText } from '@/shared/types/board'

describe('board editor document conversion', () => {
  it('preserves independent run formatting and paragraph lists through roundtrip', () => {
    const document: BoardRichText = { paragraphs: [
      { align: 'center', list: 'none', runs: [{ ...richRunDefaults, text: 'Title', bold: true, color: '#ab1234', fontSize: 36 }] },
      { align: 'left', list: 'bullet', runs: [{ ...richRunDefaults, text: 'First', italic: true, highlight: 'yellow' }] },
      { align: 'right', list: 'bullet', runs: [{ ...richRunDefaults, text: 'Second', underline: true, font: 'sans' }] },
    ] }
    expect(editorToRichText(richTextToEditor(document))).toEqual(document)
  })
  it('rejects untrusted style values and clamps text size', () => {
    expect(safeRichAttributes({ font: 'javascript', fontSize: 1000, color: 'url(evil)', highlight: 'evil' })).toEqual({ font: 'handwritten', fontSize: 72, color: '#263238', highlight: 'none' })
    expect(safeRichAttributes({ fontSize: NaN }).fontSize).toBe(22)
  })
  it('stores only text from pasted unsupported nodes, without links or HTML attributes', () => {
    const result = editorToRichText({ type: 'doc', content: [{ type: 'paragraph', attrs: { textAlign: 'unsafe' }, content: [{ type: 'text', text: '<script>', marks: [{ type: 'link', attrs: { href: 'javascript:evil' } }] }, { type: 'image', attrs: { src: 'evil' } }] }] })
    expect(result.paragraphs[0]).toEqual({ align: 'left', list: 'none', runs: [{ ...richRunDefaults, text: '<script>' }] })
  })
  it('preserves blank paragraphs and hard breaks as plain text', () => {
    const result = editorToRichText({ type: 'doc', content: [{ type: 'paragraph' }, { type: 'paragraph', content: [{ type: 'hardBreak' }] }] })
    expect(result.paragraphs[0].runs).toEqual([])
    expect(result.paragraphs[1].runs[0].text).toBe('\n')
  })
})
