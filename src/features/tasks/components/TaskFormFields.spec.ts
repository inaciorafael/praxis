import { createPinia, setActivePinia } from 'pinia'
import { shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it } from 'vitest'
import { i18n } from '@/shared/lib/i18n/i18n'
import { useTagStore } from '@/stores/tag.store'
import TaskFormFields from './TaskFormFields.vue'

describe('TaskFormFields quick schedule', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    useTagStore().isReady = true
  })

  it('updates the form model when a quick action is clicked', async () => {
    const wrapper = shallowMount(TaskFormFields, {
      props: {
        modelValue: {
          title: '',
          notes: '',
          plannedFor: '',
          dueAt: '',
          reminderAt: '',
        },
        selectedTagNames: [],
      },
      global: { plugins: [i18n] },
    })

    const tomorrowButton = wrapper
      .findAll('button')
      .find((button) => button.text() === 'Tomorrow at 9 AM')

    expect(tomorrowButton).toBeDefined()
    await tomorrowButton?.trigger('click')

    const updates = wrapper.emitted('update:modelValue')
    expect(updates).toHaveLength(1)
    expect(updates?.[0]?.[0]).toMatchObject({
      dueAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T09:00$/),
    })
  })
})
