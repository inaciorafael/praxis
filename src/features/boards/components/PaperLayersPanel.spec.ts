import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { i18n } from '@/shared/lib/i18n/i18n'
import PaperLayersPanel from './PaperLayersPanel.vue'
const layers = [
  { id: 'base', name: 'Sketch', visible: true, locked: false, opacity: 1 },
  { id: 'top', name: 'Notes', visible: true, locked: false, opacity: 0.5 },
]
function setup(readOnly = false) {
  return mount(PaperLayersPanel, {
    props: {
      layers,
      elements: [],
      activeId: 'base',
      selectedCount: 0,
      readOnly,
      collapsed: false,
    },
    global: { plugins: [i18n] },
  })
}
describe('compact layers', () => {
  it('keeps settings closed until requested, closes on outside input, Escape, active change and collapse', async () => {
    const w = setup()
    expect(w.find('[data-layer-opacity]').exists()).toBe(false)
    await w.get('[data-layer-select="base"]').trigger('click')
    expect(w.find('[data-layer-opacity="base"]').exists()).toBe(true)
    await w.trigger('keydown', { key: 'Escape' })
    expect(w.find('[data-layer-opacity]').exists()).toBe(false)
    await w.get('[data-layer-options="base"]').trigger('click')
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await w.vm.$nextTick()
    expect(w.find('[data-layer-opacity]').exists()).toBe(false)
    await w.get('[data-layer-options="top"]').trigger('click')
    await w.setProps({ activeId: 'top' })
    expect(w.find('[data-layer-opacity]').exists()).toBe(false)
    await w.get('[data-layer-options="top"]').trigger('click')
    await w.setProps({ collapsed: true })
    await w.setProps({ collapsed: false })
    expect(w.find('[data-layer-opacity]').exists()).toBe(false)
    w.unmount()
  })
  it('retains visibility, lock, opacity, ordering and safe removal in the compact list', async () => {
    const w = setup()
    await w.get('[data-layer-visibility="top"]').trigger('click')
    expect(w.emitted('patch')).toEqual([['top', { visible: false }]])
    await w.get('[data-layer-options="base"]').trigger('click')
    await w.get('[data-layer-lock="base"]').trigger('click')
    await w.get('[data-layer-opacity="base"]').setValue('25')
    expect(w.emitted('patch')).toContainEqual(['base', { locked: true }])
    expect(w.emitted('patch')).toContainEqual(['base', { opacity: 0.25 }])
    await w.get('[data-layer-select="top"]').trigger('click')
    expect(w.emitted('active')).toEqual([['top']])
    w.unmount()
  })
  it('disables mutations on a locked Paper', async () => {
    const w = setup(true)
    await w.get('[data-layer-options="base"]').trigger('click')
    expect(w.get('[data-layer-lock="base"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-layer-opacity="base"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-add-layer]').attributes('disabled')).toBeDefined()
    w.unmount()
  })
  it('saves renaming once on Enter, supports keyboard cancellation and respects order boundaries', async () => {
    const w = setup()
    await w.get('[data-layer-options="base"]').trigger('click')
    await w
      .get('button[aria-label="' + i18n.global.t('boards.layers.up') + '"]')
      .trigger('click')
    expect(w.emitted('order')).toEqual([['base', 1]])
    expect(
      w
        .get('button[aria-label="' + i18n.global.t('boards.layers.down') + '"]')
        .attributes('disabled')
    ).toBeDefined()
    const rename = w
      .findAll('.layer-actions button')
      .find((button) => button.text() === i18n.global.t('boards.layers.rename'))!
    await rename.trigger('click')
    const input = w.get('input:not([type])')
    await input.setValue('Outline')
    await input.trigger('keydown', { key: 'Enter' })
    expect(w.emitted('patch')).toEqual([['base', { name: 'Outline' }]])
    expect(w.find('input:not([type])').exists()).toBe(false)
    await rename.trigger('click')
    await w.get('input:not([type])').setValue('Cancel this')
    await w.get('input:not([type])').trigger('keydown', { key: 'Escape' })
    expect(w.emitted('patch')).toHaveLength(1)
    w.unmount()
  })
})
