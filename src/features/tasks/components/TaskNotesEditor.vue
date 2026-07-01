<script setup lang="ts">
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { PraxisWordDecoration } from '@/features/tasks/editor/praxis-word-decoration'
import { Bold, Italic, List, ListOrdered, Redo2, Undo2 } from '@lucide/vue'
import { onBeforeUnmount, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const props = withDefaults(
  defineProps<{
    modelValue: string
    placeholder?: string
  }>(),
  {
    placeholder: '',
  }
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()
const { t } = useI18n()

const editor = useEditor({
  content: props.modelValue,
  injectCSS: false,
  extensions: [
    PraxisWordDecoration,
    StarterKit.configure({
      blockquote: false,
      code: false,
      codeBlock: false,
      dropcursor: false,
      gapcursor: false,
      heading: false,
      horizontalRule: false,
      link: false,
      strike: false,
      trailingNode: false,
      underline: false,
    }),
  ],
  editorProps: {
    attributes: {
      class: 'min-h-28 px-3 py-2 text-body text-ink outline-none prose-praxis',
      'aria-label': t('task.notes'),
    },
  },
  onUpdate: ({ editor: currentEditor }) => {
    emit('update:modelValue', currentEditor.isEmpty ? '' : currentEditor.getHTML())
  },
})

watch(
  () => props.modelValue,
  (value) => {
    if (!editor.value) {
      return
    }

    const currentValue = editor.value.isEmpty ? '' : editor.value.getHTML()

    if (currentValue !== value) {
      editor.value.commands.setContent(value, { emitUpdate: false })
    }
  }
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})

function buttonClass(active = false) {
  return [
    'flex h-8 w-8 items-center justify-center border transition-colors',
    active
      ? 'border-accent bg-selection text-accent'
      : 'border-transparent text-ink-soft hover:border-border hover:bg-hover hover:text-ink',
  ]
}
</script>

<template>
  <div class="overflow-hidden border border-border bg-surface focus-within:border-accent">
    <div
      v-if="editor"
      class="flex flex-wrap items-center gap-1 border-b border-border bg-paper px-2 py-1"
      role="toolbar"
      :aria-label="t('task.editor.toolbar')"
    >
      <button
        type="button"
        :class="buttonClass(editor.isActive('bold'))"
        :aria-pressed="editor.isActive('bold')"
        :aria-label="t('task.editor.bold')"
        :title="t('task.editor.bold')"
        @click="editor.chain().focus().toggleBold().run()"
      >
        <Bold :size="16" />
      </button>
      <button
        type="button"
        :class="buttonClass(editor.isActive('italic'))"
        :aria-pressed="editor.isActive('italic')"
        :aria-label="t('task.editor.italic')"
        :title="t('task.editor.italic')"
        @click="editor.chain().focus().toggleItalic().run()"
      >
        <Italic :size="16" />
      </button>
      <span
        class="mx-1 h-5 w-px bg-border"
        aria-hidden="true"
      ></span>
      <button
        type="button"
        :class="buttonClass(editor.isActive('bulletList'))"
        :aria-pressed="editor.isActive('bulletList')"
        :aria-label="t('task.editor.bulletList')"
        :title="t('task.editor.bulletList')"
        @click="editor.chain().focus().toggleBulletList().run()"
      >
        <List :size="16" />
      </button>
      <button
        type="button"
        :class="buttonClass(editor.isActive('orderedList'))"
        :aria-pressed="editor.isActive('orderedList')"
        :aria-label="t('task.editor.orderedList')"
        :title="t('task.editor.orderedList')"
        @click="editor.chain().focus().toggleOrderedList().run()"
      >
        <ListOrdered :size="16" />
      </button>
      <span
        class="mx-1 h-5 w-px bg-border"
        aria-hidden="true"
      ></span>
      <button
        type="button"
        :disabled="!editor.can().chain().focus().undo().run()"
        :class="buttonClass()"
        :aria-label="t('task.editor.undo')"
        :title="t('task.editor.undo')"
        class="disabled:pointer-events-none disabled:opacity-35"
        @click="editor.chain().focus().undo().run()"
      >
        <Undo2 :size="16" />
      </button>
      <button
        type="button"
        :disabled="!editor.can().chain().focus().redo().run()"
        :class="buttonClass()"
        :aria-label="t('task.editor.redo')"
        :title="t('task.editor.redo')"
        class="disabled:pointer-events-none disabled:opacity-35"
        @click="editor.chain().focus().redo().run()"
      >
        <Redo2 :size="16" />
      </button>
    </div>

    <EditorContent
      v-if="editor"
      :editor="editor"
    />
    <div
      v-else
      class="min-h-28 px-3 py-2 text-body text-ink-muted"
    >
      {{ placeholder }}
    </div>
  </div>
</template>

<style scoped>
:deep(.ProseMirror p) {
  margin: 0 0 0.45rem;
}

:deep(.ProseMirror p:last-child) {
  margin-bottom: 0;
}

:deep(.ProseMirror ul),
:deep(.ProseMirror ol) {
  margin: 0.35rem 0;
  padding-left: 1.35rem;
}

:deep(.ProseMirror ul) {
  list-style: disc;
}

:deep(.ProseMirror ol) {
  list-style: decimal;
}

:deep(.praxis-word-decoration) {
  border-bottom: 1px solid var(--accent);
  background: var(--selection);
  color: var(--accent);
  font-weight: 700;
}
</style>
