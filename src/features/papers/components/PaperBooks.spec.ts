import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { i18n } from '@/shared/lib/i18n/i18n'
import PaperBooks from './PaperBooks.vue'

describe('PaperBooks', () => {
  it('keeps the form until persistence confirms success and removes only the notebook', async () => {
    i18n.global.locale.value = 'en'
    const wrapper = mount(PaperBooks, {
      props: {
        books: [{ id: 'b', name: 'Ideas', revision: 3, paperIds: ['p'] }],
        modelValue: 'b',
        busy: false,
        total: 1,
        loose: 0,
      },
      global: { plugins: [i18n] },
    })
    const button = (text: string) =>
      wrapper.findAll('button').find((item) => item.text() === text)!
    await button('Rename').trigger('click')
    await wrapper.get('input').setValue('Sketches')
    await wrapper.get('form').trigger('submit')
    const [change, done] = wrapper.emitted('change')![0]!
    expect(change).toEqual({ type: 'rename', id: 'b', revision: 3, name: 'Sketches' })
    expect(wrapper.find('form').exists()).toBe(true)
    ;(done as () => void)()
    await wrapper.vm.$nextTick()
    expect(wrapper.find('form').exists()).toBe(false)
    await button('Remove notebook').trigger('click')
    expect(wrapper.text()).toContain('Your Papers will be kept')
    await button('Remove notebook only').trigger('click')
    expect(wrapper.emitted('change')![1]![0]).toEqual({
      type: 'remove',
      id: 'b',
      revision: 3,
    })
  })
})
