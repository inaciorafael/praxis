<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { X, Minus, Plus, SlidersHorizontal } from '@lucide/vue'
import type {
  BoardTextAlign,
  BoardTextVerticalAlign,
  BoardTextBackground,
} from '@/shared/types/board'
import type { Arrangement } from '../lib/arrange'
import { BOARD_FONT_SIZE_PRESETS } from '../lib/text'
const props = defineProps<{
  count: number
  text: boolean
  fill: boolean
  fontSize?: number
  fillColor?: string | null
  textColor?: string
  align?: BoardTextAlign
  verticalAlign?: BoardTextVerticalAlign
  movableCount: number
  stroke: boolean
  strokeColor: string
  strokeWidth: number
  opacity: number
  textBox: boolean
  textBackground?: BoardTextBackground
  autoWidth?: boolean
}>()
const emit = defineEmits<{
  close: []
  advanced: []
  edit: []
  fontSize: [size: number]
  fillColor: [color: string | null]
  textColor: [color: string]
  alignment: [horizontal: BoardTextAlign, vertical: BoardTextVerticalAlign]
  arrange: [action: Arrangement]
  brush: [patch: { strokeColor?: string; strokeWidth?: number; opacity?: number }]
  background: [background: BoardTextBackground]
  autoWidth: [auto: boolean]
}>()
const { t } = useI18n()
const palette = [
  '#ffffff',
  '#fff0b3',
  '#d3f2dc',
  '#d8eaff',
  '#ffdae7',
  '#e8dcff',
  '#202733',
]
const arrangements: Arrangement[] = [
  'left',
  'center',
  'right',
  'top',
  'middle',
  'bottom',
  'horizontal',
  'vertical',
]
const horizontal: BoardTextAlign[] = ['left', 'center', 'right']
const vertical: BoardTextVerticalAlign[] = ['top', 'middle', 'bottom']
function sizeChanged(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.value.trim() || !Number.isFinite(input.valueAsNumber)) {
    input.value = props.fontSize?.toString() ?? ''
    return
  }
  const size = Math.round(Math.max(8, Math.min(72, input.valueAsNumber)))
  input.value = String(size)
  emit('fontSize', size)
}
</script>
<template>
  <section
    class="paper-element-controls"
    :aria-label="t('boards.usability.properties')"
    @pointerdown.stop
    @wheel.stop
    @keydown.stop
    @keydown.esc.prevent="emit('close')"
  >
    <header>
      <strong>{{ t('boards.usability.selection', count) }}</strong
      ><button
        :aria-label="t('common.close')"
        @click="emit('close')"
      >
        <X :size="16" />
      </button>
    </header>
    <section
      v-if="text"
      class="property-section"
    >
      <div class="section-title">
        <strong>{{ t('boards.tools.text') }}</strong
        ><button
          v-if="count === 1"
          class="text-action"
          data-properties-edit
          @click="emit('edit')"
        >
          {{ t('boards.editText') }}
        </button>
      </div>
      <label class="size-label"
        >{{ t('boards.rich.size') }}
        <div class="size-control">
          <button
            data-element-size-minus
            :aria-label="t('boards.rich.decreaseSize')"
            :disabled="fontSize === 8"
            @click="emit('fontSize', Math.max(8, (fontSize ?? 22) - 2))"
          >
            <Minus :size="15" /></button
          ><input
            data-element-font-size
            type="number"
            min="8"
            max="72"
            :value="fontSize"
            :placeholder="t('boards.usability.mixed')"
            :aria-label="t('boards.rich.size')"
            @change="sizeChanged"
            @keydown.enter.prevent="sizeChanged"
          /><button
            data-element-size-plus
            :aria-label="t('boards.rich.increaseSize')"
            :disabled="fontSize === 72"
            @click="emit('fontSize', Math.min(72, (fontSize ?? 22) + 2))"
          >
            <Plus :size="15" />
          </button></div
      ></label>
      <div class="size-presets">
        <button
          v-for="size in BOARD_FONT_SIZE_PRESETS"
          :key="size"
          :data-element-size-preset="size"
          :aria-pressed="fontSize === size"
          @click="emit('fontSize', size)"
        >
          {{ size }}
        </button>
      </div>
      <label class="color-control"
        >{{ t('boards.usability.textColor')
        }}<span v-if="!textColor">{{ t('boards.usability.mixed') }}</span
        ><input
          data-element-text-color
          type="color"
          :value="textColor ?? '#263238'"
          :aria-label="t('boards.usability.textColor')"
          @change="emit('textColor', ($event.target as HTMLInputElement).value)"
      /></label>
      <strong class="subheading">{{ t('boards.usability.textPosition') }}</strong>
      <div
        class="position-grid"
        role="group"
        :aria-label="t('boards.usability.textPosition')"
      >
        <template
          v-for="v in vertical"
          :key="v"
          ><button
            v-for="h in horizontal"
            :key="h"
            :data-text-position="`${v}-${h}`"
            :aria-pressed="align === h && verticalAlign === v"
            :aria-label="`${t(`boards.textVerticalAlignments.${v}`)}, ${t(`boards.textAlignments.${h}`)}`"
            :title="`${t(`boards.textVerticalAlignments.${v}`)}, ${t(`boards.textAlignments.${h}`)}`"
            @click="emit('alignment', h, v)"
          >
            <span
              class="position-dot"
              :style="{
                alignSelf: v === 'middle' ? 'center' : v === 'top' ? 'start' : 'end',
                justifySelf: h === 'center' ? 'center' : h === 'left' ? 'start' : 'end',
              }"
            /></button
        ></template>
      </div>
    </section>
    <section
      v-if="textBox"
      class="property-section"
    >
      <strong>{{ t('boards.textBackground') }}</strong>
      <div class="background-presets">
        <button
          v-for="background in ['none', 'rectangle', 'ellipse'] as const"
          :key="background"
          :data-element-background="background"
          :aria-pressed="textBackground === background"
          @click="emit('background', background)"
        >
          {{ t(`boards.textBackgrounds.${background}`) }}
        </button>
      </div>
      <label
        ><input
          data-element-auto-width
          type="checkbox"
          :checked="autoWidth"
          @change="emit('autoWidth', ($event.target as HTMLInputElement).checked)"
        />
        {{ t('boards.textAutoWidth') }}</label
      >
    </section>
    <section
      v-if="fill"
      class="property-section"
    >
      <strong>{{ t('boards.usability.fill') }}</strong>
      <div
        class="fill-palette"
        role="group"
        :aria-label="t('boards.usability.fill')"
      >
        <button
          data-fill-transparent
          class="transparent-swatch"
          :aria-label="t('boards.usability.transparent')"
          :title="t('boards.usability.transparent')"
          :aria-pressed="fillColor === 'transparent'"
          @click="emit('fillColor', 'transparent')"
        >
          ∅</button
        ><button
          v-for="color in palette"
          :key="color"
          :data-fill-preset="color"
          :aria-label="`${t('boards.usability.fill')} ${color}`"
          :title="color"
          :aria-pressed="fillColor === color"
          @click="emit('fillColor', color)"
        >
          <span :style="{ background: color }" />
        </button>
      </div>
      <label class="color-control"
        >{{ t('boards.usability.customColor')
        }}<input
          data-fill-color
          type="color"
          :value="fillColor?.startsWith('#') ? fillColor : '#ffffff'"
          :aria-label="t('boards.usability.customColor')"
          @change="emit('fillColor', ($event.target as HTMLInputElement).value)"
      /></label>
      <button
        class="text-action"
        data-fill-default
        @click="emit('fillColor', null)"
      >
        {{ t('boards.usability.defaultFill') }}
      </button>
    </section>
    <section
      v-if="stroke"
      class="property-section"
    >
      <label class="color-control"
        >{{ t('boards.usability.stroke')
        }}<input
          data-element-stroke-color
          type="color"
          :value="strokeColor"
          :aria-label="t('boards.usability.stroke')"
          @change="
            emit('brush', { strokeColor: ($event.target as HTMLInputElement).value })
          "
      /></label>
      <label class="stroke-range"
        >{{ t('boards.studio.strokeSize') }}<output>{{ strokeWidth }} px</output
        ><input
          data-element-stroke-width
          type="range"
          min="0.5"
          max="32"
          step="0.5"
          :value="strokeWidth"
          @change="
            emit('brush', {
              strokeWidth: Number(($event.target as HTMLInputElement).value),
            })
          "
      /></label>
    </section>
    <section class="property-section">
      <label class="stroke-range"
        >{{ t('boards.studio.opacity') }}<output>{{ Math.round(opacity * 100) }}%</output
        ><input
          data-element-opacity
          type="range"
          min="5"
          max="100"
          step="5"
          :value="Math.round(opacity * 100)"
          @change="
            emit('brush', {
              opacity: Number(($event.target as HTMLInputElement).value) / 100,
            })
          "
      /></label>
    </section>
    <section
      v-if="movableCount >= 2"
      class="property-section arrangement-section"
    >
      <strong>{{ t('boards.usability.organize') }}</strong>
      <div class="arrange-grid">
        <button
          v-for="action in arrangements"
          :key="action"
          :data-arrange="action"
          :disabled="['horizontal', 'vertical'].includes(action) && movableCount < 3"
          @click="emit('arrange', action)"
        >
          {{ t(`boards.usability.arrange.${action}`) }}
        </button>
      </div>
    </section>
    <button
      class="advanced-action"
      data-properties-advanced
      @click="emit('advanced')"
    >
      <SlidersHorizontal :size="16" />{{ t('boards.usability.advanced') }}
    </button>
  </section>
