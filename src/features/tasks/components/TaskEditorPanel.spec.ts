import { flushPromises, shallowMount } from '@vue/test-utils'
import { reactive } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import TaskEditorPanel from './TaskEditorPanel.vue'
import { listTaskBoardReferences } from '@/shared/lib/boards/board-context.service'

const mocks = vi.hoisted(() => ({
  update: vi.fn(),
  push: vi.fn(),
  clear: vi.fn(),
  syncTags: vi.fn(),
  flush: vi.fn(),
}))
let taskStore: ReturnType<typeof makeTaskStore>
const tagStore = { tags: [], taskTags: [] }
vi.mock('@/stores/task.store', () => ({ useTaskStore: () => taskStore }))
vi.mock('@/stores/tag.store', () => ({ useTagStore: () => tagStore }))
vi.mock('@/stores/board.store', () => ({ useBoardStore: () => ({ flush: mocks.flush }) }))
vi.mock('vue-router', () => ({ useRouter: () => ({ push: mocks.push }) }))
vi.mock('vue-i18n', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  useI18n: () => ({ t: (key: string) => key }),
}))
vi.mock('@/shared/lib/boards/board-context.service', () => ({
  listTaskBoardReferences: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/features/tasks/lib/task-form', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  syncTaskTags: mocks.syncTags,
}))

function makeTaskStore() {
  return reactive({
    selected: {
      id: 'task-a',
      title: 'Ideas',
      notes: 'Draft notes',
      plannedFor: null,
      dueAt: null,
      reminderAt: null,
      status: 'pending',
      completedAt: null,
    },
    getSelectedTask() {
      return this.selected
    },
    checklistItemsByTaskId: () => [],
    timelinesByTaskId: {},
    loadTimeline: vi.fn().mockResolvedValue(undefined),
    update: mocks.update,
    clearSelectedTask: mocks.clear,
  })
}

const mountPanel = () =>
  shallowMount(TaskEditorPanel, {
    global: {
      stubs: {
        TaskFormFields: {
          name: 'TaskFormFields',
          template: '<div />',
          props: ['modelValue', 'selectedTagNames'],
          methods: { commitPendingTag() {} },
        },
      },
    },
  })

describe('TaskEditorPanel Paper opening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    taskStore = makeTaskStore()
    mocks.update.mockResolvedValue(true)
    mocks.syncTags.mockResolvedValue(undefined)
    mocks.push.mockResolvedValue(undefined)
    mocks.flush.mockResolvedValue(true)
    vi.mocked(listTaskBoardReferences).mockResolvedValue([])
  })

  it.each([true, false])(
    'guards navigation to a task card with the same draft-saving flow (saved: %s)',
    async (saved) => {
      vi.mocked(listTaskBoardReferences).mockResolvedValue([
        { boardId: 'paper-a', boardTitle: 'Diagram', elementId: 'card-a' },
      ])
      mocks.update.mockResolvedValue(saved)
      const wrapper = mountPanel()
      await flushPromises()
      await wrapper
        .findAll('button')
        .find((button) => button.text() === 'Diagram')!
        .trigger('click')
      await flushPromises()
      expect(mocks.update).toHaveBeenCalledWith(
        'task-a',
        expect.objectContaining({ notes: 'Draft notes' })
      )
      if (saved) {
        expect(mocks.push).toHaveBeenCalledWith({
          name: 'papers',
          query: { boardId: 'paper-a', fromTaskId: 'task-a', elementId: 'card-a' },
        })
        expect(mocks.update.mock.invocationCallOrder[0]).toBeLessThan(
          mocks.push.mock.invocationCallOrder[0]!
        )
      } else {
        expect(mocks.push).not.toHaveBeenCalled()
        expect(mocks.clear).not.toHaveBeenCalled()
      }
      wrapper.unmount()
    }
  )

  it('saves notes before opening a Paper and clears selection after successful navigation', async () => {
    const wrapper = mountPanel()
    await flushPromises()
    wrapper.findComponent({ name: 'TaskPapers' }).vm.$emit('open', 'paper-a')
    await flushPromises()
    expect(mocks.update).toHaveBeenCalledWith(
      'task-a',
      expect.objectContaining({ title: 'Ideas', notes: 'Draft notes' })
    )
    expect(mocks.push).toHaveBeenCalledWith({
      name: 'papers',
      query: { boardId: 'paper-a', fromTaskId: 'task-a' },
    })
    expect(mocks.update.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.push.mock.invocationCallOrder[0]!
    )
    expect(mocks.clear).toHaveBeenCalledOnce()
  })

  it('keeps the editor and reports the failed save without navigating', async () => {
    mocks.update.mockResolvedValue(false)
    const wrapper = mountPanel()
    await flushPromises()
    wrapper.findComponent({ name: 'TaskPapers' }).vm.$emit('open', 'paper-a')
    await flushPromises()
    expect(mocks.push).not.toHaveBeenCalled()
    expect(mocks.clear).not.toHaveBeenCalled()
    expect(wrapper.get('[role="alert"]').text()).toBe('papers.openError')
  })

  it('commits and flushes the canvas before task save and stops when canvas persistence fails', async () => {
    mocks.flush.mockResolvedValue(false)
    const commit = vi.fn()
    window.addEventListener('praxis:commit-board-edit', commit)
    const wrapper = mountPanel()
    await flushPromises()
    wrapper.findComponent({ name: 'TaskPapers' }).vm.$emit('open', 'paper-a')
    await flushPromises()
    expect(commit).toHaveBeenCalledOnce()
    expect(mocks.update).not.toHaveBeenCalled()
    expect(mocks.push).not.toHaveBeenCalled()
    expect(mocks.clear).not.toHaveBeenCalled()
    window.removeEventListener('praxis:commit-board-edit', commit)
  })

  it('does not clear selection if navigation fails', async () => {
    mocks.push.mockResolvedValue({ type: 4 })
    const wrapper = mountPanel()
    await flushPromises()
    wrapper.findComponent({ name: 'TaskPapers' }).vm.$emit('open', 'paper-a')
    await flushPromises()
    expect(mocks.clear).not.toHaveBeenCalled()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })

  it('preserves requested tags when tag synchronization silently fails', async () => {
    const wrapper = mountPanel()
    await flushPromises()
    const fields = wrapper.findComponent({ name: 'TaskFormFields' })
    fields.vm.$emit('update:selectedTagNames', ['Important'])
    await flushPromises()
    wrapper.findComponent({ name: 'TaskPapers' }).vm.$emit('open', 'paper-a')
    await flushPromises()
    expect(mocks.syncTags).toHaveBeenCalledWith(tagStore, 'task-a', ['Important'])
    expect(mocks.push).not.toHaveBeenCalled()
    expect(fields.props('selectedTagNames')).toEqual(['Important'])
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
  })

  it('saves a stable snapshot and does not navigate when the selected task changes during saving', async () => {
    let complete!: (value: boolean) => void
    mocks.update.mockReturnValueOnce(
      new Promise((resolve) => {
        complete = resolve
      })
    )
    const wrapper = mountPanel()
    await flushPromises()
    wrapper.findComponent({ name: 'TaskPapers' }).vm.$emit('open', 'paper-a')
    await flushPromises()
    taskStore.selected = {
      ...taskStore.selected,
      id: 'task-b',
      title: 'Different task',
      notes: 'Other notes',
    }
    await flushPromises()
    complete(true)
    await flushPromises()
    expect(mocks.syncTags).toHaveBeenCalledWith(tagStore, 'task-a', [])
    expect(mocks.push).not.toHaveBeenCalled()
    expect(mocks.clear).not.toHaveBeenCalled()
  })
})
