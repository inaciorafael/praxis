import { mount } from '@vue/test-utils'
import { markRaw, defineComponent } from 'vue'
import { describe, expect, it } from 'vitest'
import { i18n } from '@/shared/lib/i18n/i18n'
import PaperToolRail from './PaperToolRail.vue'
import PaperContextBar from './PaperContextBar.vue'
const icon = markRaw(defineComponent({ template: '<svg />' }))
const tools = [
  'select',
  'pan',
  'pen',
  'draw',
  'eraser',
  'arrow',
  'text',
  'note',
  'rectangle',
  'ellipse',
  'triangle',
  'hexagon',
  'line',
  'image',
  'frame',
].map((id) => ({ id, icon, shortcut: id === 'pen' ? 'B' : undefined }))
describe('Paper atelier', () => {
  it('keeps shape and insertion groups separate and closes the menu after choosing, Escape or outside input', async () => {
    const wrapper = mount(PaperToolRail, {
      props: { tools, activeTool: 'pen' },
      global: { plugins: [i18n] },
    })
    await wrapper.get('[data-more-tools]').trigger('click')
    expect(wrapper.get('[data-tool="rectangle"]').isVisible()).toBe(true)
    expect(wrapper.get('[data-tool="image"]').isVisible()).toBe(false)
    await wrapper.get('[data-tool="triangle"]').trigger('click')
    expect(wrapper.emitted('choose')).toEqual([['triangle']])
    expect(wrapper.get('.paper-rail-menu').attributes('style')).toContain('display: none')
    await wrapper.get('[data-more-tools]').trigger('click')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await wrapper.vm.$nextTick()
    expect(wrapper.get('.paper-rail-menu').attributes('style')).toContain('display: none')
    await wrapper.get('[data-more-tools]').trigger('click')
    await wrapper.trigger('keydown', { key: 'Escape' })
    expect(wrapper.get('.paper-rail-menu').attributes('style')).toContain('display: none')
    await wrapper.trigger('keydown', { key: 'z', ctrlKey: true })
    await wrapper.trigger('keydown', { key: 'z', ctrlKey: true, shiftKey: true })
    expect(wrapper.emitted('undo')).toHaveLength(1)
    expect(wrapper.emitted('redo')).toHaveLength(1)
    wrapper.unmount()
  })
  it('offers five writing instruments in named groups and four font sizes only for text selections', async () => {
    const wrapper = mount(PaperContextBar, {
      props: {
        tool: 'pen',
        color: '#1739b7',
        width: 1.6,
        selection: false,
        text: false,
        fill: false,
        settingsOpen: false,
      },
      global: { plugins: [i18n] },
    })
    expect(wrapper.findAll('optgroup')).toHaveLength(2)
    expect(
      wrapper
        .findAll('[data-context-instrument] option')
        .map((option) => option.attributes('value'))
    ).toEqual(['pencil', 'graphite', 'pen', 'fountain', 'ink'])
    await wrapper.get('[data-context-instrument]').setValue('fountain')
    expect(wrapper.emitted('instrument')).toEqual([['fountain']])
    expect(wrapper.find('[data-context-font-size]').exists()).toBe(false)
    await wrapper.setProps({
      tool: 'select',
      selection: true,
      text: true,
      fill: true,
      fontSize: 22,
    })
    expect(
      wrapper.findAll('[data-context-font-size]').map((button) => button.text())
    ).toEqual(['14', '22', '36', '48'])
    await wrapper.get('[data-context-font-size="36"]').trigger('click')
    expect(wrapper.emitted('fontSize')).toEqual([[36]])
    await wrapper.get('input[type="number"]').setValue('999')
    expect(wrapper.emitted('fontSize')!.slice(-1)[0]).toEqual([72])
    wrapper.unmount()
  })
})
