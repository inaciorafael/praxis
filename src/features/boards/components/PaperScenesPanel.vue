<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { BoardScene } from '@/shared/types/board'

const props = withDefaults(
  defineProps<{
    scenes: BoardScene[]
    activeId?: string | null
    readOnly?: boolean
    contentId: string
    exporting?: boolean
    framesVisible?: boolean
  }>(),
  { framesVisible: true }
)
const emit = defineEmits<{
  close: []
  create: [BoardScene['aspectRatio']]
  focus: [string]
  edit: [string]
  update: [BoardScene]
  remove: [string]
  reorder: [string[]]
  present: []
  exportPdf: []
  visibility: [boolean]
}>()
const { t } = useI18n()
const panelRoot = ref<HTMLElement>()
watch(
  () => props.activeId,
  async (id) => {
    await nextTick()
    const item = [
      ...(panelRoot.value?.querySelectorAll<HTMLElement>('[data-scene]') ?? []),
    ].find((item) => item.dataset.scene === id)
    item?.scrollIntoView?.({ block: 'nearest' })
  }
)
const showFrames = ref(props.framesVisible ?? true)
watch(
  () => props.framesVisible,
  (value) => {
    showFrames.value = value ?? true
  }
)
const draggingId = ref<string | null>(null)
const ratios: BoardScene['aspectRatio'][] = ['16:9', '4:3', 'free']

function rename(scene: BoardScene, event: Event) {
  if (props.readOnly) return
  const title = (event.target as HTMLInputElement).value.trim().slice(0, 200)
  if (title && title !== scene.title) emit('update', { ...scene, title })
  else (event.target as HTMLInputElement).value = scene.title
}
function changeRatio(scene: BoardScene, event: Event) {
  if (props.readOnly) return
  const aspectRatio = (event.target as HTMLSelectElement)
    .value as BoardScene['aspectRatio']
  const height =
    aspectRatio === 'free'
      ? scene.height
      : scene.width * (aspectRatio === '16:9' ? 9 / 16 : 3 / 4)
  emit('update', { ...scene, aspectRatio, height })
}
function move(id: string, target: number) {
  if (props.readOnly || target < 0 || target >= props.scenes.length) return
  const ids = props.scenes.map((scene) => scene.id)
  const index = ids.indexOf(id)
  if (index < 0 || index === target) return
  ids.splice(index, 1)
  ids.splice(target, 0, id)
  emit('reorder', ids)
}
function startDrag(scene: BoardScene, event: DragEvent) {
  if (props.readOnly) return
  draggingId.value = scene.id
  event.dataTransfer?.setData('text/plain', scene.id)
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}
function drop(index: number) {
  if (draggingId.value) move(draggingId.value, index)
  draggingId.value = null
}
function toggleFrames(event: Event) {
  showFrames.value = (event.target as HTMLInputElement).checked
  emit('visibility', showFrames.value)
}
</script>

<template>
  <aside
    ref="panelRoot"
    class="paper-scenes-panel"
    :aria-label="t('papers.presentation.title')"
    @pointerdown.stop
    @keydown.stop
  >
    <header>
      <strong>{{ t('papers.presentation.title') }}</strong>
      <button
        type="button"
        :aria-label="t('papers.presentation.close')"
        @click="emit('close')"
      >
        ×
      </button>
    </header>
    <div class="scene-actions">
      <button
        type="button"
        data-present
        :disabled="!scenes.length"
        @click="emit('present')"
      >
        ▶ {{ t('papers.presentation.present') }}
      </button>
      <button
        type="button"
        data-export
        :disabled="!scenes.length || exporting"
        @click="emit('exportPdf')"
      >
        {{ t('papers.presentation.exportPdf') }}
      </button>
    </div>
    <fieldset
      class="scene-create"
      :disabled="readOnly || scenes.length >= 100"
    >
      <legend>{{ t('papers.presentation.create') }}</legend>
      <button
        v-for="ratio in ratios"
        :key="ratio"
        type="button"
        :data-create="ratio"
        @click="emit('create', ratio)"
      >
        {{ ratio === 'free' ? t('papers.presentation.free') : ratio }}
      </button>
    </fieldset>
    <p
      v-if="scenes.length >= 100"
      class="scene-hint"
    >
      {{ t('papers.presentation.limit') }}
    </p>
    <label class="scene-visibility"
      ><input
        type="checkbox"
        :checked="showFrames"
        @change="toggleFrames"
      />{{ t('papers.presentation.showFrames') }}</label
    >
    <p
      v-if="!scenes.length"
      class="scene-empty"
    >
      {{ t('papers.presentation.empty') }}
    </p>
    <ol
      v-else
      class="scene-list"
    >
      <li
        v-for="(scene, index) in scenes"
        :key="scene.id"
        :data-scene="scene.id"
        :class="{ active: activeId === scene.id }"
        :draggable="!readOnly"
        @dragstart="startDrag(scene, $event)"
        @dragend="draggingId = null"
        @dragover.prevent
        @drop.prevent="drop(index)"
      >
        <button
          type="button"
          class="scene-preview"
          :aria-label="`${index + 1}. ${scene.title}`"
          :aria-pressed="activeId === scene.id"
          @click="emit('focus', scene.id)"
        >
          <svg
            :viewBox="`${scene.x} ${scene.y} ${scene.width} ${scene.height}`"
            aria-hidden="true"
            preserveAspectRatio="xMidYMid meet"
          >
            <rect
              :x="scene.x"
              :y="scene.y"
              :width="scene.width"
              :height="scene.height"
              fill="var(--paper-canvas-bg, #fff)"
            />
            <use :href="`#${contentId}`" />
          </svg>
          <span class="scene-number">{{ index + 1 }}</span>
        </button>
        <input
          class="scene-name"
          :aria-label="t('papers.presentation.name')"
          :value="scene.title"
          :disabled="readOnly"
          maxlength="200"
          @change="rename(scene, $event)"
        />
        <div
          v-if="activeId === scene.id"
          class="scene-controls"
        >
          <label
            >{{ t('papers.presentation.ratio')
            }}<select
              :value="scene.aspectRatio"
              :disabled="readOnly"
              @change="changeRatio(scene, $event)"
            >
              <option
                v-for="ratio in ratios"
                :key="ratio"
                :value="ratio"
              >
                {{ ratio === 'free' ? t('papers.presentation.free') : ratio }}
              </option>
            </select></label
          >
          <button
            type="button"
            data-adjust
            :disabled="readOnly"
            @click="emit('edit', scene.id)"
          >
            {{ t('papers.presentation.adjust') }}
          </button>
        </div>
        <div class="scene-order">
          <button
            type="button"
            data-move="up"
            :aria-label="t('papers.presentation.up')"
            :disabled="readOnly || index === 0"
            @click="move(scene.id, index - 1)"
          >
            ↑
          </button>
          <button
            type="button"
            data-move="down"
            :aria-label="t('papers.presentation.down')"
            :disabled="readOnly || index === scenes.length - 1"
            @click="move(scene.id, index + 1)"
          >
            ↓
          </button>
          <button
            type="button"
            class="scene-remove"
            data-remove
            :disabled="readOnly"
            :title="t('papers.presentation.removeHint')"
            @click="emit('remove', scene.id)"
          >
            {{ t('papers.presentation.remove') }}
          </button>
        </div>
      </li>
    </ol>
    <p class="scene-hint">{{ t('papers.presentation.hint') }}</p>
  </aside>
