import { describe, expect, it } from 'vitest'
import { applySmartSchedule, resolveSmartDueAt } from './smart-schedule'

const NOW = new Date(2026, 6, 1, 10, 30)

describe('resolveSmartDueAt', () => {
  it('resolves the quick scheduling presets in local time', () => {
    expect(resolveSmartDueAt('oneHour', NOW)).toBe('2026-07-01T11:30')
    expect(resolveSmartDueAt('laterToday', NOW)).toBe('2026-07-01T12:00')
    expect(resolveSmartDueAt('tomorrowMorning', NOW)).toBe('2026-07-02T09:00')
    expect(resolveSmartDueAt('nextWeek', NOW)).toBe('2026-07-06T09:00')
  })

  it('disables later today when no useful time remains', () => {
    expect(resolveSmartDueAt('laterToday', new Date(2026, 6, 1, 20, 30))).toBeNull()
  })
})

describe('applySmartSchedule', () => {
  it('sets a due date without inventing a reminder', () => {
    expect(
      applySmartSchedule({ dueAt: '', reminderAt: '' }, 'tomorrowMorning', NOW)
    ).toEqual({ dueAt: '2026-07-02T09:00', reminderAt: '' })
  })

  it('preserves the reminder lead time when postponing', () => {
    expect(
      applySmartSchedule(
        {
          dueAt: '2026-07-01T12:00',
          reminderAt: '2026-07-01T11:30',
        },
        'tomorrowMorning',
        NOW
      )
    ).toEqual({
      dueAt: '2026-07-02T09:00',
      reminderAt: '2026-07-02T08:30',
    })
  })
})
