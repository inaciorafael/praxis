import { mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { describe, expect, it } from 'vitest'
import type { BoardScene } from '@/shared/types/board'
import PaperScenesPanel from './PaperScenesPanel.vue'

const scenes: BoardScene[] = [
  {
    id: 'overview',
    title: 'Overview',
    x: -40,
    y: 90,
    width: 1600,
    height: 900,
    aspectRatio: '16:9',
  },
  {
    id: 'detail',
    title: 'Detail',
    x: 500,
    y: 240,
    width: 800,
    height: 600,
    aspectRatio: '4:3',
  },
]
function panel(props: Partial<InstanceType<typeof PaperScenesPanel>['$props']> = {}) {
  return mount(PaperScenesPanel, {
    props: { scenes, contentId: 'paper-world', activeId: 'overview', ...props },
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
describe('PaperScenesPanel', () => {
  it('previews world coordinates and focuses without changing content', async () => {
    const wrapper = panel()
    expect(wrapper.get('svg').attributes('viewBox')).toBe('-40 90 1600 900')
    expect(wrapper.get('use').attributes('href')).toBe('#paper-world')
    await wrapper.findAll('.scene-preview')[1]!.trigger('click')
    expect(wrapper.emitted('focus')).toEqual([['detail']])
    expect(wrapper.emitted('update')).toBeUndefined()
    await wrapper.get('[data-adjust]').trigger('click')
    expect(wrapper.emitted('edit')).toEqual([['overview']])
  })
  it('renames and adjusts a frame ratio without moving drawings', async () => {
    const wrapper = panel()
    await wrapper.get('.scene-name').setValue('  Intro  ')
    expect(wrapper.emitted('update')?.[0]).toEqual([{ ...scenes[0], title: 'Intro' }])
    await wrapper.get('select').setValue('4:3')
    expect(wrapper.emitted('update')?.[1]).toEqual([
      { ...scenes[0], aspectRatio: '4:3', height: 1200 },
    ])
    expect(scenes[0]!.height).toBe(900)
    await wrapper.get('[data-remove]').trigger('click')
    expect(wrapper.emitted('remove')).toEqual([['overview']])
  })
  it('supports both keyboard-accessible ordering and drag reordering', async () => {
    const wrapper = panel()
    await wrapper.get('[data-move="down"]').trigger('click')
    expect(wrapper.emitted('reorder')?.[0]).toEqual([['detail', 'overview']])
    await wrapper.get('[data-scene="detail"]').trigger('dragstart')
    await wrapper.get('[data-scene="overview"]').trigger('drop')
    expect(wrapper.emitted('reorder')?.[1]).toEqual([['detail', 'overview']])
    expect(scenes.map((scene) => scene.id)).toEqual(['overview', 'detail'])
  })
  it('keeps presentation, exporting and browsing available in read-only mode', async () => {
    const wrapper = panel({ readOnly: true })
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    expect(wrapper.get('.scene-name').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-adjust]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-remove]').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-scene]').attributes('draggable')).toBe('false')
    await wrapper.get('[data-present]').trigger('click')
    await wrapper.get('[data-export]').trigger('click')
    expect(wrapper.emitted('present')).toHaveLength(1)
    expect(wrapper.emitted('exportPdf')).toHaveLength(1)
    await wrapper.get('[data-scene="detail"]').trigger('dragstart')
    await wrapper.get('[data-scene="overview"]').trigger('drop')
    expect(wrapper.emitted('reorder')).toBeUndefined()
  })
  it('offers three frame types, hides frames and handles empty/limited scenes', async () => {
    const wrapper = panel({ scenes: [] })
    expect(wrapper.find('.scene-empty').exists()).toBe(true)
    expect(wrapper.get('[data-present]').attributes('disabled')).toBeDefined()
    await wrapper.get('[data-create="16:9"]').trigger('click')
    expect(wrapper.emitted('create')).toEqual([['16:9']])
    await wrapper.get('input[type="checkbox"]').setValue(false)
    expect(wrapper.emitted('visibility')).toEqual([[false]])
    await wrapper.setProps({
      scenes: Array.from({ length: 100 }, (_, i) => ({ ...scenes[0]!, id: String(i) })),
      exporting: true,
    })
    expect(wrapper.get('fieldset').attributes('disabled')).toBeDefined()
    expect(wrapper.get('[data-export]').attributes('disabled')).toBeDefined()
  })
})
