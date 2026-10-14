import { createPinia, setActivePinia } from 'pinia'
import { flushPromises, shallowMount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/shared/lib/i18n/i18n'
import { useAppStore } from '@/stores/app.store'
import { useBadgeStore } from '@/stores/badge.store'
import { useNotificationStore } from '@/stores/notification.store'
import { useVaultStore } from '@/stores/vault.store'
import SettingsPage from './SettingsPage.vue'

describe('Settings theme chooser', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    i18n.global.locale.value = 'en'
    const app = useAppStore()
    app.config = {
      theme: 'light', language: 'en', startWithWindows: false,
      startMinimized: false, minimizeToTrayWhenUnlocked: true,
      notificationsEnabled: true, badgeEnabled: true, completedTaskRetentionDays: null,
    }
    vi.spyOn(app, 'hydrateConfig').mockResolvedValue(undefined)
    vi.spyOn(useVaultStore(), 'hydrate').mockResolvedValue(undefined)
    vi.spyOn(useVaultStore(), 'hydrateSafetyCopies').mockResolvedValue(undefined)
    vi.spyOn(useBadgeStore(), 'hydrate').mockResolvedValue(undefined)
    vi.spyOn(useNotificationStore(), 'hydrate').mockResolvedValue(undefined)
  })

  function mountPage() {
    return shallowMount(SettingsPage, { global: { plugins: [i18n], stubs: { RouterLink: true } } })
  }

  it('offers all five themes and identifies the saved selection', async () => {
    const wrapper = mountPage()
    await flushPromises()
    const choices = wrapper.findAll('[role="group"] button')
    expect(choices).toHaveLength(5)
    expect(choices.map(button => button.find('.font-semibold').text())).toEqual([
      'Paper', 'Dark', 'Sepia', 'Forest', 'Midnight',
    ])
    expect(choices.map(button => button.find('.text-small').text())).toEqual([
      'Soft and matte', 'Low light', 'Warm paper tones', 'Soft greens', 'Deep blue',
    ])
    expect(choices[0]!.attributes('aria-pressed')).toBe('true')
    expect(choices[4]!.attributes('aria-pressed')).toBe('false')
    wrapper.unmount()
  })

  it('locks choices while saving and selects the persisted theme after success', async () => {
    const app = useAppStore()
    let finish!: () => void
    const update = vi.spyOn(app, 'updateConfig').mockImplementation(async patch => {
      await new Promise<void>(resolve => { finish = resolve })
      app.config = { ...app.config!, ...patch }
      return true
    })
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.findAll('[role="group"] button')[4]!.trigger('click')
    expect(update).toHaveBeenCalledWith({ theme: 'midnight' })
    expect(wrapper.findAll('[role="group"] button').every(button => button.attributes('disabled') !== undefined)).toBe(true)
    finish()
    await flushPromises()
    expect(wrapper.findAll('[role="group"] button')[4]!.attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('[role="group"] button')[4]!.attributes('disabled')).toBeUndefined()
    wrapper.unmount()
  })

  it('keeps the saved selection and shows a persistence error', async () => {
    const app = useAppStore()
    vi.spyOn(app, 'updateConfig').mockImplementation(async () => {
      app.error = 'Unable to save settings'
      return false
    })
    const wrapper = mountPage()
    await flushPromises()
    await wrapper.findAll('[role="group"] button')[2]!.trigger('click')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').text()).toBe('Unable to save settings')
    expect(wrapper.findAll('[role="group"] button')[0]!.attributes('aria-pressed')).toBe('true')
    wrapper.unmount()
  })
})
