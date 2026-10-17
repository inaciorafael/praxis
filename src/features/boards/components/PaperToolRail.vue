<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, type Component } from 'vue'
import { Shapes, Plus } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
const props = defineProps<{
  tools: { id: string; icon: Component; shortcut?: string }[]
  activeTool: string
}>()
const emit = defineEmits<{ choose: [id: string]; undo: []; redo: [] }>()
const { t } = useI18n()
const root = ref<HTMLElement>()
const menu = ref<'shapes' | 'insert' | null>(null)
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
  const tool = props.tools.find(
    (tool) => tool.shortcut && tool.shortcut.toLowerCase() === event.key.toLowerCase()
  )
  if (tool) {
    event.preventDefault()
    choose(tool.id)
  }
}
watch(
  () => props.activeTool,
  () => {
    menu.value = null
  }
)
onMounted(() => window.addEventListener('pointerdown', outside))
onUnmounted(() => window.removeEventListener('pointerdown', outside))
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
        :aria-label="`${t(`boards.tools.${tool.id}`)}${tool.shortcut ? ` (${tool.shortcut})` : ''}`"
        :title="`${t(`boards.tools.${tool.id}`)}${tool.shortcut ? ` (${tool.shortcut})` : ''}`"
        @click="choose(tool.id)"
      >
        <component
          :is="tool.icon"
          :size="18"
          aria-hidden="true"
        /><span>{{ t(`boards.tools.${tool.id}`) }}</span
        ><kbd v-if="tool.shortcut">{{ tool.shortcut }}</kbd>
      </button>
      <button
        data-more-tools
        :aria-expanded="menu === 'shapes'"
        :aria-pressed="isShape"
        :aria-label="t('boards.studio.shapesLabel')"
        @click="menu = menu === 'shapes' ? null : 'shapes'"
      >
        <Shapes :size="18" /><span>{{ t('boards.studio.shapesLabel') }}</span>
      </button>
      <button
        :aria-expanded="menu === 'insert'"
        :aria-label="t('boards.atelier.insert')"
        @click="menu = menu === 'insert' ? null : 'insert'"
      >
        <Plus :size="18" /><span>{{ t('boards.atelier.insert') }}</span>
      </button>
    </div>
    <div
      v-show="menu"
      class="paper-rail-menu"
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
