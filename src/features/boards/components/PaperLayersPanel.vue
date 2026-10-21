<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Layers,
  Plus,
  Eye,
  EyeOff,
  LockKeyhole,
  LockKeyholeOpen,
  ChevronUp,
  ChevronDown,
  PanelLeftClose,
  PanelLeftOpen,
  Trash2,
  Ellipsis,
} from '@lucide/vue'
import type { BoardElement, BoardLayer } from '@/shared/types/board'
import { elementLayerId, MAX_LAYERS } from '../lib/layers'
const props = defineProps<{
  layers: BoardLayer[]
  elements: BoardElement[]
  activeId: string
  selectedCount: number
  readOnly: boolean
  collapsed: boolean
}>()
const emit = defineEmits<{
  active: [id: string]
  add: []
  patch: [id: string, patch: Partial<BoardLayer>]
  order: [id: string, direction: number]
  remove: [id: string]
  moveSelection: [id: string]
  collapse: []
}>()
const { t } = useI18n()
const active = computed(() => props.layers.find((layer) => layer.id === props.activeId))
const counts = computed(() => {
  const result = new Map<string, number>()
  for (const element of props.elements) {
    const id = elementLayerId(element)
    result.set(id, (result.get(id) ?? 0) + 1)
  }
  return result
})
const renaming = ref<string | null>(null)
const options = ref<string | null>(null)
const panel = ref<HTMLElement>()
function add() {
  closeOptions()
  emit('add')
}
function toggleOptions(id: string) {
  options.value = options.value === id ? null : id
  renaming.value = null
}
function closeOptions() {
  options.value = null
  renaming.value = null
}
watch(() => [props.collapsed, props.activeId, props.readOnly], closeOptions)
function selectLayer(id: string) {
  if (id === props.activeId) options.value = options.value === id ? null : id
  else {
    closeOptions()
    emit('active', id)
  }
}
function outside(event: PointerEvent) {
  if (event.target instanceof Node && !panel.value?.contains(event.target)) closeOptions()
}
onMounted(() => document.addEventListener('pointerdown', outside, true))
onUnmounted(() => document.removeEventListener('pointerdown', outside, true))
watch(renaming, async (id) => {
  if (!id) return
  await nextTick()
  const input = panel.value?.querySelector<HTMLInputElement>('input:not([type])')
  input?.focus()
  input?.select()
})
function rename(layer: BoardLayer, event: Event) {
  if (props.readOnly || renaming.value !== layer.id) return
  const name = (event.target as HTMLInputElement).value.trim().slice(0, 80)
  renaming.value = null
  if (name && name !== layer.name) emit('patch', layer.id, { name })
}
</script>
<template>
  <aside
    ref="panel"
    class="paper-layers"
    :class="{ collapsed }"
    :aria-label="t('boards.layers.title')"
    @pointerdown.stop
    @wheel.stop
    @contextmenu.stop.prevent
    @keydown.stop
    @keydown.esc.prevent="options ? closeOptions() : emit('collapse')"
  >
    <header>
      <strong><Layers :size="16" />{{ t('boards.layers.title') }}</strong
      ><button
        v-if="!collapsed"
        data-add-layer
        :disabled="readOnly || layers.length >= MAX_LAYERS"
        :aria-label="t('boards.layers.add')"
        :title="t('boards.layers.add')"
        @click="add"
      >
        <Plus :size="17" /></button
      ><button
        :aria-label="t(collapsed ? 'boards.layers.expand' : 'boards.layers.collapse')"
        :title="t('boards.layers.title')"
        @click="emit('collapse')"
      >
        <PanelLeftOpen
          v-if="collapsed"
          :size="17"
        /><PanelLeftClose
          v-else
          :size="17"
        />
      </button>
    </header>
    <template v-if="!collapsed">
      <ol
        :aria-label="t('boards.layers.title')"
        class="layer-list"
      >
        <li
          v-for="(layer, index) in [...layers].reverse()"
          :key="layer.id"
          :class="{ active: layer.id === activeId, muted: !layer.visible }"
          :data-layer-row="layer.id"
        >
          <div class="layer-row">
            <button
              class="layer-select"
              :data-layer-select="layer.id"
              :aria-pressed="layer.id === activeId"
              @click="selectLayer(layer.id)"
            >
              <span class="layer-dot" /><span
                >{{ layer.name || t('boards.layers.default')
                }}<small
                  >{{
                    `${Math.round(layer.opacity * 100)}% · ${counts.get(layer.id) ?? 0}`
                  }}
                  <LockKeyhole
                    v-if="layer.locked"
                    :size="10" /></small
              ></span>
            </button>
            <button
              :disabled="readOnly"
              :aria-label="t(layer.visible ? 'boards.layers.hide' : 'boards.layers.show')"
              :aria-pressed="!layer.visible"
              :data-layer-visibility="layer.id"
              @click="emit('patch', layer.id, { visible: !layer.visible })"
            >
              <Eye
                v-if="layer.visible"
                :size="16"
              /><EyeOff
                v-else
                :size="16"
              />
            </button>
            <button
              :data-layer-options="layer.id"
              :aria-label="
                t('boards.layers.options', {
                  name: layer.name || t('boards.layers.default'),
                })
              "
              :aria-expanded="options === layer.id"
              @click="toggleOptions(layer.id)"
            >
              <Ellipsis :size="16" />
            </button>
          </div>
          <template v-if="options === layer.id">
            <input
              v-if="renaming === layer.id"
              autofocus
              :value="layer.name || t('boards.layers.default')"
              maxlength="80"
              :aria-label="t('boards.layers.name')"
              @keydown.enter.prevent="rename(layer, $event)"
              @keydown.esc.stop.prevent="renaming = null"
              @blur="rename(layer, $event)"
            />
            <div class="layer-actions">
              <button
                :disabled="readOnly"
                :data-layer-lock="layer.id"
                :aria-label="
                  t(layer.locked ? 'boards.layers.unlock' : 'boards.layers.lock')
                "
                :aria-pressed="layer.locked"
                @click="emit('patch', layer.id, { locked: !layer.locked })"
              >
                <LockKeyhole
                  v-if="layer.locked"
                  :size="15"
                /><LockKeyholeOpen
                  v-else
                  :size="15"
                />
              </button>
              <button
                :disabled="readOnly"
                @click="renaming = layer.id"
              >
                {{ t('boards.layers.rename') }}</button
              ><button
                :disabled="readOnly || index === 0"
                :aria-label="t('boards.layers.up')"
                @click="emit('order', layer.id, 1)"
              >
                <ChevronUp :size="16" /></button
              ><button
                :disabled="readOnly || index === layers.length - 1"
                :aria-label="t('boards.layers.down')"
                @click="emit('order', layer.id, -1)"
              >
                <ChevronDown :size="16" /></button
              ><button
                :disabled="readOnly || layers.length < 2 || !!counts.get(layer.id)"
                :aria-label="t('boards.layers.removeEmpty')"
                :title="t('boards.layers.removeEmpty')"
                @click="emit('remove', layer.id)"
              >
                <Trash2 :size="15" />
              </button>
            </div>
            <label class="layer-opacity"
              >{{ t('boards.layers.opacity')
              }}<output>{{ Math.round(layer.opacity * 100) }}%</output
              ><input
                type="range"
                min="0"
                max="100"
                step="5"
                :disabled="readOnly"
                :value="layer.opacity * 100"
                :data-layer-opacity="layer.id"
                @change="
                  emit('patch', layer.id, {
                    opacity: Number(($event.target as HTMLInputElement).value) / 100,
                  })
                "
            /></label>
          </template>
        </li>
      </ol>
      <footer
        v-if="
          active &&
          (selectedCount || active.locked || !active.visible || active.opacity === 0)
        "
      >
        <p
          v-if="active.locked || !active.visible || active.opacity === 0"
          role="status"
        >
          {{ t('boards.layers.unavailable') }}
        </p>
        <button
          v-if="selectedCount"
          class="move-selection"
          data-move-to-layer
          :disabled="readOnly || active.locked || !active.visible || active.opacity === 0"
          @click="emit('moveSelection', activeId)"
        >
          {{ t('boards.layers.moveSelection', { count: selectedCount }) }}
        </button>
      </footer>
    </template>
  </aside>
