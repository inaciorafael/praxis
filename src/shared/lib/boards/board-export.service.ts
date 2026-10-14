import { invoke, isTauri } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { i18n } from '@/shared/lib/i18n/i18n'

export async function saveBoardPng(blob: Blob, title: string): Promise<boolean> {
  const name = `${title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'Praxis'}.png`
  if (isTauri()) {
    const path = await save({
      title: i18n.global.t('boards.exportPng'),
      defaultPath: name,
      filters: [{ name: 'PNG', extensions: ['png'] }],
    })
    if (!path) return false
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error ?? new Error('PNG'))
      reader.readAsDataURL(blob)
    })
    await invoke('export_board_png', { path: /\.png$/i.test(path) ? path : `${path}.png`, data })
    return true
  }
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}
