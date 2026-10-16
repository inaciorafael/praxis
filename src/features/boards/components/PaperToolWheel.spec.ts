import { mount } from '@vue/test-utils'
import { defineComponent, markRaw } from 'vue'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import PaperToolWheel from './PaperToolWheel.vue'

const icon = markRaw(defineComponent({ template: '<svg />' }))
const tools = [
  'draw',
  'pen',
  'select',
  'pan',
  'text',
  'note',
  'rectangle',
  'ellipse',
  'arrow',
  'image',
  'frame',
].map((id) => ({ id, icon, shortcut: id === 'pen' ? 'B' : undefined }))
const mountWheel = () =>
  mount(PaperToolWheel, {
    props: {
      activeTool: 'pen',
      tools,
      color: '#25354a',
      width: 3,
      opacity: 0.7,
      settingsOpen: false,
    },
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

describe('PaperToolWheel', () => {
  it('keeps ordinary pencil and pen available without presenting them as the active artistic material', async () => {
    const wrapper = mountWheel()
    await wrapper.setProps({ activeTool: 'draw', activeBrush: 'fountain' })
    expect(wrapper.get('[data-tool="draw"]').attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('.paper-active-tool').text()).toContain(
      'boards.brushes.types.fountain'
    )
    await wrapper.get('[data-tool="pen"]').trigger('click')
    await wrapper.get('[data-tool="draw"]').trigger('click')
    expect(wrapper.emitted('choose')).toEqual([['pen'], ['draw']])
    wrapper.unmount()
  })
  it('dismisses additional tools with Escape or a click outside and keeps shortcuts usable', async () => {
    const wrapper = mountWheel()
    await wrapper.get('[data-more-tools]').trigger('click')
    await wrapper.trigger('keydown', { key: 'Escape' })
    expect(wrapper.get('.paper-tool-drawer').isVisible()).toBe(false)
    await wrapper.get('[data-more-tools]').trigger('click')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.paper-tool-drawer').isVisible()).toBe(false)
    await wrapper.trigger('keydown', { key: 'b' })
    expect(wrapper.emitted('choose')).toEqual([['pen']])
    wrapper.unmount()
  })

  it('keeps the settings and additional-tools menus from overlapping', async () => {
    const wrapper = mountWheel()
    await wrapper.get('[data-more-tools]').trigger('click')
    await wrapper.setProps({ settingsOpen: true })
    expect(wrapper.get('.paper-tool-drawer').isVisible()).toBe(false)
    await wrapper.trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('toggleSettings')).toHaveLength(1)
    wrapper.unmount()
  })
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
    for (const tool of tools)
      expect(wrapper.findAll(`[data-tool="${tool.id}"]`)).toHaveLength(1)
    expect(wrapper.get('.paper-tool-drawer').isVisible()).toBe(false)
    await wrapper.get('[data-more-tools]').trigger('click')
    expect(wrapper.get('[data-more-tools]').attributes('aria-expanded')).toBe('true')
    expect(wrapper.get('.paper-tool-drawer').attributes('style')).not.toContain(
      'display: none'
    )
    await wrapper.get('[data-tool="rectangle"]').trigger('click')
    expect(wrapper.emitted('choose')).toEqual([['rectangle']])
    expect(wrapper.get('.paper-tool-drawer').isVisible()).toBe(false)
  })

  it('presents the color, width and opacity preset and toggles its settings', async () => {
    const wrapper = mountWheel()
    expect(wrapper.get('.paper-tool-swatch').attributes('style')).toContain(
      'opacity: 0.7'
    )
    expect(wrapper.get('.paper-tool-values').text()).toContain('70%')
    expect(wrapper.get('[data-tool-settings]').attributes('aria-expanded')).toBe('false')
    await wrapper.get('[data-tool-settings]').trigger('click')
    expect(wrapper.emitted('toggleSettings')).toHaveLength(1)
    await wrapper.setProps({ settingsOpen: true })
    expect(wrapper.get('[data-tool-settings]').attributes('aria-expanded')).toBe('true')
  })

  it('offers a Paper lock instead of a sticky-tool toggle', async () => {
    const wrapper = mountWheel()
    expect(wrapper.find('[data-keep-tool]').exists()).toBe(false)
    await wrapper.get('[data-lock-paper]').trigger('click')
    expect(wrapper.emitted('lockPaper')).toHaveLength(1)
  })
})
