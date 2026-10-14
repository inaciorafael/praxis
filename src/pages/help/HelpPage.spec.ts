import { flushPromises, mount } from '@vue/test-utils'
import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'
import { i18n } from '@/shared/lib/i18n/i18n'
import HelpPaperPreview from '@/features/help/components/HelpPaperPreview.vue'
import HelpPage from './HelpPage.vue'

async function mountHelp(locale: 'en' | 'pt-BR') {
  i18n.global.locale.value = locale
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app/help', component: HelpPage },
      { path: '/app/papers', component: { template: '<div>Papers</div>' } },
    ],
  })
  await router.push('/app/help')
  await router.isReady()
  const wrapper = mount(HelpPage, {
    global: { plugins: [router, i18n], stubs: { HelpCreatorSupport: true } },
  })
  return { wrapper, router }
}

describe('Paper illustrated tutorial', () => {
  it.each(['en', 'pt-BR'] as const)(
    'switches instructions, illustration and selected step together in %s',
    async (locale) => {
      const { wrapper } = await mountHelp(locale)
      const tutorial = wrapper.get('#papers')
      const steps = tutorial.findAll('button')
      expect(steps).toHaveLength(6)
      for (const [index, stage] of [
        'create',
        'draw',
        'text',
        'organize',
        'link',
        'share',
      ].entries()) {
        await steps[index]!.trigger('click')
        expect(tutorial.findAll('button[aria-pressed="true"]')).toHaveLength(1)
        expect(steps[index]!.attributes('aria-pressed')).toBe('true')
        expect(tutorial.get('[aria-live="polite"]').text()).toContain(
          i18n.global.t(`help.papers.tutorial.${stage}.body`)
        )
        expect(wrapper.findComponent(HelpPaperPreview).props('stage')).toBe(stage)
        expect(tutorial.get('figcaption').text()).toBe(
          i18n.global.t(`help.papers.tutorial.${stage}.caption`)
        )
      }
      expect(tutorial.text()).not.toContain('help.papers.tutorial.')
      wrapper.unmount()
    }
  )

  it('offers an explicit route from the tutorial to the Paper library', async () => {
    const { wrapper, router } = await mountHelp('en')
    await wrapper.get('#papers a[href="/app/papers"]').trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/app/papers')
    wrapper.unmount()
  })
})
