import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Board, BoardSummary } from '@/shared/types/board'
import TaskPapers from './TaskPapers.vue'

const services = vi.hoisted(() => ({
  listTaskPapers: vi.fn(),
  createTaskPaper: vi.fn(),
  attachTaskPaper: vi.fn(),
  detachTaskPaper: vi.fn(),
  listBoards: vi.fn(),
}))
vi.mock('@/shared/lib/papers/paper.service', () => services)
vi.mock('@/shared/lib/boards/board.service', () => ({ listBoards: services.listBoards }))
vi.mock('vue-i18n', () => ({
  useI18n: () => ({
    t: (key: string, values?: { title?: string } | number) =>
      key === 'papers.taskDefaultTitle'
        ? `Ideas for ${typeof values === 'object' ? values.title : ''}`
        : key === 'papers.elementCount'
          ? `${values} elements`
          : key,
  }),
}))

const summary = (id: string, kind: 'board' | 'paper' = 'paper'): BoardSummary => ({
  id,
  kind,
  title: id,
  revision: 1,
  formatVersion: 1,
  createdAt: '2026-10-13',
  updatedAt: '2026-10-13',
  elementCount: 0,
})
const paper: Board = { ...summary('new-paper'), elements: [] }
const mountSection = () =>
  mount(TaskPapers, { props: { taskId: 'task-a', taskTitle: 'Ideas' } })

describe('TaskPapers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    services.listTaskPapers.mockResolvedValue([summary('attached')])
    services.createTaskPaper.mockResolvedValue(paper)
    services.detachTaskPaper.mockResolvedValue(undefined)
    services.attachTaskPaper.mockResolvedValue(undefined)
    services.listBoards.mockResolvedValue([
      summary('attached'),
      summary('available'),
      summary('board', 'board'),
    ])
  })

  it('emits opening without navigating or changing the task', async () => {
    const wrapper = mountSection()
    await flushPromises()
    await wrapper.get('[data-action="open"]').trigger('click')
    expect(wrapper.emitted('open')).toEqual([['attached']])
    expect(services.createTaskPaper).not.toHaveBeenCalled()
  })

  it('loads all canvases lazily, including legacy boards, and excludes existing attachments', async () => {
    const wrapper = mountSection()
    await flushPromises()
    expect(services.listBoards).not.toHaveBeenCalled()
    await wrapper.get('[data-action="picker"]').trigger('click')
    await flushPromises()
    expect(wrapper.findAll('option').map((option) => option.attributes('value'))).toEqual(
      ['', 'available', 'board']
    )
    await wrapper.get('select').setValue('board')
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(services.attachTaskPaper).toHaveBeenCalledWith('task-a', 'board')
    expect(wrapper.findAll('[data-action="open"]')).toHaveLength(2)
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('retains the creation operation ID when retrying an uncertain response', async () => {
    services.createTaskPaper.mockRejectedValueOnce(new Error('Connection interrupted'))
    const wrapper = mountSection()
    await flushPromises()
    await wrapper.get('[data-action="new"]').trigger('click')
    expect((wrapper.get('input').element as HTMLInputElement).value).toBe(
      'Ideas for Ideas'
    )
    await wrapper.get('form').trigger('submit')
    await flushPromises()
    expect(wrapper.find('[role="alert"]').exists()).toBe(true)
    expect(wrapper.emitted('open')).toBeUndefined()
    await wrapper.get('[data-action="retry"]').trigger('click')
    await flushPromises()
    const [first, second] = services.createTaskPaper.mock.calls
    expect(second).toEqual(first)
    expect(first).toEqual(['task-a', 'Ideas for Ideas', expect.any(String)])
    expect(wrapper.findAll('[data-action="open"]')).toHaveLength(2)
    expect(wrapper.emitted('open')).toEqual([['new-paper']])
  })

  it('keeps an attachment when detach fails, then removes only its reference on retry', async () => {
    services.detachTaskPaper.mockRejectedValueOnce(new Error('Failed'))
    const wrapper = mountSection()
    await flushPromises()
    await wrapper.get('[data-action="detach"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-action="open"]').exists()).toBe(true)
    await wrapper.get('[data-action="retry"]').trigger('click')
    await flushPromises()
    expect(services.detachTaskPaper).toHaveBeenLastCalledWith('task-a', 'attached')
    expect(wrapper.find('[data-action="open"]').exists()).toBe(false)
    expect(services.listBoards).not.toHaveBeenCalled()
  })

  it('ignores late failed loads after switching tasks', async () => {
    let rejectOld!: (reason: Error) => void
    services.listTaskPapers.mockReturnValueOnce(
      new Promise((_, reject) => {
        rejectOld = reject
      })
    )
    services.listTaskPapers.mockResolvedValueOnce([summary('task-b-paper')])
    const wrapper = mountSection()
    await wrapper.setProps({ taskId: 'task-b' })
    await flushPromises()
    rejectOld(new Error('Old request'))
    await flushPromises()
    expect(wrapper.text()).toContain('task-b-paper')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
  })

  it('ignores successful mutations belonging to the previous task', async () => {
    let resolveOld!: (value: Board) => void
    services.createTaskPaper.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve
      })
    )
    const wrapper = mountSection()
    await flushPromises()
    await wrapper.get('[data-action="new"]').trigger('click')
    await wrapper.get('form').trigger('submit')
    services.listTaskPapers.mockResolvedValueOnce([summary('task-b-paper')])
    await wrapper.setProps({ taskId: 'task-b' })
    await flushPromises()
    resolveOld(paper)
    await flushPromises()
    expect(wrapper.text()).toContain('task-b-paper')
    expect(wrapper.text()).not.toContain('new-paper')
    expect(wrapper.emitted('open')).toBeUndefined()
  })

  it('presents the visual role and the linked document content count', async () => {
    services.listTaskPapers.mockResolvedValue([{ ...summary('Flow'), elementCount: 7 }])
    const wrapper = mountSection()
    await flushPromises()
    expect(wrapper.text()).toContain('papers.taskDescription')
    expect(wrapper.get('[data-action="open"]').text()).toContain('Flow')
    expect(wrapper.get('[data-action="open"]').text()).toContain('7 elements')
  })
})
