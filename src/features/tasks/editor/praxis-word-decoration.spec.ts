import { describe, expect, it } from 'vitest'
import { findPraxisWordRanges } from './praxis-word-decoration'

describe('findPraxisWordRanges', () => {
  it('finds the word regardless of letter case', () => {
    expect(findPraxisWordRanges('Praxis and praxis')).toEqual([
      { from: 0, to: 6 },
      { from: 11, to: 17 },
    ])
  })

  it('does not decorate parts of a larger word', () => {
    expect(findPraxisWordRanges('praxises praxis', 4)).toEqual([{ from: 13, to: 19 }])
  })
})
