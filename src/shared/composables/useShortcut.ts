import { onMounted, onUnmounted } from 'vue'

type ShortcutOptions = {
  preventDefault?: boolean
  enabled?: () => boolean
  ignoreInputs?: boolean
}

type ParsedShortcut = {
  key: string
  ctrl: boolean
  shift: boolean
  alt: boolean
  meta: boolean
}

function parseShortcut(shortcut: string): ParsedShortcut {
  const parts = shortcut.split('+').map((part) => part.trim().toLowerCase())

  return {
    key: parts[parts.length - 1],
    ctrl: parts.includes('ctrl') || parts.includes('control'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    meta: parts.includes('meta') || parts.includes('cmd') || parts.includes('command'),
  }
}

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false

  return (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  )
}

export function useShortcut(
  shortcut: string,
  callback: (event: KeyboardEvent) => void,
  options: ShortcutOptions = {}
) {
  const parsed = parseShortcut(shortcut)

  function onKeydown(event: KeyboardEvent) {
    if (event.repeat) return

    if (options.ignoreInputs !== false && isTypingTarget(event.target)) {
      return
    }

    if (options.enabled && !options.enabled()) return

    const eventKey = event.key.toLowerCase()

    if (eventKey !== parsed.key) return
    if (parsed.ctrl !== event.ctrlKey) return
    if (parsed.shift !== event.shiftKey) return
    if (parsed.alt !== event.altKey) return
    if (parsed.meta !== event.metaKey) return

    if (options.preventDefault) {
      event.preventDefault()
    }

    callback(event)
  }

  onMounted(() => {
    window.addEventListener('keydown', onKeydown)
  })

  onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
  })
}
