<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, type Component } from 'vue'
import {
  Shapes,
  Plus,
  Library,
  ChevronDown,
  LassoSelect,
  MousePointer2,
} from '@lucide/vue'
import { useI18n } from 'vue-i18n'
const props = defineProps<{
  tools: { id: string; icon: Component; shortcut?: string }[]
  activeTool: string
  selectionMode?: 'rectangle' | 'lasso'
}>()
const emit = defineEmits<{
  choose: [id: string]
  undo: []
  redo: []
  menuOpen: []
  library: []
}>()
const { t } = useI18n()
const root = ref<HTMLElement>()
const menuTop = ref(0)
let menuTrigger: HTMLButtonElement | undefined
const menu = ref<'shapes' | 'insert' | 'selection' | null>(null)
watch(menu, (value) => {
  if (value) emit('menuOpen')
})
const primary = computed(() =>
  ['select', 'pan', 'pen', 'draw', 'eraser', 'arrow', 'text', 'note'].flatMap((id) => {
    const tool = props.tools.find((tool) => tool.id === id)
    return tool ? [tool] : []
  })
)
const shapeIds = ['rectangle', 'ellipse', 'line', 'triangle', 'hexagon']
const entries = computed(() =>
  props.tools.filter((tool) => [...shapeIds, 'image', 'frame'].includes(tool.id))
)
const isShape = computed(() => shapeIds.includes(props.activeTool))
const lassoActive = computed(
  () => props.activeTool === 'select' && props.selectionMode === 'lasso'
)
function primaryLabel(tool: { id: string; shortcut?: string }) {
  return tool.id === 'select' && lassoActive.value
    ? `${t('boards.tools.lasso')} (Q)`
    : `${t(`boards.tools.${tool.id}`)}${tool.shortcut ? ` (${tool.shortcut})` : ''}`
}
function toggleMenu(next: 'shapes' | 'insert' | 'selection', event: MouseEvent) {
  if (menu.value === next) {
    menu.value = null
    return
  }
  menuTrigger = event.currentTarget as HTMLButtonElement
  menuTop.value = Math.max(
    0,
    Math.min(menuTrigger.offsetTop, (root.value?.clientHeight ?? 480) - 260)
  )
  menu.value = next
}
function openLibrary() {
  menu.value = null
  emit('library')
}
function choose(id: string) {
  menu.value = null
  emit('choose', id)
}
function outside(event: PointerEvent) {
  if (event.target instanceof Node && !root.value?.contains(event.target))
    menu.value = null
}
function keydown(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    menu.value = null
    menuTrigger?.focus()
    event.preventDefault()
    return
  }
  if ((event.ctrlKey || event.metaKey) && ['z', 'y'].includes(event.key.toLowerCase())) {
    event.preventDefault()
    if (event.key.toLowerCase() === 'y' || event.shiftKey) emit('redo')
    else emit('undo')
    return
  }
  if (event.ctrlKey || event.metaKey || event.altKey) return
  if (event.key.toLowerCase() === 'q') {
    event.preventDefault()
    choose('lasso')
    return
  }
  const tool = props.tools.find(
    (tool) => tool.shortcut && tool.shortcut.toLowerCase() === event.key.toLowerCase()
  )
  if (tool) {
    event.preventDefault()
    choose(tool.id)
  }
}
watch(
  () => [props.activeTool, props.selectionMode],
  () => {
    menu.value = null
  }
)
onMounted(() => document.addEventListener('pointerdown', outside, true))
onUnmounted(() => document.removeEventListener('pointerdown', outside, true))
</script>
<template>
  <nav
    ref="root"
    class="paper-tool-rail"
    :aria-label="t('boards.atelier.tools')"
    @pointerdown.stop
    @wheel.stop
    @keydown.stop="keydown"
  >
    <div
      class="paper-rail-list"
      role="toolbar"
      :aria-label="t('boards.atelier.tools')"
      aria-orientation="vertical"
    >
      <button
        v-for="tool in primary"
        :key="tool.id"
        :data-tool="tool.id"
        :aria-pressed="activeTool === tool.id"
        :aria-label="primaryLabel(tool)"
        :title="primaryLabel(tool)"
        @click="choose(tool.id === 'select' && lassoActive ? 'lasso' : tool.id)"
      >
        <component
          :is="tool.id === 'select' && lassoActive ? LassoSelect : tool.icon"
          :size="18"
          aria-hidden="true"
        /><span>{{
          t(
            tool.id === 'select' && lassoActive
              ? 'boards.tools.lasso'
              : `boards.tools.${tool.id}`
          )
        }}</span
        ><kbd v-if="tool.shortcut">{{
          tool.id === 'select' && lassoActive ? 'Q' : tool.shortcut
        }}</kbd>
      </button>
      <button
        data-selection-options
        class="paper-selection-options"
        :aria-label="t('boards.atelier.selection')"
        :aria-expanded="menu === 'selection'"
        @click="toggleMenu('selection', $event)"
      >
        <ChevronDown :size="13" />
      </button>
      <button
        data-more-tools
        :aria-expanded="menu === 'shapes'"
        :aria-pressed="isShape"
        :aria-label="t('boards.studio.shapesLabel')"
        @click="toggleMenu('shapes', $event)"
      >
        <Shapes :size="18" /><span>{{ t('boards.studio.shapesLabel') }}</span>
      </button>
      <button
        :aria-expanded="menu === 'insert'"
        :aria-label="t('boards.atelier.insert')"
        @click="toggleMenu('insert', $event)"
      >
        <Plus :size="18" /><span>{{ t('boards.atelier.insert') }}</span>
      </button>
      <button
        data-personal-library
        @click="openLibrary"
      >
        <Library :size="18" /><span>{{ t('boards.library.short') }}</span>
      </button>
    </div>
    <div
      v-show="menu && menu !== 'selection'"
      class="paper-rail-menu"
      :style="{ top: menuTop + 'px', maxHeight: 'calc(100% - ' + menuTop + 'px)' }"
      role="toolbar"
      :aria-label="
        t(menu === 'shapes' ? 'boards.studio.shapesLabel' : 'boards.atelier.insert')
      "
    >
      <button
        v-for="tool in entries"
        :key="tool.id"
        v-show="
          menu === 'shapes'
            ? shapeIds.includes(tool.id)
            : ['image', 'frame'].includes(tool.id)
        "
        :data-tool="tool.id"
        :aria-pressed="activeTool === tool.id"
        @click="choose(tool.id)"
      >
        <component
          :is="tool.icon"
          :size="18"
        /><span>{{ t(`boards.tools.${tool.id}`) }}</span
        ><kbd v-if="tool.shortcut">{{ tool.shortcut }}</kbd>
      </button>
    </div>
    <div
      v-if="menu === 'selection'"
      class="paper-rail-menu"
      :style="{ top: menuTop + 'px', maxHeight: 'calc(100% - ' + menuTop + 'px)' }"
      role="toolbar"
      :aria-label="t('boards.atelier.selection')"
    >
      <button
        data-selection-mode="rectangle"
        :aria-pressed="activeTool === 'select' && !lassoActive"
        @click="choose('select')"
      >
        <MousePointer2 :size="18" /><span>{{ t('boards.tools.select') }}</span
        ><kbd>V</kbd>
      </button>
      <button
        data-selection-mode="lasso"
        data-tool="lasso"
        :aria-pressed="lassoActive"
        @click="choose('lasso')"
      >
        <LassoSelect :size="18" /><span>{{ t('boards.tools.lasso') }}</span
        ><kbd>Q</kbd>
      </button>
    </div>
  </nav>
