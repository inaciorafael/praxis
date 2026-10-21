import { mount, flushPromises } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import PaperLibraryPanel from './PaperLibraryPanel.vue'
import {
  listPaperLibrary,
  getPaperLibraryItem,
  changePaperLibrary,
} from '@/shared/lib/boards/paper-library.service'
vi.mock('@/shared/lib/boards/paper-library.service', () => ({
  listPaperLibrary: vi.fn(),
  getPaperLibraryItem: vi.fn(),
  changePaperLibrary: vi.fn(),
}))
const item = { id: 'component', name: 'Card', revision: 1, elements: [] }
const summary = { id: 'component', name: 'Card', revision: 1, elementCount: 1 }
const create = () =>
  mount(PaperLibraryPanel, {
    props: { selection: [], readOnly: false },
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
beforeEach(() => {
  vi.resetAllMocks()
  vi.mocked(listPaperLibrary).mockResolvedValue([summary])
  vi.mocked(getPaperLibraryItem).mockResolvedValue(item)
  vi.mocked(changePaperLibrary).mockResolvedValue([summary])
})
describe('library panel', () => {
  it('loads summaries first, fetches a preview on demand and inserts the selected copy', async () => {
    const wrapper = create()
    await flushPromises()
    expect(getPaperLibraryItem).not.toHaveBeenCalled()
    await wrapper.get('.library-list button').trigger('click')
    await flushPromises()
    expect(getPaperLibraryItem).toHaveBeenCalledWith('component')
    await wrapper.get('[data-library-insert]').trigger('click')
    expect(wrapper.emitted('insert')![0]![0]).toEqual([])
    wrapper.unmount()
  })
  it('protects locked insertion and reports loading failures inline', async () => {
    const wrapper = create()
    await flushPromises()
    await wrapper.get('.library-list button').trigger('click')
    await flushPromises()
    await wrapper.setProps({ readOnly: true })
    expect(wrapper.get('[data-library-insert]').attributes('disabled')).toBeDefined()
    wrapper.unmount()
    vi.mocked(listPaperLibrary).mockRejectedValueOnce(new Error('Load failed'))
    const failing = create()
    await flushPromises()
    expect(failing.get('[role="alert"]').text()).toContain('Load failed')
    failing.unmount()
  })
})
