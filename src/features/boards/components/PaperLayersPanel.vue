<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
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
const panel = ref<HTMLElement>()
watch(renaming, async (id) => {
  if (!id) return
  await nextTick()
  const input = panel.value?.querySelector<HTMLInputElement>('input:not([type])')
  input?.focus()
  input?.select()
})
function rename(layer: BoardLayer, event: Event) {
  const name = (event.target as HTMLInputElement).value.trim().slice(0, 80)
  if (name) emit('patch', layer.id, { name })
  renaming.value = null
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
  >
    <header>
      <strong
        ><Layers :size="16" />{{ t('boards.layers.title') }}</strong
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
      <p class="layer-hint">{{ t('boards.layers.hint') }}</p>
      <button
        class="add-layer"
        data-add-layer
        :disabled="readOnly || layers.length >= MAX_LAYERS"
        @click="emit('add')"
      >
        <Plus :size="16" />{{ t('boards.layers.add') }}
      </button>
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
              @click="emit('active', layer.id)"
            >
              <span class="layer-dot" /><span
                >{{ layer.name || t('boards.layers.default')
                }}<small>{{
                  t('boards.layers.items', { count: counts.get(layer.id) ?? 0 })
                }}</small></span
              >
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
              :disabled="readOnly"
              :aria-label="
                t(layer.locked ? 'boards.layers.unlock' : 'boards.layers.lock')
              "
              :aria-pressed="layer.locked"
              :data-layer-lock="layer.id"
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
          </div>
          <template v-if="layer.id === activeId">
            <input
              v-if="renaming === layer.id"
              autofocus
              :value="layer.name || t('boards.layers.default')"
              maxlength="80"
              :aria-label="t('boards.layers.name')"
              @change="rename(layer, $event)"
              @keydown.enter.prevent="rename(layer, $event)"
              @keydown.esc="renaming = null"
              @blur="renaming = null"
            />
            <div class="layer-actions">
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
      <footer v-if="active">
        <p
          v-if="active.locked || !active.visible || active.opacity === 0"
          role="status"
        >
          {{ t('boards.layers.unavailable') }}
        </p>
        <p v-else>
          {{
            t('boards.layers.drawingOn', {
              name: active.name || t('boards.layers.default'),
            })
          }}
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
  gap: 10px;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: 12px;
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
  flex: 1;
  min-height: 0;
  overflow: auto;
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
li {
  padding: 6px;
  border: 1px solid var(--border);
  border-radius: 8px;
}
li.active {
  border-color: var(--ink);
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
  margin-right: auto;
  font-size: 10px;
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
