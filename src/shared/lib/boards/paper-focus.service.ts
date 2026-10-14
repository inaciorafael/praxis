import { isTauri } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

/** One focus session restores only fullscreen changes that it made itself. */
export function createPaperFocusSession() {
  let active = false
  let changedFullscreen = false
  let queue: Promise<void> = Promise.resolve()

  function enqueue(operation: () => Promise<void>): Promise<void> {
    const result = queue.then(operation)
    // A rejected operation remains visible to its caller without poisoning later retries.
    queue = result.catch(() => undefined)
    return result
  }

  function enter(): Promise<void> {
    return enqueue(async () => {
      if (active || !isTauri()) return
      const window = getCurrentWindow()
      const alreadyFullscreen = await window.isFullscreen()
      if (!alreadyFullscreen) await window.setFullscreen(true)
      changedFullscreen = !alreadyFullscreen
      active = true
    })
  }

  function leave(): Promise<void> {
    return enqueue(async () => {
      if (!active) return
      if (changedFullscreen) await getCurrentWindow().setFullscreen(false)
      // Keep ownership on a failed restore so another leave can retry.
      changedFullscreen = false
      active = false
    })
  }

  return { enter, leave }
}
