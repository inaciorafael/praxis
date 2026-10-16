import { describe, expect, it } from 'vitest'
import {
  editorToRichText,
  richRunDefaults,
  richTextToEditor,
  safeRichAttributes,
} from './rich-editor'
import type { BoardRichText } from '@/shared/types/board'
import { defaultAnnotation } from './notation'

describe('board editor document conversion', () => {
  it('roundtrips annotation on selected runs without annotating adjacent text', () => {
    const document: BoardRichText = {
      paragraphs: [
        {
          align: 'right',
          list: 'ordered',
          runs: [
            { ...richRunDefaults, text: 'Before ' },
            {
              ...richRunDefaults,
              text: 'important',
              bold: true,
              italic: true,
              color: '#123456',
              annotation: {
                ...defaultAnnotation('bracket'),
                padding: [1, 2, 3, 4],
                brackets: ['left', 'right'],
                rtl: true,
              },
            },
            { ...richRunDefaults, text: ' after', underline: true },
          ],
        },
      ],
    }
    expect(editorToRichText(richTextToEditor(document))).toEqual(document)
  })

  it('sanitizes pasted annotation metadata and drops unsupported annotation types', () => {
    const convert = (annotation: unknown) =>
      editorToRichText({
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Safe',
                marks: [{ type: 'boardStyle', attrs: { annotation } }],
              },
            ],
          },
        ],
      }).paragraphs[0].runs[0]
    expect(convert({ type: 'script', color: '#123456' }).annotation).toBeUndefined()
    const run = convert({
      type: 'circle',
      color: 'url(evil)',
      strokeWidth: Infinity,
      padding: [-2, 99],
      iterations: 99,
      brackets: ['left', 'left', 'center'],
      animationDuration: -1,
      animationDelay: NaN,
      animate: 'true',
      rtl: true,
      script: 'evil',
    })
    expect(run.annotation).toEqual({
      ...defaultAnnotation('circle'),
      padding: [0, 24],
      iterations: 4,
      brackets: ['left'],
      animationDuration: 100,
      rtl: true,
    })
    expect(run.text).toBe('Safe')
  })

  it('removing annotation retains independent formatting and paragraph settings', () => {
    const document: BoardRichText = {
      paragraphs: [
        {
          align: 'center',
          list: 'bullet',
          runs: [
            {
              ...richRunDefaults,
              text: 'Keep styles',
              bold: true,
              italic: true,
              underline: true,
              font: 'sans',
              fontSize: 32,
              color: '#abcdef',
              highlight: 'pink',
              annotation: defaultAnnotation('box'),
            },
          ],
        },
      ],
    }
    const editor = richTextToEditor(document)
    const marks = editor.content![0]!.content![0]!.content![0]!.content![0]!.marks!
    const style = marks.find((mark) => mark.type === 'boardStyle')!
    style.attrs = { ...style.attrs, annotation: null }
    const expected = structuredClone(document)
    delete expected.paragraphs[0].runs[0].annotation
    expect(editorToRichText(editor)).toEqual(expected)
  })
  it('preserves independent run formatting and paragraph lists through roundtrip', () => {
    const document: BoardRichText = {
      paragraphs: [
        {
          align: 'center',
          list: 'none',
          runs: [
            {
              ...richRunDefaults,
              text: 'Title',
              bold: true,
              color: '#ab1234',
              fontSize: 36,
            },
          ],
        },
        {
          align: 'left',
          list: 'bullet',
          runs: [
            { ...richRunDefaults, text: 'First', italic: true, highlight: 'yellow' },
          ],
        },
        {
          align: 'right',
          list: 'bullet',
          runs: [{ ...richRunDefaults, text: 'Second', underline: true, font: 'sans' }],
        },
      ],
    }
    expect(editorToRichText(richTextToEditor(document))).toEqual(document)
  })
  it('rejects untrusted style values and clamps text size', () => {
    expect(
      safeRichAttributes({
        font: 'javascript',
        fontSize: 1000,
        color: 'url(evil)',
        highlight: 'evil',
      })
    ).toEqual({ font: 'handwritten', fontSize: 72, color: '#263238', highlight: 'none' })
    expect(safeRichAttributes({ fontSize: NaN }).fontSize).toBe(22)
  })
  it('stores only text from pasted unsupported nodes, without links or HTML attributes', () => {
    const result = editorToRichText({
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          attrs: { textAlign: 'unsafe' },
          content: [
            {
              type: 'text',
              text: '<script>',
              marks: [{ type: 'link', attrs: { href: 'javascript:evil' } }],
            },
            { type: 'image', attrs: { src: 'evil' } },
          ],
        },
      ],
    })
    expect(result.paragraphs[0]).toEqual({
      align: 'left',
      list: 'none',
      runs: [{ ...richRunDefaults, text: '<script>' }],
    })
  })
  it('preserves blank paragraphs and hard breaks as plain text', () => {
    const result = editorToRichText({
      type: 'doc',
      content: [
        { type: 'paragraph' },
        { type: 'paragraph', content: [{ type: 'hardBreak' }] },
      ],
    })
    expect(result.paragraphs[0].runs).toEqual([])
    expect(result.paragraphs[1].runs[0].text).toBe('\n')
  })
})
