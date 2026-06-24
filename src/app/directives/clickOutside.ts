import type { Directive } from 'vue'

type ClickOutsideElement = HTMLElement & {
  __clickOutsideHandler__?: (event: MouseEvent | TouchEvent) => void
}

export const clickOutside: Directive<ClickOutsideElement, () => void> = {
  mounted(el, binding) {
    el.__clickOutsideHandler__ = (event) => {
      const target = event.target as Node

      if (!el.contains(target)) {
        binding.value()
      }
    }

    document.addEventListener('mousedown', el.__clickOutsideHandler__)
    document.addEventListener('touchstart', el.__clickOutsideHandler__)
  },

  unmounted(el) {
    if (!el.__clickOutsideHandler__) return

    document.removeEventListener('mousedown', el.__clickOutsideHandler__)
    document.removeEventListener('touchstart', el.__clickOutsideHandler__)

    delete el.__clickOutsideHandler__
  },
}
