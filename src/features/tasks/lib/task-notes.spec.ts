import { describe, expect, it } from 'vitest'
import {
  decoratePraxisInTaskNotesHtml,
  sanitizeTaskNotesHtml,
  taskNotesToPlainText,
} from './task-notes'

describe('taskNotesToPlainText', () => {
  it('keeps legacy plain-text notes readable', () => {
    expect(taskNotesToPlainText('Review the proposal')).toBe('Review the proposal')
  })

  it('creates a clean preview from formatted notes', () => {
    expect(
      taskNotesToPlainText(
        '<p>Review <strong>proposal</strong></p><ul><li>Prices</li><li>Deadline</li></ul>'
      )
    ).toBe('Review proposal Prices Deadline')
  })

  it('returns an empty preview without notes', () => {
    expect(taskNotesToPlainText(null)).toBe('')
  })
})

describe('sanitizeTaskNotesHtml', () => {
  it('keeps supported note formatting', () => {
    expect(
      sanitizeTaskNotesHtml(
        '<p>Review <strong>proposal</strong></p><ul><li>Prices</li></ul>'
      )
    ).toBe('<p>Review <strong>proposal</strong></p><ul><li>Prices</li></ul>')
  })

  it('removes executable markup and element attributes', () => {
    expect(
      sanitizeTaskNotesHtml('<p onclick="alert(1)">Safe</p><script>alert(1)</script>')
    ).toBe('<p>Safe</p>')
  })
})

describe('decoratePraxisInTaskNotesHtml', () => {
  it('decorates Praxis in the sanitized preview', () => {
    expect(decoratePraxisInTaskNotesHtml('<p>Use Praxis today</p>')).toBe(
      '<p>Use <span class="praxis-word-decoration">Praxis</span> today</p>'
    )
  })

  it('does not decorate parts of larger words', () => {
    expect(decoratePraxisInTaskNotesHtml('<p>praxises</p>')).toBe('<p>praxises</p>')
  })
})
