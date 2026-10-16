import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import type { BoardDrawBrush } from '@/shared/types/board'
import PaperBrushLibrary from './PaperBrushLibrary.vue'

function mountLibrary(modelValue?: BoardDrawBrush | null) {
  return mount(PaperBrushLibrary, {
    props: { modelValue },
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
}
describe('PaperBrushLibrary', () => {
  it('groups all five instruments and keeps basic-tool selection separate from saved brush types', async () => {
    const wrapper = mountLibrary()
    expect(wrapper.findAll('fieldset')).toHaveLength(2)
    expect(
      wrapper
        .findAll('[data-base-tool]')
        .map((button) => button.attributes('data-base-tool'))
    ).toEqual(['draw', 'pen'])
    await wrapper.get('[data-base-tool="draw"]').trigger('click')
    expect(wrapper.emitted('base')).toEqual([['draw']])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    await wrapper.setProps({ baseTool: 'draw' })
    expect(wrapper.get('[data-base-tool="draw"]').attributes('aria-pressed')).toBe('true')
    await wrapper.setProps({ modelValue: 'ink' })
    expect(wrapper.get('[data-base-tool="draw"]').attributes('aria-pressed')).toBe(
      'false'
    )
    expect(wrapper.findAll('[aria-pressed="true"]')).toHaveLength(1)
  })
  it('offers graphite, fountain and sketch ink without converting legacy strokes', () => {
    const wrapper = mountLibrary()
    expect(
      wrapper
        .findAll('[data-paper-brush]')
        .map((button) => button.attributes('data-paper-brush'))
    ).toEqual(['graphite', 'fountain', 'ink'])
    expect(wrapper.findAll('[aria-pressed="true"]')).toHaveLength(0)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
  })
  it.each(['graphite', 'fountain', 'ink'] as const)(
    'selects %s explicitly without mutating the current prop',
    async (brush) => {
      const wrapper = mountLibrary('graphite')
      await wrapper.get(`[data-paper-brush="${brush}"]`).trigger('click')
      expect(wrapper.emitted('update:modelValue')).toEqual([[brush]])
      expect(wrapper.props('modelValue')).toBe('graphite')
      await wrapper.setProps({ modelValue: brush })
      expect(
        wrapper.get(`[data-paper-brush="${brush}"]`).attributes('aria-pressed')
      ).toBe('true')
    }
  )
  it('keeps retired materials intact until another writing tool is chosen', async () => {
    const wrapper = mountLibrary('watercolor')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    expect(wrapper.props('modelValue')).toBe('watercolor')
    expect(wrapper.findAll('[aria-pressed="true"]')).toHaveLength(0)
    await wrapper.get('[data-paper-brush="fountain"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')).toEqual([['fountain']])
  })
})
