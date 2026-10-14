import { describe, it, expect } from 'vitest'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { EditorContent, type Editor } from '@tiptap/vue-3'
import BoardRichTextEditor from './BoardRichTextEditor.vue'
import { richRunDefaults } from '../lib/rich-editor'

function mountEditor() {
  return mount(BoardRichTextEditor, {
    props: { modelValue: { paragraphs: [{ align: 'left', list: 'none', runs: [{ ...richRunDefaults, text: 'Hello' }] }] } },
    global: { plugins: [createI18n({ legacy: false, locale: 'en', missingWarn: false, fallbackWarn: false, messages: { en: {} } })] },
  })
}

describe('board rich text editor', () => {
  it('renders editable content and formatting controls', async () => {
    const wrapper = mountEditor()
    await flushPromises()
    expect(wrapper.find('[contenteditable="true"]').text()).toBe('Hello')
    expect(wrapper.find('[role="toolbar"]').exists()).toBe(true)
    expect(wrapper.find('input[type="color"]').exists()).toBe(true)
    wrapper.unmount()
  })
  it('finishes on Ctrl+Enter and cancels on Escape while Enter remains available for paragraphs', async () => {
    const wrapper = mountEditor()
    await flushPromises()
    const content = wrapper.find('[contenteditable="true"]')
    await content.trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(wrapper.emitted('finish')).toHaveLength(1)
    await content.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('cancel')).toHaveLength(1)
    wrapper.unmount()
  })
  it('updates toolbar state when selection moves between differently formatted runs', async () => {
    const wrapper = mountEditor()
    await flushPromises()
    const editor = wrapper.findComponent(EditorContent).props('editor') as Editor
    editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'Bold', marks: [{ type: 'bold' }] }, { type: 'text', text: ' Plain' },
    ] }] })
    editor.commands.setTextSelection(2)
    await flushPromises()
    expect(wrapper.find('[aria-label="boards.rich.bold"]').attributes('aria-pressed')).toBe('true')
    editor.commands.setTextSelection(8)
    await flushPromises()
    expect(wrapper.find('[aria-label="boards.rich.bold"]').attributes('aria-pressed')).toBe('false')
    wrapper.unmount()
  })
})
