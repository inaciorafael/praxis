import { beforeEach, describe, expect, it, vi } from 'vitest'
const { invoke, save, isTauri } = vi.hoisted(() => ({
  invoke: vi.fn(),
  save: vi.fn(),
  isTauri: vi.fn(),
}))
vi.mock('@tauri-apps/api/core', () => ({ invoke, isTauri }))
vi.mock('@tauri-apps/plugin-dialog', () => ({ save }))
import { saveBoardPdf, saveBoardPng } from './board-export.service'

describe('native board export', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    isTauri.mockReturnValue(true)
    invoke.mockResolvedValue(undefined)
  })
  it('never writes when the save dialog is cancelled', async () => {
    save.mockResolvedValue(null)
    expect(await saveBoardPng(new Blob(['png'], { type: 'image/png' }), 'Checkout')).toBe(
      false
    )
    expect(invoke).not.toHaveBeenCalled()
  })
  it('writes the selected PNG path with a complete data URL', async () => {
    save.mockResolvedValue('C:\\Export\\Checkout')
    expect(await saveBoardPng(new Blob(['png'], { type: 'image/png' }), 'Checkout')).toBe(
      true
    )
    expect(invoke).toHaveBeenCalledWith('export_board_png', {
      path: 'C:\\Export\\Checkout.png',
      data: 'data:image/png;base64,cG5n',
    })
  })
  it('surfaces write failures instead of reporting export success', async () => {
    save.mockResolvedValue('C:\\Export\\Checkout.png')
    invoke.mockRejectedValue(new Error('Disk unavailable'))
    await expect(
      saveBoardPng(new Blob(['png'], { type: 'image/png' }), 'Checkout')
    ).rejects.toThrow('Disk unavailable')
  })
  it('does not write a PDF when the dialog is cancelled', async () => {
    save.mockResolvedValue(null)
    expect(
      await saveBoardPdf(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'Slides')
    ).toBe(false)
    expect(invoke).not.toHaveBeenCalled()
  })
  it('writes PDF bytes only to the chosen PDF destination', async () => {
    save.mockResolvedValue('C:\\Export\\Slides')
    expect(
      await saveBoardPdf(new Blob(['%PDF-1.4'], { type: 'application/pdf' }), 'Slides')
    ).toBe(true)
    expect(invoke).toHaveBeenCalledWith('export_board_pdf', {
      path: 'C:\\Export\\Slides.pdf',
      data: 'data:application/pdf;base64,JVBERi0xLjQ=',
    })
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ filters: [{ name: 'PDF', extensions: ['pdf'] }] })
    )
  })
})
