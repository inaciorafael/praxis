<script setup lang="ts">
import { computed } from 'vue'
import { SlidersHorizontal, Type, Copy, Trash2 } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import type { BoardDrawBrush, BoardTextFont, BoardTextAlign } from '@/shared/types/board'
import { BOARD_FONT_SIZE_PRESETS } from '../lib/text'
import { PEN_COLORS } from '../lib/ink-colors'
const props = defineProps<{
  tool: string
  brush?: BoardDrawBrush | null
  color: string
  width: number
  selection: boolean
  text: boolean
  fill: boolean
  fontSize?: number
  font?: BoardTextFont
  textColor?: string
  fillColor?: string | null
  align?: BoardTextAlign
  settingsOpen: boolean
  drawingSelection?: boolean
  baseInstrument?: string
  editAvailable?: boolean
}>()
const emit = defineEmits<{
  brush: [patch: { strokeColor?: string; strokeWidth?: number }]
  instrument: [value: string]
  fontSize: [size: number]
  font: [font: BoardTextFont]
  textColor: [color: string]
  fillColor: [color: string | null]
  align: [align: BoardTextAlign]
  settings: []
  edit: []
  duplicate: []
  remove: []
}>()
const { t } = useI18n()
const drawing = computed(
  () => ['draw', 'pen'].includes(props.tool) || props.drawingSelection
)
const instrument = computed(
  () =>
    props.brush ??
    (props.baseInstrument === 'pen' || props.tool === 'pen' ? 'pen' : 'pencil')
)
function size(event: Event) {
  const value = (event.target as HTMLInputElement).valueAsNumber
  if (Number.isFinite(value))
    emit('fontSize', Math.max(8, Math.min(72, Math.round(value))))
}
</script>
<template>
  <section
    class="paper-context-bar"
    :aria-label="t('boards.atelier.context')"
    @pointerdown.stop
    @wheel.stop
    @keydown.stop
    @keydown.esc.prevent="settingsOpen && emit('settings')"
  >
    <strong class="paper-context-name">{{
      selection ? t('boards.usability.properties') : t(`boards.tools.${tool}`)
    }}</strong>
    <template v-if="drawing">
      <select
        data-context-instrument
        :value="instrument"
        :aria-label="t('boards.brushes.title')"
        @change="emit('instrument', ($event.target as HTMLSelectElement).value)"
      >
        <optgroup :label="t('boards.tools.draw')">
          <option value="pencil">{{ t('boards.tools.draw') }}</option>
          <option value="graphite">{{ t('boards.brushes.types.graphite') }}</option>
        </optgroup>
        <optgroup :label="t('boards.tools.pen')">
          <option value="pen">{{ t('boards.tools.pen') }}</option>
          <option value="fountain">{{ t('boards.brushes.types.fountain') }}</option>
          <option value="ink">{{ t('boards.brushes.types.ink') }}</option>
        </optgroup>
      </select>
    </template>
    <template v-if="text">
      <select
        :value="font ?? 'sans'"
        :aria-label="t('boards.textFont')"
        @change="
          emit('font', ($event.target as HTMLSelectElement).value as BoardTextFont)
        "
      >
        <option
          v-for="id in ['handwritten', 'sans']"
          :key="id"
          :value="id"
        >
          {{ t(`boards.textFonts.${id}`) }}
        </option>
      </select>
      <div
        class="paper-context-sizes"
        role="group"
        :aria-label="t('boards.rich.size')"
      >
        <button
          v-for="value in BOARD_FONT_SIZE_PRESETS"
          :key="value"
          :data-context-font-size="value"
          :aria-pressed="fontSize === value"
          @click="emit('fontSize', value)"
        >
          {{ value }}
        </button>
      </div>
      <input
        type="number"
        min="8"
        max="72"
        :value="fontSize"
        :aria-label="t('boards.rich.size')"
        @change="size"
      />
      <select
        :value="align ?? 'left'"
        :aria-label="t('boards.textAlignment')"
        @change="
          emit('align', ($event.target as HTMLSelectElement).value as BoardTextAlign)
        "
      >
        <option
          v-for="id in ['left', 'center', 'right']"
          :key="id"
          :value="id"
        >
          {{ t(`boards.textAlignments.${id}`) }}
        </option>
      </select>
      <label class="paper-context-color"
        >{{ t('boards.usability.textColor')
        }}<input
          type="color"
          :value="textColor ?? color"
          :aria-label="t('boards.usability.textColor')"
          @input="emit('textColor', ($event.target as HTMLInputElement).value)"
      /></label>
    </template>
    <template
      v-if="drawing || (!text && !['select', 'pan', 'image', 'eraser'].includes(tool))"
    >
      <div
        class="paper-context-colors"
        role="group"
        :aria-label="t('boards.penColors')"
      >
        <button
          v-for="ink in PEN_COLORS"
          :key="ink.color"
          :data-color-preset="ink.color"
          :aria-label="t(`boards.inkColors.${ink.id}`)"
          :aria-pressed="color === ink.color"
          :style="{ '--ink-color': ink.color }"
          @click="emit('brush', { strokeColor: ink.color })"
        >
          <span />
        </button>
      </div>
      <label class="paper-context-color"
        >{{ t('boards.studio.strokeSize')
        }}<select
          :value="width"
          :aria-label="t('boards.studio.strokeSize')"
          @change="
            emit('brush', {
              strokeWidth: Number(($event.target as HTMLSelectElement).value),
            })
          "
        >
          <option
            v-if="![1, 2, 4, 6].includes(width)"
            :value="width"
          >
            {{ width }} px
          </option>
          <option
            v-for="value in [1, 2, 4, 6]"
            :key="value"
            :value="value"
          >
            {{ value }} px
          </option>
        </select></label
      >
    </template>
    <template v-if="fill"
      ><label class="paper-context-color"
        >{{ t('boards.atelier.fill')
        }}<input
          type="color"
          :value="fillColor ?? '#ffffff'"
          :aria-label="t('boards.atelier.fill')"
          @input="emit('fillColor', ($event.target as HTMLInputElement).value)" /></label
      ><button
        :aria-pressed="!fillColor"
        @click="emit('fillColor', null)"
      >
        {{ t('boards.atelier.transparent') }}
      </button></template
    >
    <span
      v-if="!selection && ['select', 'pan'].includes(tool)"
      class="paper-context-hint"
      >{{
        t(tool === 'select' ? 'boards.atelier.selectHint' : 'boards.atelier.panHint')
      }}</span
    >
    <button
      v-if="selection && text && editAvailable"
      data-edit-text
      @click="emit('edit')"
    >
      <Type :size="16" />{{ t('boards.editText') }}
    </button>
    <template v-if="selection">
      <button
        :aria-label="t('boards.duplicateSelection')"
        :title="t('boards.duplicateSelection')"
        @click="emit('duplicate')"
      >
        <Copy :size="16" />
      </button>
      <button
        :aria-label="t('boards.deleteSelection')"
        :title="t('boards.deleteSelection')"
        @click="emit('remove')"
      >
        <Trash2 :size="16" />
      </button>
    </template>
    <button
      v-if="!['pan', 'eraser'].includes(tool)"
      data-context-settings
      :aria-expanded="settingsOpen"
      @click="emit('settings')"
    >
      <SlidersHorizontal :size="16" />{{ t('boards.atelier.adjustments') }}
    </button>
  </section>