</template>
<style scoped>
.paper-layers {
  position: absolute;
  z-index: 4;
  left: 12px;
  top: 76px;
  bottom: 76px;
  width: 220px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 4px;
  border: 1px solid var(--border);
  border-radius: var(--pe-radius);
  background: var(--surface);
  color: var(--ink);
  font-size: 12px;
  box-shadow: 0 4px 16px var(--shadow-color);
}
.paper-layers.collapsed {
  width: 40px;
  bottom: auto;
  padding: 4px;
}
header,
header strong,
.layer-row,
.layer-actions {
  display: flex;
  align-items: center;
  gap: 5px;
}
header {
  justify-content: space-between;
}
button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 5px;
  min-width: 26px;
  min-height: 28px;
  padding: 4px;
  border: 1px solid transparent;
  border-radius: 5px;
  color: inherit;
  background: transparent;
  cursor: pointer;
}
button:hover:not(:disabled),
button:focus-visible {
  background: var(--hover);
  outline: 1px solid var(--border);
}
button:disabled {
  opacity: 0.35;
  cursor: default;
}
.add-layer,
.move-selection {
  border-color: var(--border);
  flex-shrink: 0;
}
.layer-hint,
footer p {
  font-size: 11px;
  opacity: 0.7;
  margin: 0;
}
.layer-list {
  flex: 0 1 auto;
  min-height: 0;
  overflow: auto;
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 0;
}
li {
  padding: 2px;
  border-top: 1px solid var(--border);
}
li.active {
  background: var(--pe-active);
}
.layer-select {
  flex: 1;
  min-width: 0;
  text-align: left;
  justify-content: flex-start;
}
.layer-select > span:last-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.layer-dot {
  width: 6px;
  height: 6px;
  flex-shrink: 0;
  border: 1px solid var(--ink);
  border-radius: 50%;
}
.active .layer-dot {
  background: var(--ink);
}
small {
  display: block;
  font-size: 10px;
  opacity: 0.6;
}
.muted .layer-select {
  opacity: 0.5;
}
.layer-actions {
  margin-top: 5px;
}
.layer-actions button:first-child {
  font-size: 10px;
}
.layer-actions button:nth-child(2) {
  margin-right: auto;
}
.layer-opacity {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px;
  margin-top: 8px;
  font-size: 10px;
}
input[type='range'],
input:not([type]) {
  width: 100%;
  accent-color: var(--ink);
}
footer {
  display: grid;
  gap: 8px;
}
</style>