</template>
<style scoped>
.paper-tool-rail {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 88px;
  width: var(--pe-rail-width);
  z-index: 6;
  color: var(--pe-ink);
}
.paper-rail-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px;
  background: var(--pe-surface);
  border-right: 1px solid var(--pe-border);
}
.paper-rail-list > button[data-tool='select'] {
  padding-right: 20px;
}
.paper-rail-list .paper-selection-options {
  position: absolute;
  top: 8px;
  right: 4px;
  min-height: 32px;
  width: 18px;
  min-width: 18px;
  padding: 2px;
}
button {
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 40px;
  padding: 6px;
  border: 1px solid transparent;
  border-radius: var(--pe-radius);
  font-size: 12px;
  text-align: left;
  color: inherit;
  background: transparent;
  cursor: pointer;
  flex-shrink: 0;
}
button:hover {
  background: var(--pe-hover);
}
button[aria-pressed='true'] {
  background: var(--pe-active);
  border-color: var(--pe-ink);
}
button:focus-visible {
  outline: 2px solid var(--pe-ink);
  outline-offset: -2px;
}
button svg {
  flex-shrink: 0;
}
kbd {
  display: none;
  margin-left: auto;
  font: 11px system-ui;
  color: var(--pe-muted);
  padding: 0;
  border: 0;
  box-shadow: none;
  min-width: 0;
  min-height: 0;
  height: auto;
  width: auto;
  background: transparent;
}
@media (pointer: coarse) {
  button {
    min-height: 44px;
  }
}
.paper-rail-menu {
  position: absolute;
  left: calc(100% + 8px);
  top: 0;
  display: grid;
  gap: 4px;
  min-width: 180px;
  max-height: 100%;
  overflow: auto;
  padding: 8px;
  background: var(--pe-surface);
  border: 1px solid var(--pe-border);
  border-radius: var(--pe-panel-radius);
  box-shadow: var(--pe-shadow);
}
@media (max-width: 650px) {
  button {
    flex-direction: column;
    gap: 2px;
    padding: 6px 2px;
    font-size: 11px;
  }
  kbd {
    display: none;
  }
  .paper-rail-menu button {
    flex-direction: row;
    padding: 8px;
  }
  .paper-rail-menu {
    min-width: 160px;
  }
}
</style>