</template>
<style scoped>
.paper-element-controls {
  display: flex;
  flex-direction: column;
  position: absolute;
  z-index: 3;
  right: 12px;
  top: 76px;
  width: 280px;
  max-width: calc(100% - 24px);
  max-height: calc(100% - 150px);
  overflow: auto;
  background: var(--surface);
  color: var(--ink);
  border: 1px solid var(--border);
  border-radius: 14px;
  box-shadow: 0 5px 20px var(--shadow-color);
  padding: 14px;
  font-size: 12px;
}
header,
.section-title,
.color-control,
.size-label {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
header {
  order: -2;
  margin-bottom: 8px;
}
button {
  min-height: 34px;
  border: 1px solid var(--border);
  border-radius: 7px;
  background: transparent;
  color: inherit;
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 5px;
}
button:hover {
  background: var(--hover);
}
button[aria-pressed='true'] {
  background: var(--selection);
  border-color: var(--accent);
}
button:focus-visible,
input:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
button:disabled {
  opacity: 0.4;
  cursor: default;
}
header button {
  border: none;
  width: 34px;
}
.property-section {
  flex-shrink: 0;
  display: grid;
  gap: 10px;
  border-top: 1px solid var(--border);
  padding: 12px 0;
}
.size-control {
  display: flex;
  gap: 3px;
}
.size-control input {
  width: 58px;
  min-height: 34px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--paper);
  color: inherit;
}
.size-presets {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
}
.color-control input {
  width: 44px;
  height: 34px;
  padding: 2px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: transparent;
}
.position-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.position-grid button {
  height: 37px;
  padding: 7px;
}
.position-dot {
  width: 15px;
  height: 4px;
  background: currentColor;
  border-radius: 2px;
}
.fill-palette {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 5px;
}
.fill-palette span {
  width: 28px;
  height: 20px;
  border-radius: 4px;
  border: 1px solid #0002;
}
.transparent-swatch {
  background: repeating-conic-gradient(#aaa3 0% 25%, transparent 0% 50%) 50%/10px 10px;
}
.text-action {
  font-size: 11px;
  padding-inline: 8px;
}
.arrange-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 5px;
}
.advanced-action {
  width: 100%;
  display: flex;
  gap: 8px;
  justify-content: center;
}
.subheading {
  font-size: 11px;
}
.arrangement-section {
  order: -1;
}
.background-presets {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
.stroke-range {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 8px;
}
.stroke-range input {
  grid-column: 1 / -1;
  width: 100%;
  accent-color: var(--accent);
  min-height: 24px;
}
.stroke-range output {
  font-variant-numeric: tabular-nums;
}
@media (max-width: 700px) {
  .paper-element-controls {
    top: 76px;
    width: 240px;
    max-height: calc(100% - 150px);
  }
}
</style>
