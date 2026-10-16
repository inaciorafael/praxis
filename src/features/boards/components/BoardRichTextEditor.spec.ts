import { mount, flushPromises } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createI18n } from 'vue-i18n'
import { EditorContent, type Editor } from '@tiptap/vue-3'
import type { BoardRichText } from '@/shared/types/board'
import { richRunDefaults } from '../lib/rich-editor'
import { paperTextInk } from '../lib/background'
import { defaultAnnotation } from '../lib/notation'
import BoardRichTextEditor from './BoardRichTextEditor.vue'

const documentValue = (): BoardRichText => ({
  paragraphs: [
    {
      align: 'center',
      list: 'none',
      runs: [
        {
          ...richRunDefaults,
          text: 'First ',
          font: 'sans',
          fontSize: 36,
          color: '#aa1234',
          bold: true,
        },
        {
          ...richRunDefaults,
          text: 'second',
          font: 'handwritten',
          fontSize: 18,
          color: '#1234aa',
          italic: true,
        },
      ],
    },
  ],
})

beforeEach(() => {
  Object.defineProperty(Range.prototype, 'getClientRects', {
    configurable: true,
    value: () => [],
  })
  Object.defineProperty(Range.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      top: 0,
      bottom: 0,
      left: 0,
      right: 0,
    }),
  })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    }
  )
})
afterEach(() => {
  delete (Range.prototype as Partial<Range>).getClientRects
  delete (Range.prototype as Partial<Range>).getBoundingClientRect
  vi.unstubAllGlobals()
})

