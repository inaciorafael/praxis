import { describe, expect, it, vi } from 'vitest'

import {
  checklistItemsFromText,
  createTaskFormDraft,
  syncTaskTags,
  tagNamesForTask,
} from '@/features/tasks/lib/task-form'

describe('task form helpers', () => {
  it('creates a stable empty draft with supplied context', () => {
    expect(createTaskFormDraft({ plannedFor: '2026-07-01' })).toEqual({
      title: '',
      notes: '',
      plannedFor: '2026-07-01',
      dueAt: '',
      reminderAt: '',
    })
  })

  it('normalizes checklist lines and removes empty items', () => {
    expect(checklistItemsFromText(' Primeiro \n\n Segundo\r\n ')).toEqual([
      'Primeiro',
      'Segundo',
    ])
  })

  it('returns only tag names assigned to the selected task', () => {
    const store = {
      tags: [
        { id: 'work', name: 'work' },
        { id: 'home', name: 'home' },
      ],
      taskTags: [
        { taskId: 'task-1', tagId: 'work' },
        { taskId: 'task-2', tagId: 'home' },
      ],
    }

    expect(tagNamesForTask(store as never, 'task-1')).toEqual(['work'])
  })

  it('adds and removes relations to match the form selection', async () => {
    const assignToTask = vi.fn(async () => undefined)
    const removeFromTask = vi.fn(async () => undefined)
    const store = {
      tags: [
        {
          id: 'work',
          name: 'work',
          slug: 'work',
          color: '#A85F1F',
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'home',
          name: 'home',
          slug: 'home',
          color: '#687A52',
          createdAt: '',
          updatedAt: '',
        },
      ],
      taskTags: [{ taskId: 'task-1', tagId: 'work' }],
      create: vi.fn(async () => true),
      assignToTask,
      removeFromTask,
    }

    await syncTaskTags(store, 'task-1', ['home'])

    expect(assignToTask).toHaveBeenCalledWith('task-1', 'home')
    expect(removeFromTask).toHaveBeenCalledWith('task-1', 'work')
  })
})