</template>
<style scoped>
.paper-context-bar {
  position: absolute;
  top: 0;
  left: var(--pe-rail-width);
  right: 0;
  z-index: 5;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  padding: 4px 8px;
  max-height: 128px;
  overflow: auto;
  background: var(--pe-surface);
  color: var(--pe-ink);
  border-bottom: 1px solid var(--pe-border);
  font-size: 12px;
}
.paper-context-name {
  font-weight: 600;
  margin-right: 4px;
}
.paper-context-hint {
  color: var(--pe-muted);
  flex: 1;
}
button,
select,
input {
  color: inherit;
  background: var(--pe-surface);
  border: 1px solid var(--pe-border);
  border-radius: var(--pe-radius);
  font: inherit;
  min-height: 32px;
  padding: 4px 6px;
  max-width: 100%;
}
button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
}
button:hover {
  background: var(--pe-hover);
}
button[aria-pressed='true'] {
  background: var(--pe-active);
  border-color: var(--pe-ink);
}
button:focus-visible,
select:focus-visible,
input:focus-visible {
  outline: 2px solid var(--pe-ink);
  outline-offset: 2px;
}
.paper-context-sizes,
.paper-context-colors,
.paper-context-color {
  display: flex;
  gap: 4px;
  align-items: center;
}
.paper-context-color {
  gap: 6px;
}
.paper-context-colors button {
  padding: 5px;
  min-height: 32px;
  width: 32px;
  border-radius: 50%;
}
.paper-context-colors span {
  width: 18px;
  height: 18px;
  background: var(--ink-color);
  border: 1px solid #0002;
  border-radius: 50%;
}
input[type='color'] {
  width: 36px;
  padding: 4px;
}
input[type='number'] {
  width: 58px;
}
@media (pointer: coarse) {
  button,
  select,
  input {
    min-height: 44px;
  }
  .paper-context-colors button {
    min-height: 44px;
    width: 44px;
  }
}
@media (max-width: 650px) {
  .paper-context-bar {
    gap: 6px;
    padding: 8px;
    max-height: 190px;
  }
  .paper-context-name {
    width: 100%;
  }
  .paper-context-hint {
    display: none;
  }
}
</style>