</template>

<style scoped>
.paper-scenes-panel {
  position: absolute;
  z-index: 16;
  top: 72px;
  right: 16px;
  width: 280px;
  max-width: calc(100% - 32px);
  max-height: calc(100% - 88px);
  overflow: auto;
  padding: 12px;
  border: 1px solid var(--border, #d7d3c9);
  border-radius: 6px;
  color: var(--ink, #272724);
  background: var(--paper, #faf9f5);
  box-shadow: 0 4px 16px #00000014;
  font-size: 12px;
}
header,
.scene-actions,
.scene-order,
.scene-controls {
  display: flex;
  align-items: center;
  gap: 6px;
}
header {
  justify-content: space-between;
  margin-bottom: 10px;
}
button,
input,
select {
  font: inherit;
  color: inherit;
}
button,
select {
  border: 1px solid var(--border, #d7d3c9);
  background: transparent;
  border-radius: 3px;
  padding: 5px 7px;
  cursor: pointer;
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
button:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid var(--ink, #272724);
  outline-offset: 2px;
}
.scene-actions > button {
  flex: 1;
}
.scene-create {
  display: flex;
  gap: 6px;
  padding: 8px 0;
  margin: 8px 0 0;
  border: 0;
}
.scene-create legend {
  padding: 0;
  color: var(--ink-muted, #6c6a64);
}
.scene-create > button {
  flex: 1;
}
.scene-visibility {
  display: flex;
  gap: 6px;
  align-items: center;
  padding: 4px 0 10px;
}
.scene-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 10px;
}
.scene-list > li {
  padding: 7px;
  border: 1px solid var(--border, #d7d3c9);
  border-radius: 4px;
}
.scene-list > li.active {
  border-color: var(--ink, #272724);
}
.scene-preview {
  width: 100%;
  padding: 0;
  position: relative;
  overflow: hidden;
  background: #fff;
}
.scene-preview svg {
  display: block;
  width: 100%;
  height: 124px;
  pointer-events: none;
}
.scene-number {
  position: absolute;
  bottom: 4px;
  left: 4px;
  background: var(--paper, #faf9f5);
  border: 1px solid var(--border, #d7d3c9);
  padding: 1px 5px;
  border-radius: 2px;
}
.scene-name {
  box-sizing: border-box;
  width: 100%;
  border: 0;
  background: transparent;
  padding: 8px 1px;
  font-weight: 600;
}
.scene-controls {
  flex-wrap: wrap;
  margin-bottom: 7px;
}
.scene-controls label {
  display: flex;
  align-items: center;
  gap: 6px;
}
.scene-order button {
  min-width: 28px;
}
.scene-order .scene-remove {
  margin-left: auto;
}
.scene-hint,
.scene-empty {
  color: var(--ink-muted, #6c6a64);
  line-height: 1.5;
  margin: 10px 0 0;
}
.scene-empty {
  padding: 16px 4px;
  text-align: center;
}
</style>
