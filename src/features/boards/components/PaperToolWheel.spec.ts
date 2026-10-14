import { mount } from '@vue/test-utils'
import { defineComponent, markRaw } from 'vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import PaperToolWheel from './PaperToolWheel.vue'

const icon = markRaw(defineComponent({ template: '<svg />' }))
const tools = ['draw', 'pen', 'select', 'pan', 'text', 'note', 'rectangle', 'ellipse', 'arrow', 'image', 'frame']
  .map(id => ({ id, icon, shortcut: id === 'pen' ? 'B' : undefined }))
const mountWheel = () => mount(PaperToolWheel, {
  props: { activeTool: 'pen', tools, color: '#25354a', width: 3, opacity: .7, settingsOpen: false, keepTool: false },
  global: { plugins: [createI18n({ legacy: false, locale: 'en', missingWarn: false, fallbackWarn: false, messages: { en: {} } })] },
})

describe('PaperToolWheel', () => {
  it('shows six primary tools with one selected and emits selection without mutating props', async () => {
    const wrapper = mountWheel()
    expect(wrapper.findAll('.paper-tool-slot')).toHaveLength(6)
    expect(wrapper.get('[data-tool="pen"]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-tool="pen"]').attributes('aria-label')).toContain('(B)')
    await wrapper.get('[data-tool="draw"]').trigger('click')
    expect(wrapper.emitted('choose')).toEqual([['draw']])
    expect(wrapper.props('activeTool')).toBe('pen')
  })

  it('keeps each additional tool mounted once and reveals the drawer on demand', async () => {
    const wrapper = mountWheel()
    for (const tool of tools) expect(wrapper.findAll(`[data-tool="${tool.id}"]`)).toHaveLength(1)
    expect(wrapper.get('.paper-tool-drawer').isVisible()).toBe(false)
    await wrapper.get('[data-more-tools]').trigger('click')
    expect(wrapper.get('[data-more-tools]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('.paper-tool-drawer').attributes('style')).not.toContain('display: none')
    await wrapper.get('[data-tool="rectangle"]').trigger('click')
    expect(wrapper.emitted('choose')).toEqual([['rectangle']])
    expect(wrapper.get('.paper-tool-drawer').isVisible()).toBe(false)
  })

  it('presents the color, width and opacity preset and toggles its settings', async () => {
    const wrapper = mountWheel()
    expect(wrapper.get('.paper-tool-swatch').attributes('style')).toContain('opacity: 0.7')
    expect(wrapper.get('.paper-tool-values').text()).toContain('70%')
    expect(wrapper.get('[data-tool-settings]').attributes('aria-expanded')).toBe('false')
    await wrapper.get('[data-tool-settings]').trigger('click')
    expect(wrapper.emitted('toggleSettings')).toHaveLength(1)
    await wrapper.setProps({ settingsOpen: true })
    expect(wrapper.get('[data-tool-settings]').attributes('aria-expanded')).toBe('true')
  })

  it('exposes sticky-tool state and emits its toggle', async () => {
    const wrapper = mountWheel()
    await wrapper.get('[data-keep-tool]').trigger('click')
    expect(wrapper.emitted('toggleKeepTool')).toHaveLength(1)
    await wrapper.setProps({ keepTool: true })
    expect(wrapper.get('[data-keep-tool]').attributes('aria-pressed')).toBe('true')
  })
})
