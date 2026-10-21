import { describe, expect, it } from 'vitest'
import { encodePaperClipboard, decodePaperClipboard } from './clipboard'
import type { BoardElement } from '@/shared/types/board'
describe('versioned Paper clipboard', () => {
  it('roundtrips a payload without interpreting normal text', () => {
    const elements = [{ id: 'shape' }] as BoardElement[]
    const result = decodePaperClipboard(encodePaperClipboard(elements))!
    expect(result.elements).toEqual(elements)
    expect(result.copyId).toBeTruthy()
    expect(decodePaperClipboard('hello')).toBeNull()
  })
  it.each([
    'praxis-paper-elements:2\\n{}',
    'praxis-paper-elements:1\\ninvalid',
    'praxis-paper-elements:1\\n{}',
  ])('rejects invalid payload %s', (value) => {
    expect(() => decodePaperClipboard(value)).toThrow()
  })
  it('rejects empty selections', () => expect(() => encodePaperClipboard([])).toThrow())
})
