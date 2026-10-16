import { invoke, isTauri } from '@tauri-apps/api/core'
import { save } from '@tauri-apps/plugin-dialog'
import { i18n } from '@/shared/lib/i18n/i18n'

export async function saveBoardPng(blob: Blob, title: string): Promise<boolean> {
  return saveBoardFile(blob, title, 'png')
}

export async function saveBoardPdf(blob: Blob, title: string): Promise<boolean> {
  return saveBoardFile(blob, title, 'pdf')
}

async function saveBoardFile(
  blob: Blob,
  title: string,
  format: 'png' | 'pdf'
): Promise<boolean> {
  const name = `${title.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim() || 'Praxis'}.${format}`
  if (isTauri()) {
    const path = await save({
      title: i18n.global.t(
        format === 'png' ? 'boards.exportPng' : 'boards.presentation.exportPdf'
      ),
      defaultPath: name,
      filters: [{ name: format.toUpperCase(), extensions: [format] }],
    })
    if (!path) return false
    const data = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error ?? new Error(format.toUpperCase()))
      reader.readAsDataURL(blob)
    })
    await invoke(`export_board_${format}`, {
      path: path.toLowerCase().endsWith(`.${format}`) ? path : `${path}.${format}`,
      data,
    })
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
