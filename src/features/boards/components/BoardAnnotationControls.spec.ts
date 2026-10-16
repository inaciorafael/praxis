import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createI18n } from 'vue-i18n'
import type { BoardTextAnnotation } from '@/shared/types/board'
import BoardAnnotationControls from './BoardAnnotationControls.vue'

const annotation: BoardTextAnnotation = {
  type: 'underline',
  color: '#e07a28',
  strokeWidth: 2,
  padding: 5,
  iterations: 2,
  brackets: ['right'],
  animate: false,
  animationDuration: 800,
  animationDelay: 0,
  multiline: true,
  rtl: false,
}
function mountControls(value: BoardTextAnnotation | null = null) {
  return mount(BoardAnnotationControls, {
    props: { modelValue: value },
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
describe('BoardAnnotationControls', () => {
  it('offers every annotation style, initializes defaults and removes annotations', async () => {
    const wrapper = mountControls()
    expect(wrapper.findAll('[data-annotation]')).toHaveLength(8)
    await wrapper.get('[data-annotation="circle"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([
      { ...annotation, type: 'circle' },
    ])
    await wrapper.setProps({ modelValue: { ...annotation, type: 'circle' } })
    await wrapper.get('[data-annotation="none"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[1]).toEqual([null])
  })
  it('retains appearance settings when selecting another style', async () => {
    const value = {
      ...annotation,
      color: '#123456',
      padding: [1, 2, 3, 4] as [number, number, number, number],
      rtl: true,
    }
    const wrapper = mountControls(value)
    await wrapper.get('[data-annotation="box"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]).toEqual([{ ...value, type: 'box' }])
    expect(value.type).toBe('underline')
  })
  it('allows multiple bracket sides while retaining at least one', async () => {
    const wrapper = mountControls({ ...annotation, type: 'bracket' })
    await wrapper.get('[data-side="left"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toMatchObject({
      brackets: ['right', 'left'],
    })
    await wrapper.get('[data-side="right"]').trigger('click')
    expect(wrapper.emitted('update:modelValue')?.[1]?.[0]).toMatchObject({
      brackets: ['right'],
    })
  })
  it('bounds numeric controls and edits individual padding without losing other sides', async () => {
    const wrapper = mountControls({ ...annotation, padding: [2, 7] })
    await wrapper.get('[data-setting="strokeWidth"]').setValue(100)
    expect(wrapper.emitted('update:modelValue')?.[0]?.[0]).toMatchObject({
      strokeWidth: 8,
    })
    await wrapper.get('[data-padding-side="bottom"]').setValue(100)
    expect(wrapper.emitted('update:modelValue')?.[1]?.[0]).toMatchObject({
      padding: [2, 7, 24, 7],
    })
    await wrapper.get('[data-setting="iterations"]').setValue(-2)
    expect(wrapper.emitted('update:modelValue')?.[2]?.[0]).toMatchObject({
      iterations: 1,
    })
  })
  it('replays animation without changing persisted settings and stops editor shortcuts', async () => {
    const wrapper = mountControls({ ...annotation, animate: true })
    await wrapper.get('.annotation-replay').trigger('click')
    expect(wrapper.emitted('replay')).toEqual([[]])
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    let bubbled = false
    const host = document.createElement('div')
    host.appendChild(wrapper.element)
    host.addEventListener('keydown', () => {
      bubbled = true
    })
    wrapper.element.dispatchEvent(event)
    expect(bubbled).toBe(false)
  })
})
