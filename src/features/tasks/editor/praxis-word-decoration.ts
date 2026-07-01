import { Extension } from '@tiptap/core'
import type { Node as ProseMirrorNode } from '@tiptap/pm/model'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export type TextRange = {
  from: number
  to: number
}

const PRAXIS_WORD_PATTERN = /\bpraxis\b/gi
const praxisWordDecorationKey = new PluginKey<DecorationSet>('praxisWordDecoration')

export function findPraxisWordRanges(text: string, offset = 0): TextRange[] {
  return [...text.matchAll(PRAXIS_WORD_PATTERN)].map((match) => ({
    from: offset + (match.index ?? 0),
    to: offset + (match.index ?? 0) + match[0].length,
  }))
}

function createDecorations(document: ProseMirrorNode) {
  const decorations: Decoration[] = []

  document.descendants((node, position) => {
    if (!node.isText || !node.text) {
      return
    }

    for (const range of findPraxisWordRanges(node.text, position)) {
      decorations.push(
        Decoration.inline(range.from, range.to, {
          class: 'praxis-word-decoration',
        })
      )
    }
  })

  return DecorationSet.create(document, decorations)
}

export const PraxisWordDecoration = Extension.create({
  name: 'praxisWordDecoration',

  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: praxisWordDecorationKey,
        state: {
          init: (_, state) => createDecorations(state.doc),
          apply: (transaction, decorations) =>
            transaction.docChanged ? createDecorations(transaction.doc) : decorations,
        },
        props: {
          decorations: (state) => praxisWordDecorationKey.getState(state) ?? null,
        },
      }),
    ]
  },
})
