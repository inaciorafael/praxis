import { createPinia, setActivePinia } from 'pinia'
import { defineComponent } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '@/shared/lib/i18n/i18n'
import { useBoardStore } from '@/stores/board.store'
import { useTaskStore } from '@/stores/task.store'
import * as service from '@/shared/lib/boards/board.service'
import { getBoardTaskDetails } from '@/shared/lib/boards/board-context.service'
import { attachTaskPaper, listPaperTaskContexts } from '@/shared/lib/papers/paper.service'
import { searchTasks } from '@/shared/lib/tasks/task.service'
import type { Board } from '@/shared/types/board'
import type { Task } from '@/shared/types/task'
import BoardsPage from './BoardsPage.vue'

const focusMocks = vi.hoisted(() => ({
  enter: vi.fn(),
  leave: vi.fn(),
  isInteracting: vi.fn(),
  focusCanvas: vi.fn(),
}))
vi.mock('@/shared/lib/boards/paper-focus.service', () => ({
  createPaperFocusSession: () => ({ enter: focusMocks.enter, leave: focusMocks.leave }),
}))

vi.mock('@/shared/lib/boards/board.service', () => ({
  listBoards: vi.fn(),
  getBoard: vi.fn(),
  createBoard: vi.fn(),
  saveBoard: vi.fn(),
  deleteBoard: vi.fn(),
  getBoardTasks: vi.fn(),
  createBoardTask: vi.fn(),
  reloadBoardVault: vi.fn(),
}))
vi.mock('@/shared/lib/boards/board-context.service', () => ({
  getBoardTaskDetails: vi.fn(),
}))
vi.mock('@/shared/lib/papers/paper.service', () => ({
  attachTaskPaper: vi.fn(),
  listPaperTaskContexts: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/shared/lib/tasks/task.service', () => ({ searchTasks: vi.fn() }))
const initial: Board = {
  id: 'board',
  title: 'Refinement',
  formatVersion: 1,
  revision: 1,
  elements: [],
  createdAt: '2026-10-13',
  updatedAt: '2026-10-13',
}
const canvasStub = defineComponent({
  props: ['elements', 'taskTitles', 'distractionFree', 'readOnly'],
  emits: ['select', 'change', 'interact'],
  setup(_, { expose }) {
    expose({
      cancelGesture: vi.fn(),
      focusElement: vi.fn(),
      isInteracting: focusMocks.isInteracting,
      focusCanvas: focusMocks.focusCanvas,
    })
  },
  template:
    '<div data-testid="canvas"><button @click="$emit(\'select\', \'linked\')">Select linked card</button></div>',
})
beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  i18n.global.locale.value = 'en'
  focusMocks.enter.mockResolvedValue(undefined)
  focusMocks.leave.mockResolvedValue(undefined)
  focusMocks.isInteracting.mockReturnValue(false)
  vi.mocked(service.listBoards).mockResolvedValue([{ ...initial, elementCount: 0 }])
  vi.mocked(service.getBoard).mockResolvedValue(structuredClone(initial))
  vi.mocked(service.getBoardTasks).mockResolvedValue([])
  vi.mocked(listPaperTaskContexts).mockResolvedValue([])
  vi.mocked(service.createBoard).mockImplementation(async (input) => ({
    ...initial,
    ...input,
  }))
})
async function mountPage(url = '/app/boards') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/app/boards', component: BoardsPage },
      { path: '/app/today', name: 'today', component: { template: '<div>Today</div>' } },
    ],
  })
  await router.push(url)
  await router.isReady()
  const wrapper = mount(BoardsPage, {
    global: { plugins: [router, i18n], stubs: { BoardCanvas: canvasStub } },
  })
  await flushPromises()
  return wrapper
}
describe('BoardsPage integration', () => {
  it('dismisses open Paper menus when returning to the canvas', async () => {
    const wrapper = await mountPage('/app/boards?boardId=board')
    const contexts = wrapper.get('.paper-contexts')
    contexts.element.setAttribute('open', '')
    wrapper.findComponent(canvasStub).vm.$emit('interact')
    await flushPromises()
    expect(contexts.attributes('open')).toBeUndefined()
    contexts.element.setAttribute('open', '')
    await wrapper.get('input.paper-title').trigger('pointerdown')
    expect(contexts.attributes('open')).toBeUndefined()
    wrapper.unmount()
    useBoardStore().reset()
  })
  it('organizes Papers by title, dates and lock state without fetching their content', async () => {
    vi.mocked(service.listBoards).mockResolvedValue([
      {
        ...initial,
        id: 'z',
        title: 'Zebra',
        elementCount: 2,
        updatedAt: '2026-10-15',
        createdAt: '2026-10-10',
      },
      {
        ...initial,
        id: 'a',
        title: 'Árvore',
        locked: true,
        elementCount: 1,
        updatedAt: '2026-10-14',
        createdAt: '2026-10-15',
      },
      {
        ...initial,
        id: 'b',
        title: 'Beta',
        elementCount: 0,
        updatedAt: '2026-10-13',
        createdAt: '2026-10-11',
      },
    ])
    const wrapper = await mountPage()
    const titles = () => wrapper.findAll('.paper-card-title').map((item) => item.text())
    expect(titles()[0]).toBe('Zebra')
    await wrapper.get('[data-library-sort]').setValue('name')
    expect(titles()[0]).toContain('Árvore')
    await wrapper.get('[data-library-sort]').setValue('created')
    expect(titles()[0]).toContain('Árvore')
    await wrapper.get('[data-library-filter]').setValue('locked')
    expect(titles()).toHaveLength(1)
    expect(wrapper.get('[data-library-count]').text()).toBe('1 of 3 Papers')
    await wrapper.get('#board-search').setValue('  arvore ')
    expect(titles()).toHaveLength(1)
    await wrapper.get('[data-library-filter]').setValue('editable')
    expect(wrapper.findAll('.paper-card')).toHaveLength(0)
    expect(wrapper.get('.gallery-empty').text()).toBe('No Papers match your search.')
    await wrapper.get('#board-search').setValue('')
    expect(titles()).toHaveLength(2)
    await wrapper.get('[data-library-list]').trigger('click')
    expect(wrapper.get('.gallery-grid').classes()).toContain('gallery-list')
    expect(service.getBoard).not.toHaveBeenCalled()
    wrapper.unmount()
    useBoardStore().reset()
  })
  it('commits the current canvas draft before locking and prevents repeated requests while saving', async () => {
    const wrapper = await mountPage('/app/boards?boardId=board')
    const store = useBoardStore()
    const commit = vi.fn()
    window.addEventListener('praxis:commit-board-edit', commit)
    let complete!: () => void
    const setLocked = vi.spyOn(store, 'setLocked').mockImplementation(async (value) => {
      await new Promise<void>((resolve) => {
        complete = resolve
      })
      store.current = { ...store.current!, locked: value }
      return true
    })
    wrapper.findComponent(canvasStub).vm.$emit('lockPaper')
    await flushPromises()
    expect(commit).toHaveBeenCalledOnce()
    expect(setLocked).toHaveBeenCalledWith(true)
    expect(commit.mock.invocationCallOrder[0]).toBeLessThan(
      setLocked.mock.invocationCallOrder[0]!
    )
    expect(wrapper.get('[data-board-lock]').attributes('disabled')).toBeDefined()
    complete()
    await flushPromises()
    expect(wrapper.findComponent(canvasStub).props('readOnly')).toBe(true)
    expect(wrapper.get('[data-board-lock]').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('input.paper-title').attributes('readonly')).toBeDefined()
    expect(wrapper.findComponent({ name: 'PaperBackgroundControls' }).exists()).toBe(
      false
    )
    expect(wrapper.get('#paper-context-search').attributes('disabled')).toBeDefined()
    await wrapper.get('input.paper-title').setValue('Cannot change locked title')
    expect(store.current?.title).toBe(initial.title)
    window.removeEventListener('praxis:commit-board-edit', commit)
    wrapper.unmount()
    store.reset()
  })
  it('keeps unlocking reachable in distraction-free mode after reopening a locked Paper', async () => {
    vi.mocked(service.getBoard).mockResolvedValue({ ...initial, locked: true })
    const wrapper = await mountPage('/app/boards?boardId=board&focus=1')
    const store = useBoardStore()
    const setLocked = vi.spyOn(store, 'setLocked').mockImplementation(async (value) => {
      store.current = { ...store.current!, locked: value }
      return true
    })
    expect(wrapper.findComponent(canvasStub).props('readOnly')).toBe(true)
    expect(wrapper.get('[data-board-lock]').attributes('aria-label')).toBe('Unlock Paper')
    await wrapper.get('[data-board-lock]').trigger('click')
    await flushPromises()
    expect(setLocked).toHaveBeenCalledWith(false)
    expect(wrapper.findComponent(canvasStub).props('readOnly')).toBe(false)
    wrapper.unmount()
    store.reset()
  })
  it('returns only to a related source task and restores its official execution details', async () => {
    const task = { id: 'source', title: 'Source reminder', status: 'pending' } as Task
    vi.mocked(listPaperTaskContexts).mockResolvedValue([task])
    vi.mocked(getBoardTaskDetails).mockResolvedValue({
      tasks: [task],
      checklistItems: [
        {
          id: 'step',
          taskId: 'source',
          title: 'Actual step',
          status: 'pending',
          sortOrder: 0,
          completedAt: null,
          createdAt: '',
          updatedAt: '',
        },
      ],
      total: 1,
    })
    const wrapper = await mountPage('/app/boards?boardId=board&fromTaskId=source')
    await wrapper.get('[data-back-to-task]').trigger('click')
    await flushPromises()
    expect(getBoardTaskDetails).toHaveBeenCalledWith('board', 'source')
    expect(useTaskStore().selectedTaskId).toBe('source')
    expect(useTaskStore().checklistItems[0]?.title).toBe('Actual step')
    wrapper.unmount()
    useBoardStore().reset()
  })
  it('does not offer a return to an unrelated source supplied through the URL', async () => {
    vi.mocked(listPaperTaskContexts).mockResolvedValue([
      { id: 'related', title: 'Related', status: 'pending' } as Task,
    ])
    const wrapper = await mountPage('/app/boards?boardId=board&fromTaskId=missing')
    expect(wrapper.find('[data-back-to-task]').exists()).toBe(false)
    expect(getBoardTaskDetails).not.toHaveBeenCalled()
    wrapper.unmount()
    useBoardStore().reset()
  })
  it.each([false, true])(
    'attaches a whole Paper only after its draft is saved (flush: %s)',
    async (saved) => {
      const task = { id: 'target', title: 'Target task', status: 'pending' } as Task
      vi.mocked(searchTasks).mockResolvedValue({
        tasks: [task],
        checklistItems: [],
        total: 1,
      })
      const wrapper = await mountPage('/app/boards?boardId=board')
      const flush = vi.spyOn(useBoardStore(), 'flush').mockResolvedValue(saved)
      await wrapper.get('#paper-context-search').setValue('Target')
      await wrapper
        .get('#paper-context-search')
        .element.closest('form')!
        .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
      await flushPromises()
      expect(searchTasks).toHaveBeenCalledWith(
        { query: 'Target', archiveFilter: 'all' },
        { limit: 25, offset: 0 }
      )
      vi.mocked(listPaperTaskContexts).mockResolvedValue([task])
      const attach = wrapper
        .findAll('.paper-contexts button')
        .find((button) => button.text().includes('Target task'))!
      await attach.trigger('click')
      await flushPromises()
      if (saved) {
        expect(attachTaskPaper).toHaveBeenCalledWith('target', 'board')
        expect(wrapper.get('.paper-contexts').text()).toContain('Target task')
        expect(flush.mock.invocationCallOrder[0]).toBeLessThan(
          vi.mocked(attachTaskPaper).mock.invocationCallOrder[0]!
        )
      } else expect(attachTaskPaper).not.toHaveBeenCalled()
      wrapper.unmount()
      useBoardStore().reset()
    }
  )
  it('provides navigation back to Praxis from the canvas header', async () => {
    const wrapper = await mountPage('/app/boards?boardId=board')
    await wrapper
      .get(`button[aria-label="${i18n.global.t('boards.studio.backToPraxis')}"]`)
      .trigger('click')
    await flushPromises()
    expect(wrapper.vm.$route.name).toBe('today')
    wrapper.unmount()
    useBoardStore().reset()
  })
  it('opens and closes the gallery without replacing an active canvas or draft', async () => {
    const wrapper = await mountPage('/app/boards?boardId=board')
    const canvas = wrapper.get('[data-testid="canvas"]').element
    useBoardStore().setTitle('Draft title')
    await wrapper
      .get(`button[aria-label="${i18n.global.t('papers.boardList')}"]`)
      .trigger('click')
    expect(wrapper.get('#board-list').classes()).toContain('paper-gallery')
    expect(wrapper.get('[data-testid="canvas"]').element).toBe(canvas)
    await wrapper.get('.gallery-close').trigger('click')
    expect(wrapper.find('#board-list').exists()).toBe(false)
    expect(useBoardStore().current?.title).toBe('Draft title')
    expect(wrapper.get('[data-testid="canvas"]').element).toBe(canvas)
    wrapper.unmount()
    useBoardStore().reset()
  })
  it('fills the viewport and hides surrounding panels without replacing the canvas', async () => {
    const wrapper = await mountPage('/app/boards?boardId=board')
    const originalCanvas = wrapper.get('[data-testid="canvas"]').element
    await wrapper
      .get(`button[aria-label="${i18n.global.t('boards.focusCanvas')}"]`)
      .trigger('click')
    await flushPromises()
    expect(wrapper.attributes('data-focus')).toBe('true')
    expect(wrapper.classes()).toContain('paper-focus')
    expect(wrapper.find('input[aria-label="Paper name"]').exists()).toBe(false)
    expect(wrapper.find('#board-list').exists()).toBe(false)
    expect(wrapper.findComponent(canvasStub).props('distractionFree')).toBe(true)
    expect(focusMocks.enter).toHaveBeenCalledOnce()
    expect(wrapper.get('[data-testid="canvas"]').element).toBe(originalCanvas)
    await wrapper.get('.paper-focus-actions button').trigger('click')
    expect(wrapper.findComponent(canvasStub).props('distractionFree')).toBe(false)
    focusMocks.isInteracting.mockReturnValue(true)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(wrapper.attributes('data-focus')).toBe('true')
    focusMocks.isInteracting.mockReturnValue(false)
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await flushPromises()
    expect(wrapper.attributes('data-focus')).toBe('false')
    expect(wrapper.get('[data-testid="canvas"]').element).toBe(originalCanvas)
    wrapper.unmount()
    useBoardStore().reset()
  })
  it('lists legacy boards and new Papers in one library', async () => {
    const store = useBoardStore()
    store.current = structuredClone(initial)
    vi.mocked(service.listBoards).mockResolvedValue([
      { ...initial, elementCount: 0 },
      { ...initial, id: 'paper', title: 'Visual idea', kind: 'paper', elementCount: 0 },
    ])
    const wrapper = await mountPage('/app/boards')
    expect(wrapper.find('[data-testid="canvas"]').exists()).toBe(true)
    await wrapper
      .find(`button[aria-label="${i18n.global.t('papers.boardList')}"]`)
      .trigger('click')
    expect(wrapper.find('#board-list').text()).toContain('Visual idea')
    expect(wrapper.find('#board-list').text()).toContain('Refinement')
    expect(store.current?.id).toBe('board')
    wrapper.unmount()
    store.reset()
  })
  it('opens legacy board IDs and their linked task contexts', async () => {
    vi.mocked(listPaperTaskContexts).mockResolvedValue([
      { id: 'task', title: 'Legacy context', status: 'pending' } as Task,
    ])
    const wrapper = await mountPage('/app/boards?boardId=board')
    expect(service.getBoard).toHaveBeenCalledWith('board')
    expect(wrapper.find('[data-testid="canvas"]').exists()).toBe(true)
    expect(listPaperTaskContexts).toHaveBeenCalledWith('board')
    expect(wrapper.text()).toContain('Legacy context')
    wrapper.unmount()
    useBoardStore().reset()
  })
  it('creates Papers with an explicit kind after committing pending canvas text', async () => {
    const commit = vi.fn()
    window.addEventListener('praxis:commit-board-edit', commit)
    const wrapper = await mountPage('/app/boards')
    await wrapper
      .find(`button[aria-label="${i18n.global.t('papers.new')}"]`)
      .trigger('click')
    await flushPromises()
    expect(service.createBoard).toHaveBeenCalledWith({
      title: i18n.global.t('papers.untitled'),
      elements: [],
      kind: 'paper',
    })
    expect(commit).toHaveBeenCalledOnce()
    window.removeEventListener('praxis:commit-board-edit', commit)
    wrapper.unmount()
    useBoardStore().reset()
  })
  it('creates a blank flexible canvas without imposing workflow cards', async () => {
    const wrapper = await mountPage()
    const button = wrapper.find(`button[aria-label="${i18n.global.t('papers.new')}"]`)
    await button.trigger('click')
    await flushPromises()
    expect(service.createBoard).toHaveBeenCalledWith({
      title: i18n.global.t('papers.untitled'),
      elements: [],
      kind: 'paper',
    })
    expect(useBoardStore().current?.elements).toHaveLength(0)
    expect(wrapper.text()).not.toContain('Frontend refinement')
    expect(wrapper.find('#board-list').exists()).toBe(false)
    expect(wrapper.find('[data-testid="canvas"]').exists()).toBe(true)
    wrapper.unmount()
    useBoardStore().reset()
  })
  it('opens the official task from a linked card without duplicating the editor', async () => {
    vi.mocked(service.getBoard).mockResolvedValue({
      ...initial,
      elements: [
        {
          id: 'linked',
          kind: 'question',
          x: 0,
          y: 0,
          width: 200,
          height: 120,
          text: 'Question',
          color: 'neutral',
          resolved: false,
          points: [],
          startId: null,
          endId: null,
          taskId: 'task',
          imageData: null,
        },
      ],
    })
    const task = { id: 'task', title: 'Official task', status: 'pending' } as Task
    vi.mocked(service.getBoardTasks).mockResolvedValue([task])
    vi.mocked(getBoardTaskDetails).mockResolvedValue({
      tasks: [task],
      checklistItems: [
        {
          id: 'step',
          taskId: 'task',
          title: 'Existing execution step',
          status: 'pending',
          sortOrder: 0,
          completedAt: null,
          createdAt: '',
          updatedAt: '',
        },
      ],
      total: 1,
    })
    const wrapper = await mountPage('/app/boards?boardId=board')
    await wrapper.find('[data-testid="canvas"] button').trigger('click')
    const open = wrapper.findAll('button').find((item) => item.text() === 'Open task')!
    await open.trigger('click')
    await flushPromises()
    expect(useTaskStore().selectedTaskId).toBe('task')
    expect(useTaskStore().tasks.find((item) => item.id === 'task')?.title).toBe(
      'Official task'
    )
    expect(useTaskStore().checklistItems.find((item) => item.id === 'step')?.title).toBe(
      'Existing execution step'
    )
    expect(wrapper.findComponent({ name: 'TaskEditorPanel' }).exists()).toBe(false)
    wrapper.unmount()
    useBoardStore().reset()
  })
})
