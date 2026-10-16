import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import type { PaperAppearance } from '@/shared/types/board'
import PaperBackgroundControls from './PaperBackgroundControls.vue'

const mountControls = (props: Partial<PaperAppearance> = {}) =>
  mount(PaperBackgroundControls, {
    props,
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

describe('PaperBackgroundControls', () => {
  it('shows smooth light paper for legacy documents and presents all four patterns', () => {
    const wrapper = mountControls()
    expect(
      wrapper.get('[data-paper-background="plain"]').attributes('aria-pressed')
    ).toBe('true')
    expect(wrapper.get('[data-paper-scheme="light"]').attributes('aria-pressed')).toBe(
      'true'
    )
    expect(wrapper.findAll('[data-paper-background]')).toHaveLength(4)
    expect(wrapper.findAll('[data-paper-scheme]')).toHaveLength(2)
  })

  it('changes a pattern while retaining the current color scheme', async () => {
    const wrapper = mountControls({ background: 'plain', colorScheme: 'dark' })
    await wrapper.get('[data-paper-background="ruled"]').trigger('click')
    expect(wrapper.emitted('change')).toEqual([
      [{ background: 'ruled', colorScheme: 'dark' }],
    ])
    expect(wrapper.props('background')).toBe('plain')
    await wrapper.setProps({ background: 'ruled' })
    expect(
      wrapper.get('[data-paper-background="ruled"]').attributes('aria-pressed')
    ).toBe('true')
  })

  it('changes the color scheme while retaining the pattern and updates its previews', async () => {
    const wrapper = mountControls({ background: 'grid', colorScheme: 'light' })
    const lightPreview = wrapper.get('.paper-background-thumbnail').attributes('style')
    await wrapper.get('[data-paper-scheme="dark"]').trigger('click')
    expect(wrapper.emitted('change')).toEqual([
      [{ background: 'grid', colorScheme: 'dark' }],
    ])
    await wrapper.setProps({ colorScheme: 'dark' })
    expect(wrapper.get('[data-paper-background="grid"]').attributes('aria-pressed')).toBe(
      'true'
    )
    expect(wrapper.get('[data-paper-scheme="dark"]').attributes('aria-pressed')).toBe(
      'true'
    )
    expect(wrapper.get('.paper-background-thumbnail').attributes('style')).not.toBe(
      lightPreview
    )
  })

  it('closes with Escape or the close button without changing Paper settings', async () => {
    const wrapper = mountControls()
    await wrapper.trigger('keydown', { key: 'Escape' })
    await wrapper.get('.paper-background-close').trigger('click')
    expect(wrapper.emitted('close')).toHaveLength(2)
    expect(wrapper.emitted('change')).toBeUndefined()
  })
})
