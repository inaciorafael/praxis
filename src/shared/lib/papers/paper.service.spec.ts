import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { attachTaskPaper, createTaskPaper, detachTaskPaper } from './paper.service'

const { invoke } = vi.hoisted(() => ({ invoke: vi.fn() }))
vi.mock('@tauri-apps/api/core', () => ({ invoke }))

const mutations = [
  { name: 'create', call: () => createTaskPaper('task-a', 'Ideas', 'operation-a') },
  { name: 'attach', call: () => attachTaskPaper('task-a', 'paper-a') },
  { name: 'detach', call: () => detachTaskPaper('task-a', 'paper-a') },
]

describe('Paper link notifications', () => {
  const changed = vi.fn()
  beforeEach(() => {
    invoke.mockReset()
    changed.mockClear()
    window.addEventListener('praxis:paper-links-changed', changed)
  })
  afterEach(() => window.removeEventListener('praxis:paper-links-changed', changed))

  it.each(mutations)('notifies after $name persists, never while it is pending', async ({ call }) => {
    let finish!: (value: unknown) => void
    invoke.mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
    const mutation = call()
    expect(changed).not.toHaveBeenCalled()
    finish({ id: 'paper-a' })
    await mutation
    expect(changed).toHaveBeenCalledOnce()
  })

  it.each(mutations)('does not notify when $name fails', async ({ call }) => {
    const failure = new Error('Persistence failed')
    invoke.mockRejectedValueOnce(failure)
    await expect(call()).rejects.toBe(failure)
    expect(changed).not.toHaveBeenCalled()
  })

  it('preserves the created Paper result while notifying listeners', async () => {
    const paper = { id: 'paper-a', title: 'Ideas' }
    invoke.mockResolvedValueOnce(paper)
    expect(await createTaskPaper('task-a', 'Ideas', 'operation-a')).toBe(paper)
    expect(changed).toHaveBeenCalledOnce()
  })
})
