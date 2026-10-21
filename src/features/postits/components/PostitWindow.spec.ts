import { mount, flushPromises } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/shared/lib/i18n/i18n'
import PostitWindow from './PostitWindow.vue'
import type { DesktopPostit, PostitChange } from '@/shared/types/postit'
const api = vi.hoisted(() => ({
  getPostitWindow: vi.fn(),
  changePostit: vi.fn(),
  dragPostit: vi.fn(),
  presentPostit: vi.fn(async () => {}),
  resizePostit: vi.fn(),
  previewPostitSize: vi.fn(),
  onPostitsChanged: vi.fn(async () => () => {}),
  onPostitError: vi.fn(async () => () => {}),
  onPostitFinishRequested: vi.fn(async () => () => {}),
}))
vi.mock('@/shared/lib/postits/postit.service', () => api)
let entry: DesktopPostit
beforeEach(() => {
  vi.clearAllMocks()
  i18n.global.locale.value = 'en'
  entry = {
    group: { id: 'pile', name: 'References', revision: 1 },
    notes: [
      {
        title: 'First',
        record: {
          id: 'one',
          title: 'First',
          body: 'Read this',
          revision: 1,
          pinned: true,
          collapsed: false,
          archived: false,
          color: 'yellow',
          preferredMode: 'compact',
        },
      },
    ],
  }
  api.getPostitWindow.mockImplementation(async () => [
    structuredClone(entry),
    { language: 'en' },
  ])
  api.changePostit.mockImplementation(async (change: PostitChange) => {
    const note = entry.notes.find((n) => n.record.id === change.id)!
    if (note.record.revision !== change.expectedRevision) throw 'conflict'
    Object.assign(note.record, change)
    note.record.revision++
    note.title = note.record.title
  })
})
describe('Desktop Post-it pile', () => {
  it('opens one member editor lazily and returns to idle after saving', async () => {
    const wrapper = mount(PostitWindow, { global: { plugins: [i18n] } })
    await flushPromises()
    expect(wrapper.find('textarea').exists()).toBe(false)
    await wrapper.get('.pile-name').trigger('click')
    await flushPromises()
    expect(api.presentPostit).toHaveBeenLastCalledWith('compact', false, null)
    await wrapper.get('li button').trigger('click')
    await flushPromises()
    expect(api.presentPostit).toHaveBeenLastCalledWith('expanded', false, 'one')
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Edit')!
      .trigger('click')
    expect(
      wrapper.get('[aria-label="Back to pile"]').attributes('disabled')
    ).toBeDefined()
    await wrapper.get('textarea').setValue('New reference')
    await wrapper.get('textarea').trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(entry.notes[0].record.body).toBe('New reference')
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(api.presentPostit).toHaveBeenLastCalledWith(null, false, 'one')
    await wrapper.get('[aria-label="Back to pile"]').trigger('click')
    await flushPromises()
    expect(wrapper.get('li').text()).toBe('First')
    await wrapper.get('[aria-label="Close pile"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('ul').exists()).toBe(false)
    expect(entry.notes).toHaveLength(1)
    wrapper.unmount()
  })
})
