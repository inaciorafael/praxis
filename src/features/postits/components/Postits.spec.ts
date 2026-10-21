import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import { i18n } from '@/shared/lib/i18n/i18n'
import PostitNote from './PostitNote.vue'
import PostitsPage from '@/pages/postits/PostitsPage.vue'
import type { PostitView } from '@/shared/types/postit'
const service = vi.hoisted(() => ({
  listPostits: vi.fn(),
  changePostit: vi.fn(async () => {}),
  syncPostits: vi.fn(async () => {}),
  onPostitsChanged: vi.fn(async () => () => {}),
  onPostitError: vi.fn(async () => () => {}),
}))
vi.mock('@/shared/lib/postits/postit.service', () => service)
const note: PostitView = {
  record: {
    id: 'note',
    title: 'My note',
    body: 'Independent text',
    revision: 2,
    pinned: true,
    collapsed: false,
    archived: false,
    color: 'yellow',
  },
  title: 'My note',
}
beforeEach(() => {
  vi.clearAllMocks()
  i18n.global.locale.value = 'en'
  service.listPostits.mockResolvedValue({ notes: [structuredClone(note)] })
})
async function page() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'postits', component: PostitsPage }],
  })
  await router.push('/')
  return mount(PostitsPage, { global: { plugins: [i18n, router] } })
}
describe('Independent Post-its', () => {
  it('separates archive, removal from screen, and collapse', async () => {
    const wrapper = mount(PostitNote, { props: { note }, global: { plugins: [i18n] } })
    expect(wrapper.text()).toContain('Independent text')
    await wrapper.get('[aria-label="Remove from screen"]').trigger('click')
    expect(wrapper.emitted('unpin')).toHaveLength(1)
    expect(wrapper.emitted('complete')).toBeUndefined()
    await wrapper.get('[aria-label="Collapse"]').trigger('click')
    expect(wrapper.emitted('collapse')).toHaveLength(1)
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Done')!
      .trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
    wrapper.unmount()
  })
  it('hides content in the small tab and opens only on explicit click', async () => {
    const wrapper = mount(PostitNote, {
      props: { note: { ...note, record: { ...note.record, collapsed: true } } },
      global: { plugins: [i18n] },
    })
    expect(wrapper.text()).not.toContain('Independent text')
    expect(wrapper.text()).not.toContain('My note')
    await wrapper.get('[aria-expanded="false"]').trigger('click')
    expect(wrapper.emitted('collapse')).toHaveLength(1)
    expect(wrapper.emitted('unpin')).toBeUndefined()
    wrapper.unmount()
  })
  it('uses independent IDs and revision guards when unpinning', async () => {
    const wrapper = await page()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Remove from screen')!
      .trigger('click')
    await flushPromises()
    expect(service.changePostit).toHaveBeenCalledWith({
      id: 'note',
      expectedRevision: 2,
      pinned: false,
      collapsed: true,
    })
    wrapper.unmount()
  })
  it('creates a free note without choosing a task and preserves failed drafts', async () => {
    service.listPostits.mockResolvedValue({ notes: [] })
    const wrapper = await page()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text().startsWith('New Post-it'))!
      .trigger('click')
    expect(wrapper.get('form').find('select').exists()).toBe(false)
    await wrapper.get('#postit-body').setValue('My own words')
    service.changePostit.mockRejectedValueOnce('conflict')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(service.changePostit).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedRevision: 0,
        body: 'My own words',
        pinned: true,
      })
    )
    expect(wrapper.get('[role="alert"]').text()).toBe('conflict')
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe(
      'My own words'
    )
    wrapper.unmount()
  })
  it('completes a note and reopens it from the one-week history', async () => {
    const wrapper = await page()
    await flushPromises()
    service.listPostits.mockResolvedValue({
      notes: [
        {
          ...note,
          record: {
            ...note.record,
            archived: true,
            completedAt: Date.now(),
            pinned: false,
            revision: 3,
          },
        },
      ],
    })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Done')!
      .trigger('click')
    await flushPromises()
    expect(service.changePostit).toHaveBeenCalledWith({
      id: 'note',
      expectedRevision: 2,
      completed: true,
    })
    await wrapper
      .findAll('button')
      .find((button) => button.text().startsWith('Completed'))!
      .trigger('click')
    expect(wrapper.text()).toContain('7 days')
    expect(wrapper.text()).toContain('Available until')
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Reopen')!
      .trigger('click')
    await flushPromises()
    expect(service.changePostit).toHaveBeenCalledWith({
      id: 'note',
      expectedRevision: 3,
      completed: false,
    })
    wrapper.unmount()
  })
  it('edits directly in the desktop note and keeps the original revision while typing', async () => {
    const wrapper = mount(PostitNote, { props: { note }, global: { plugins: [i18n] } })
    await wrapper
      .findAll('button')
      .find((button) => button.text() === 'Edit')!
      .trigger('click')
    await wrapper.get('textarea').setValue('Quick edit')
    expect(wrapper.get('[aria-label="Collapse"]').attributes('disabled')).toBeDefined()
    await wrapper.setProps({ note: { ...note, record: { ...note.record, revision: 3 } } })
    expect((wrapper.get('textarea').element as HTMLTextAreaElement).value).toBe(
      'Quick edit'
    )
    await wrapper.get('textarea').trigger('keydown', { key: 'Enter', ctrlKey: true })
    expect(wrapper.emitted('save')?.[0]?.[0]).toEqual({
      title: 'My note',
      body: 'Quick edit',
      expectedRevision: 2,
    })
    await wrapper.setProps({
      note: {
        title: 'My note',
        record: { ...note.record, body: 'Quick edit', revision: 4 },
      },
    })
    expect(wrapper.find('textarea').exists()).toBe(false)
    wrapper.unmount()
  })
  it('opens a new note with Alt+N and saves with Ctrl+Enter', async () => {
    const wrapper = await page()
    await flushPromises()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'n', altKey: true }))
    await flushPromises()
    await wrapper.get('#postit-body').setValue('Fast note')
    await wrapper.get('#postit-body').trigger('keydown', { key: 'Enter', ctrlKey: true })
    await flushPromises()
    expect(service.changePostit).toHaveBeenCalledWith(
      expect.objectContaining({ title: '', body: 'Fast note', collapsed: true })
    )
    wrapper.unmount()
  })
})
