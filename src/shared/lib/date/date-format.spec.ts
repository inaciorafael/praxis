import { afterEach, describe, expect, it } from 'vitest'

import { formatCalendarDateTime, formatDate } from './date-format'
import { i18n } from '@/shared/lib/i18n/i18n'

describe('date-format', () => {
  afterEach(() => {
    i18n.global.locale.value = 'en'
  })

  it('uses the English date format by default', () => {
    expect(formatDate('2024-04-16T15:30:00Z')).toBe('4/16/2024')
    expect(formatCalendarDateTime('2024-04-16T15:30:00Z')).toContain('04/16/2024')
  })

  it('uses the Brazilian date format when Portuguese is selected', () => {
    i18n.global.locale.value = 'pt-BR'
    expect(formatDate('2024-04-16T15:30:00Z')).toBe('16/04/2024')
    const formatted = formatCalendarDateTime('2024-04-16T15:30:00Z')

    expect(formatted).toContain('16/04/2024')
    expect(formatted).not.toContain('04/16/2024')
  })

  it('returns an empty value for invalid dates', () => {
    expect(formatCalendarDateTime('invalid')).toBe('')
    expect(formatDate(null)).toBe('')
  })
})
