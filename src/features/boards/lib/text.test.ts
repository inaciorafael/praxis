import { describe, expect, it } from 'vitest'
import { wrapBoardText } from './text'

describe('board text wrapping', () => {
  it('keeps words and punctuation together across automatic lines', () => {
    expect(wrapBoardText('Quais restrições? Próximos passos.', 18)).toEqual(['Quais restrições?', 'Próximos passos.'])
    expect(wrapBoardText('Uma ideia com restrições', 14)).toEqual(['Uma ideia com', 'restrições'])
  })
  it('preserves explicit newlines including empty paragraphs', () => {
    expect(wrapBoardText('A primeira\n\nOutra linha\n', 20)).toEqual(['A primeira', '', 'Outra linha', ''])
  })
  it('splits only words longer than the available width and limits displayed lines', () => {
    expect(wrapBoardText('abcde abc', 3)).toEqual(['abc', 'de', 'abc'])
    expect(wrapBoardText('um dois três', 4, 2)).toEqual(['um', 'dois'])
    expect(wrapBoardText('abc', 0)).toEqual(['a', 'b', 'c'])
  })
})
