import { useAppStore } from '@/stores/app.store'
import { createPinia, setActivePinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createRouter, createMemoryHistory } from 'vue-router'
import { i18n } from '@/shared/lib/i18n/i18n'
import PostitNote from './PostitNote.vue'
import PostitsPage from '@/pages/postits/PostitsPage.vue'
import type { PostitView } from '@/shared/types/postit'
const service = vi.hoisted(() => ({
  listPostits: vi.fn(),
  changePostit: vi.fn(async (_change?: any) => {}),
  changePostitGroup: vi.fn(async () => {}),
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
  setActivePinia(createPinia())
  vi.clearAllMocks()
  i18n.global.locale.value = 'en'
  const records = [structuredClone(note)]
  service.listPostits.mockResolvedValue({ notes: records, groups: [] })
  service.changePostit.mockImplementation(async (change?: any) => {
    if (!change) return
    let item = records.find((n) => n.record.id === change.id)
    if (!item) {
      item = {
        title: '',
        record: { ...note.record, id: change.id, revision: 0, title: '', body: '' },
      }
      records.push(item)
    }
    if (item.record.revision !== change.expectedRevision) throw 'conflict'
    Object.assign(item.record, change)
    item.record.revision++
    item.title = item.record.title
  })
})
async function page() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', name: 'postits', component: PostitsPage }],
  })
  await router.push('/')
  return mount(PostitsPage, { global: { plugins: [i18n, router] } })
}
afterEach(() => vi.useRealTimers())
describe('Independent Post-its', () => {
  it('separates completion, removal and temporary closing without saving a mode', async () => {
    const wrapper = mount(PostitNote, { props: { note }, global: { plugins: [i18n] } })
    await wrapper.get('[aria-expanded="false"]').trigger('click')
    expect(wrapper.text()).toContain('Independent text')
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.find('input[type="checkbox"]').exists()).toBe(false)
    await wrapper.get('[aria-label="Remove from screen"]').trigger('click')
    expect(wrapper.emitted('unpin')).toHaveLength(1)
    expect(wrapper.emitted('complete')).toBeUndefined()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Done')!
      .trigger('click')
    expect(wrapper.emitted('complete')).toHaveLength(1)
    await wrapper.get('[aria-label="Collapse"]').trigger('click')
    expect(wrapper.emitted('present')?.slice(-1)[0]).toEqual([null, false])
    expect(wrapper.find('.postit-content').exists()).toBe(false)
    wrapper.unmount()
  })
  it('identifies Micro notes and opens a temporary view without storing presentation state', async () => {
    const wrapper = mount(PostitNote, {
      props: { note: { ...note, record: { ...note.record, collapsed: true } } },
      global: { plugins: [i18n] },
    })
    expect(wrapper.text()).not.toContain('Independent text')
    expect(wrapper.find('select').exists()).toBe(false)
    expect(wrapper.text()).toContain('My note')
    await wrapper.get('[aria-expanded="false"]').trigger('click')
    expect(wrapper.emitted('present')?.some((value) => value[0] === 'expanded')).toBe(
      true
    )
    expect(wrapper.emitted('mode')).toBeUndefined()
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
    await wrapper.get('article').trigger('keydown', { key: 'Enter' })
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
      expectedRevision: 3,
    })
    const acknowledge = wrapper.emitted('save')![0][1] as (result: PostitView) => void
    acknowledge({
      title: 'My note',
      record: { ...note.record, body: 'Quick edit', revision: 4 },
    })
    await flushPromises()
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
      expect.objectContaining({ title: '', body: 'Fast note' })
    )
    wrapper.unmount()
  })
  it('uses saved preferences for new notes without changing existing notes', async () => {
    const app = useAppStore()
    app.config = {
      language: 'en',
      theme: 'light',
      startWithWindows: false,
      startMinimized: false,
      minimizeToTrayWhenUnlocked: true,
      notificationsEnabled: true,
      badgeEnabled: true,
      completedTaskRetentionDays: null,
      postitPreferences: {
        desktopEnabled: false,
        desktopLimit: 1,
        pinNew: false,
        color: 'pink',
      },
    }
    const wrapper = await page()
    await flushPromises()
    await wrapper
      .findAll('button')
      .find((button) => button.text().startsWith('New Post-it'))!
      .trigger('click')
    await wrapper.get('#postit-body').setValue('Preferred')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(service.changePostit).toHaveBeenCalledWith(
      expect.objectContaining({ color: 'pink', pinned: false })
    )
    expect(wrapper.text()).toContain('Desktop display is paused')
    wrapper.unmount()
  })
  it('opens a delayed keyboard preview and Escape restores idle state', async () => {
    vi.useFakeTimers()
    const wrapper = mount(PostitNote, {
      props: { note: { ...note, record: { ...note.record, preferredMode: 'micro' } } },
      global: { plugins: [i18n] },
    })
    await wrapper.get('article').trigger('focusin')
    await vi.advanceTimersByTimeAsync(299)
    expect(wrapper.find('.postit-content').exists()).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(wrapper.find('.postit-content').exists()).toBe(true)
    expect(wrapper.find('textarea').exists()).toBe(false)
    await wrapper.get('article').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('.postit-content').exists()).toBe(false)
    expect(wrapper.emitted('mode')).toBeUndefined()
    wrapper.unmount()
  })
  it('uses automatic preview even for notes with legacy mode locks', async () => {
    vi.useFakeTimers()
    const wrapper = mount(PostitNote, {
      props: {
        note: {
          ...note,
          record: { ...note.record, preferredMode: 'micro', modeLocked: true },
        },
      },
      global: { plugins: [i18n] },
    })
    await wrapper.get('article').trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(1000)
    expect(wrapper.find('.postit-content').exists()).toBe(true)
    expect(wrapper.emitted('present')).toEqual([['compact', false]])
    wrapper.unmount()
  })
  it('autosaves once after typing and Escape finishes without dropping text', async () => {
    vi.useFakeTimers()
    const wrapper = mount(PostitNote, {
      props: {
        note,
        onSave: (value: any, settled: (n: PostitView) => void) =>
          settled({
            title: value.title,
            record: { ...note.record, ...value, revision: 3 },
          }),
      },
      global: { plugins: [i18n] },
    })
    await wrapper.get('article').trigger('keydown', { key: 'Enter' })
    await wrapper.get('textarea').setValue('Remember the draft')
    await vi.advanceTimersByTimeAsync(600)
    expect(wrapper.emitted('save')).toHaveLength(1)
    expect(wrapper.find('textarea').exists()).toBe(true)
    await wrapper.get('textarea').trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(wrapper.find('textarea').exists()).toBe(false)
    expect(wrapper.emitted('save')).toHaveLength(1)
    wrapper.unmount()
  })
  it('preserves a draft on a real text conflict instead of overwriting remote text', async () => {
    const wrapper = mount(PostitNote, { props: { note }, global: { plugins: [i18n] } })
    await wrapper.get('article').trigger('keydown', { key: 'Enter' })
    await wrapper.get('textarea').setValue('Local draft')
    await wrapper.setProps({
      note: {
        ...note,
        record: { ...note.record, revision: 3, body: 'Changed elsewhere' },
      },
    })
    await wrapper.get('textarea').trigger('keydown', { key: 'Escape' })
    await flushPromises()
    expect(wrapper.get('textarea').element.value).toBe('Local draft')
    expect(wrapper.get('[role="alert"]').text()).toContain('another window')
    expect(wrapper.emitted('save')).toBeUndefined()
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Discard draft and reload')!
      .trigger('click')
    expect(wrapper.get('textarea').element.value).toBe('Changed elsewhere')
    wrapper.unmount()
  })
  it('groups selected notes with their revisions and finds members by body', async () => {
    const other = {
      ...note,
      title: 'Another',
      record: {
        ...note.record,
        id: 'second',
        title: 'Another',
        body: 'A hidden reference',
      },
    }
    service.listPostits.mockResolvedValue({
      notes: [structuredClone(note), other],
      groups: [],
    })
    const wrapper = await page()
    await flushPromises()
    const checkboxes = wrapper.findAll('.postit-select input')
    await checkboxes[0].setValue(true)
    await checkboxes[1].setValue(true)
    await wrapper.get('[aria-label="Pile name"]').setValue('References')
    await wrapper.get('.postit-group-create').trigger('submit')
    await flushPromises()
    expect(service.changePostitGroup).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'References',
        expectedRevision: 0,
        members: [
          { id: 'note', revision: 2 },
          { id: 'second', revision: 2 },
        ],
      })
    )
    service.listPostits.mockResolvedValue({
      notes: [
        {
          ...other,
          record: { ...other.record, preferredMode: 'micro', groupId: 'pile' },
        },
      ],
      groups: [{ id: 'pile', name: 'References', revision: 1 }],
    })
    // A refresh caused by an ordinary action updates the same organizer.
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Remove from screen')!
      .trigger('click')
    await flushPromises()
    await wrapper.get('input[type="search"]').setValue('hidden')
    expect(wrapper.findAll('.postit-row')).toHaveLength(1)
    expect(wrapper.get('mark').text()).toBe('hidden')
    expect(wrapper.text()).toContain('References')
    wrapper.unmount()
  })
  it('serializes autosave when typing continues during a pending write', async () => {
    vi.useFakeTimers()
    const replies: ((note: PostitView) => void)[] = []
    const wrapper = mount(PostitNote, {
      props: {
        note,
        onSave: (_value: any, settled: (n: PostitView) => void) => {
          replies.push(settled)
        },
      },
      global: { plugins: [i18n] },
    })
    await wrapper.get('article').trigger('keydown', { key: 'Enter' })
    await wrapper.get('textarea').setValue('First draft')
    await vi.advanceTimersByTimeAsync(600)
    await wrapper.get('textarea').setValue('Latest draft')
    await wrapper.get('textarea').trigger('keydown', { key: 'Escape' })
    expect(wrapper.emitted('save')).toHaveLength(1)
    replies[0]({
      title: note.title,
      record: { ...note.record, body: 'First draft', revision: 3 },
    })
    await flushPromises()
    expect(wrapper.emitted('save')?.[1]?.[0]).toEqual({
      title: note.title,
      body: 'Latest draft',
      expectedRevision: 3,
    })
    replies[1]({
      title: note.title,
      record: { ...note.record, body: 'Latest draft', revision: 4 },
    })
    await flushPromises()
    expect(wrapper.find('textarea').exists()).toBe(false)
    wrapper.unmount()
  })
  it('keeps dozens of notes as lightweight cards and searches without mounting editors', async () => {
    service.listPostits.mockResolvedValue({
      notes: Array.from({ length: 60 }, (_, i) => ({
        title: 'Note ' + i,
        record: {
          ...note.record,
          id: 'note-' + i,
          title: 'Note ' + i,
          body: i === 57 ? 'Unique reference' : 'Text ' + i,
          preferredMode: 'micro',
        },
      })),
      groups: [],
    })
    const wrapper = await page()
    await flushPromises()
    expect(wrapper.findAll('.postit-row')).toHaveLength(60)
    expect(wrapper.findAll('textarea')).toHaveLength(0)
    await wrapper.get('input[type="search"]').setValue('Unique reference')
    expect(wrapper.findAll('.postit-row')).toHaveLength(1)
    expect(wrapper.text()).toContain('Note 57')
    expect(service.changePostit).not.toHaveBeenCalled()
    wrapper.unmount()
  })

  it('does not reopen the preview when native resizing sends a synthetic mouseenter after Escape', async () => {
    vi.useFakeTimers()
    const wrapper = mount(PostitNote, {
      props: { note: { ...note, record: { ...note.record, preferredMode: 'micro' } } },
      global: { plugins: [i18n] },
    })
    await wrapper.get('article').trigger('keydown', { key: ' ' })
    expect(wrapper.find('.postit-content').exists()).toBe(true)
    await wrapper.get('article').trigger('keydown', { key: 'Escape' })
    await wrapper.get('article').trigger('mouseenter')
    await vi.advanceTimersByTimeAsync(350)
    expect(wrapper.find('.postit-content').exists()).toBe(false)
    wrapper.unmount()
  })
  it('retains keyboard focus when the Micro opening button is removed', async () => {
    const wrapper = mount(PostitNote, {
      attachTo: document.body,
      props: { note: { ...note, record: { ...note.record, preferredMode: 'micro' } } },
      global: { plugins: [i18n] },
    })
    await wrapper.get('[aria-expanded="false"]').trigger('click')
    await flushPromises()
    expect(document.activeElement).toBe(wrapper.get('article').element)
    await wrapper.get('article').trigger('keydown', { key: 'Escape' })
    expect(wrapper.find('.postit-content').exists()).toBe(false)
    wrapper.unmount()
  })
})