describe('BoardRichTextEditor annotation controls', () => {
  it('prioritizes text history and delegates only unchanged drafts to paper history', async () => {
    const wrapper = mount(BoardRichTextEditor, {
      attachTo: document.body,
      props: { modelValue: documentValue(), canUndo: true, canRedo: true },
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            missingWarn: false,
            fallbackWarn: false,
            messages: { en: {} },
          }),
        ],
      },
    })
    await flushPromises()
    const editor = wrapper.findComponent(EditorContent).props('editor') as Editor
    const input = wrapper.get('[contenteditable]')
    await input.trigger('keydown', { key: 'z', ctrlKey: true })
    expect(wrapper.emitted('undo')).toHaveLength(1)
    editor.commands.insertContent(' typed')
    await flushPromises()
    const typed = wrapper.vm.getDocument()
    await input.trigger('keydown', { key: 'z', ctrlKey: true })
    expect(wrapper.vm.getDocument()).toEqual(documentValue())
    expect(wrapper.emitted('undo')).toHaveLength(1)
    await input.trigger('keydown', { key: 'y', ctrlKey: true })
    expect(wrapper.vm.getDocument()).toEqual(typed)
    expect(wrapper.emitted('redo')).toBeUndefined()
    await wrapper.get('button[aria-label="boards.redo"]').trigger('click')
    expect(wrapper.emitted('redo')).toBeUndefined()
    await input.trigger('keydown', { key: 'z', ctrlKey: true })
    await input.trigger('keydown', { key: 'z', ctrlKey: true })
    expect(wrapper.emitted('undo')).toHaveLength(2)
    wrapper.unmount()
  })
  it('adapts editor text on scheme changes without changing the draft or its selection', async () => {
    const original = documentValue()
    const wrapper = mount(BoardRichTextEditor, {
      attachTo: document.body,
      props: { modelValue: original, colorScheme: 'light' },
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            missingWarn: false,
            fallbackWarn: false,
            messages: { en: {} },
          }),
        ],
      },
    })
    await flushPromises()
    const editor = wrapper.findComponent(EditorContent).props('editor') as Editor
    editor.commands.setTextSelection({ from: 1, to: 7 })
    await wrapper.setProps({ colorScheme: 'dark' })
    expect(wrapper.element.style.getPropertyValue('--paper-text-aa1234')).toBe(
      paperTextInk('#aa1234', 'dark')
    )
    expect(editor.state.selection.from).toBe(1)
    expect(editor.state.selection.to).toBe(7)
    expect(wrapper.vm.getDocument()).toEqual(original)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper.setProps({ backgroundColor: '#707070' })
    expect(wrapper.element.style.getPropertyValue('--paper-text-aa1234')).toBe(
      paperTextInk('#aa1234', 'dark', '#707070')
    )
    expect(wrapper.vm.getDocument()).toEqual(original)
    await wrapper.setProps({ backgroundColor: undefined })
    await wrapper.setProps({ annotation: defaultAnnotation('highlight') })
    expect(wrapper.element.style.getPropertyValue('--paper-text-aa1234')).toBe('#aa1234')
    await wrapper.setProps({ annotation: null })
    expect(wrapper.element.style.getPropertyValue('--paper-text-aa1234')).toBe(
      paperTextInk('#aa1234', 'dark')
    )
    await wrapper.setProps({ colorScheme: 'light' })
    expect(wrapper.element.style.getPropertyValue('--paper-text-aa1234')).toBe('#aa1234')
    expect(wrapper.vm.getDocument()).toEqual(original)
    wrapper.unmount()
  })
  it('edits numeric font size only in the selected text and keeps other formatting', async () => {
    const original = documentValue()
    const wrapper = mount(BoardRichTextEditor, {
      attachTo: document.body,
      props: { modelValue: original },
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            missingWarn: false,
            fallbackWarn: false,
            messages: { en: {} },
          }),
        ],
      },
    })
    await flushPromises()
    const editor = wrapper.findComponent(EditorContent).props('editor') as Editor
    editor.commands.setTextSelection({ from: 1, to: 7 })
    await flushPromises()
    expect(
      wrapper
        .findAll('[data-font-size-preset]')
        .map((button) => button.attributes('data-font-size-preset'))
    ).toEqual(['14', '22', '36', '48'])
    for (const size of [14, 22, 36, 48]) {
      await wrapper.get(`[data-font-size-preset="${size}"]`).trigger('click')
      expect(wrapper.vm.getDocument().paragraphs[0].runs).toEqual([
        { ...original.paragraphs[0].runs[0], fontSize: size },
        original.paragraphs[0].runs[1],
      ])
      expect(
        wrapper.get(`[data-font-size-preset="${size}"]`).attributes('aria-pressed')
      ).toBe('true')
    }
    await wrapper.get('[data-font-size]').setValue('31')
    await flushPromises()
    expect(wrapper.vm.getDocument().paragraphs[0].runs).toEqual([
      { ...original.paragraphs[0].runs[0], fontSize: 31 },
      original.paragraphs[0].runs[1],
    ])
    await wrapper.get('[data-size-increase]').trigger('click')
    expect(wrapper.vm.getDocument().paragraphs[0].runs[0].fontSize).toBe(33)
    await wrapper.get('[data-size-decrease]').trigger('click')
    expect(wrapper.vm.getDocument().paragraphs[0].runs[0].fontSize).toBe(31)
    await wrapper.get('[data-font-size]').setValue('200')
    expect(wrapper.vm.getDocument().paragraphs[0].runs[0].fontSize).toBe(72)
    await wrapper.get('[data-font-size]').setValue('')
    expect(wrapper.get<HTMLInputElement>('[data-font-size]').element.value).toBe('72')
    expect(wrapper.vm.getDocument().paragraphs[0].runs[1]).toEqual(
      original.paragraphs[0].runs[1]
    )
    editor.commands.setTextSelection(editor.state.doc.content.size - 1)
    await wrapper.get('[data-font-size-preset="22"]').trigger('click')
    expect(wrapper.vm.getDocument().paragraphs[0].runs).toEqual(
      original.paragraphs[0].runs.map((run) => ({ ...run, fontSize: 22 }))
    )
    wrapper.unmount()
  })
  it('organizes selected paragraphs using alignment and lists without losing text', async () => {
    const original = documentValue()
    const wrapper = mount(BoardRichTextEditor, {
      attachTo: document.body,
      props: { modelValue: original },
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            missingWarn: false,
            fallbackWarn: false,
            messages: { en: {} },
          }),
        ],
      },
    })
    await flushPromises()
    await wrapper.get('[aria-label="boards.rich.right"]').trigger('click')
    await wrapper.get('[aria-label="boards.rich.bullet"]').trigger('click')
    expect(wrapper.vm.getDocument().paragraphs[0]).toEqual({
      ...original.paragraphs[0],
      align: 'right',
      list: 'bullet',
    })
    wrapper.unmount()
  })
  it('exposes every Rough Notation effect directly in the formatting minimenu', async () => {
    const original = documentValue()
    const wrapper = mount(BoardRichTextEditor, {
      attachTo: document.body,
      props: { modelValue: original },
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            missingWarn: false,
            fallbackWarn: false,
            messages: { en: {} },
          }),
        ],
      },
    })
    await flushPromises()
    const toolbar = wrapper.get('[role="toolbar"]')
    expect(wrapper.find('.rich-annotation-panel').exists()).toBe(false)
    expect(toolbar.findAll('[data-annotation-quick]')).toHaveLength(7)
    expect(toolbar.find('select[aria-label="boards.rich.highlight"]').exists()).toBe(
      false
    )
    await toolbar
      .get('[data-notation-colors] [data-color-preset="#c52e36"]')
      .trigger('click')
    expect(wrapper.vm.getDocument()).toEqual(original)
    await toolbar.get('[data-annotation-quick="underline"]').trigger('click')
    expect(wrapper.vm.getDocument().paragraphs[0].runs[0].annotation?.color).toBe(
      '#c52e36'
    )
    await toolbar.get('[data-annotation-quick="highlight"]').trigger('click')
    expect(wrapper.vm.getDocument().paragraphs[0].runs[0].annotation?.color).toBe(
      '#fde875'
    )
    await toolbar
      .get('[data-notation-colors] [data-color-preset="#ffc4d8"]')
      .trigger('click')
    expect(wrapper.vm.getDocument().paragraphs[0].runs[0]).toEqual({
      ...original.paragraphs[0].runs[0],
      annotation: { ...defaultAnnotation('highlight'), color: '#ffc4d8' },
    })
    await toolbar.get('[data-annotation-remove]').trigger('click')
    await toolbar.get('[data-annotation-quick="highlight"]').trigger('click')
    expect(wrapper.vm.getDocument().paragraphs[0]!.runs[0]!.annotation?.type).toBe(
      'highlight'
    )
    await toolbar
      .get('[data-annotation-quick="highlight"]')
      .trigger('keydown', { key: 'z', ctrlKey: true })
    expect(wrapper.vm.getDocument()).toEqual(original)
    await toolbar
      .get('[data-annotation-quick="highlight"]')
      .trigger('keydown', { key: 'z', ctrlKey: true, shiftKey: true })
    expect(wrapper.vm.getDocument().paragraphs[0]!.runs[0]!.annotation?.type).toBe(
      'highlight'
    )
    for (const type of [
      'underline',
      'box',
      'circle',
      'highlight',
      'strike-through',
      'crossed-off',
      'bracket',
    ]) {
      await toolbar.get(`[data-annotation-quick="${type}"]`).trigger('click')
      await flushPromises()
      expect(wrapper.find('.rich-annotation-panel').exists()).toBe(false)
      const value = wrapper.vm.getDocument()
      value.paragraphs[0].runs.forEach((run, index) => {
        expect(run.annotation?.type).toBe(type)
        const { annotation: _annotation, ...formatting } = run
        expect(formatting).toEqual(original.paragraphs[0].runs[index])
      })
    }
    await toolbar.get('[data-annotation-remove]').trigger('click')
    expect(wrapper.vm.getDocument()).toEqual(original)
    wrapper.unmount()
  })
  it('applies and clears whole-text annotations while preserving independent run formatting', async () => {
    const original = documentValue()
    const wrapper = mount(BoardRichTextEditor, {
      attachTo: document.body,
      props: { modelValue: original },
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            missingWarn: false,
            fallbackWarn: false,
            messages: { en: {} },
          }),
        ],
      },
    })
    await flushPromises()
    await wrapper.get('[data-annotation-menu]').trigger('click')
    await wrapper.get('button[data-annotation="circle"]').trigger('click')
    await flushPromises()
    const updates = wrapper.emitted('update:modelValue')!
    const annotated = updates[updates.length - 1]![0] as BoardRichText
    expect(annotated.paragraphs[0].runs).toHaveLength(2)
    annotated.paragraphs[0].runs.forEach((run, index) => {
      expect(run.annotation?.type).toBe('circle')
      const { annotation: _annotation, ...formatting } = run
      expect(formatting).toEqual(original.paragraphs[0].runs[index])
    })
    await wrapper.get('button[data-annotation="none"]').trigger('click')
    await flushPromises()
    const clearedUpdates = wrapper.emitted('update:modelValue')!
    expect(clearedUpdates[clearedUpdates.length - 1]![0]).toEqual(original)
    wrapper.unmount()
  })

  it('Escape closes the annotation panel without cancelling or changing the text draft', async () => {
    const wrapper = mount(BoardRichTextEditor, {
      attachTo: document.body,
      props: { modelValue: documentValue() },
      global: {
        plugins: [
          createI18n({
            legacy: false,
            locale: 'en',
            missingWarn: false,
            fallbackWarn: false,
            messages: { en: {} },
          }),
        ],
      },
    })
    await flushPromises()
    await wrapper.get('[data-annotation-menu]').trigger('click')
    await wrapper
      .get('button[data-annotation="circle"]')
      .trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('.rich-annotation-panel').exists()).toBe(false)
    expect(wrapper.emitted('cancel')).toBeUndefined()
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.vm.getDocument()).toEqual(documentValue())
    wrapper.unmount()
  })
})
