<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
import { SlidersHorizontal, Type, Copy, Trash2 } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import type {
  BoardConnectorStyle,
  BoardSketchOptions,
  BoardDrawBrush,
  BoardTextFont,
  BoardTextAlign,
  BoardTextVerticalAlign,
  BoardTextBackground,
  BoardStrokeStyle,
  BoardFillStyle,
} from '@/shared/types/board'
import type { Arrangement } from '../lib/arrange'
import { BOARD_FONT_SIZE_PRESETS } from '../lib/text'
import { PEN_COLORS } from '../lib/ink-colors'
const props = defineProps<{
  canGroup?: boolean
  canUngroup?: boolean
  movableCount?: number
  rotatable?: boolean
  autoWidth?: boolean
  sketch?: BoardSketchOptions | null
  guidesEnabled?: boolean
  snapEnabled?: boolean
  shapeRecognition?: boolean
  connectorStyle?: BoardConnectorStyle
  connector?: boolean
  connectorLabel?: string
  tool: string
  selectionKey?: string
  keepTool?: boolean
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
  stroke?: boolean
  strokeStyle?: BoardStrokeStyle
  fillStyle?: BoardFillStyle
  opacity?: number
  textBox?: boolean
  textBackground?: BoardTextBackground
  verticalAlign?: BoardTextVerticalAlign
  eraserSize?: number
}>()
const emit = defineEmits<{
  group: []
  ungroup: []
  library: []
  rotate: [angle: number]
  arrange: [action: Arrangement]
  autoWidth: [auto: boolean]
  sketch: [patch: Partial<BoardSketchOptions>]
  guides: []
  snap: []
  shapeRecognition: []
  connectorStyle: [style: BoardConnectorStyle]
  connectorLabel: [label: string]
  brush: [patch: { strokeColor?: string; strokeWidth?: number; opacity?: number }]
  instrument: [value: string]
  fontSize: [size: number]
  font: [font: BoardTextFont]
  textColor: [color: string]
  fillColor: [color: string | null]
  align: [align: BoardTextAlign]
  settings: []
  dismiss: []
  keepTool: [enabled: boolean]
  edit: []
  duplicate: []
  remove: []
  strokeStyle: [style: BoardStrokeStyle]
  fillStyle: [style: BoardFillStyle]
  background: [background: BoardTextBackground]
  verticalAlign: [align: BoardTextVerticalAlign]
  eraserSize: [size: number]
  height: [height: number]
}>()
const { t } = useI18n()
const root = ref<HTMLElement>()
let observer: ResizeObserver | undefined
onMounted(() => {
  if (typeof ResizeObserver !== 'undefined' && root.value) {
    observer = new ResizeObserver(() => emit('height', root.value?.offsetHeight ?? 40))
    observer.observe(root.value)
  }
})
onUnmounted(() => observer?.disconnect())
const drawing = computed(
  () => ['draw', 'pen'].includes(props.tool) || props.drawingSelection
)
const instrument = computed(
  () =>
    props.brush ??
    (props.baseInstrument === 'pen' || props.tool === 'pen' ? 'pen' : 'pencil')
)
const hasStroke = computed(
  () =>
    props.stroke ??
    (drawing.value ||
      (!props.text &&
        !['select', 'lasso', 'pan', 'image', 'iframe', 'eraser'].includes(props.tool)))
)
const adjustable = computed(
  () => props.selection || hasStroke.value || props.text || props.fill
)
type Section = 'stroke' | 'fill' | 'text' | 'arrange'
const sections = computed(() => [
  ...(hasStroke.value ? ['stroke' as const] : []),
  ...(props.fill ? ['fill' as const] : []),
  ...(props.text ? ['text' as const] : []),
  ...(props.selection ? ['arrange' as const] : []),
])
const section = ref<Section>('stroke')
watch(
  () => [props.tool, props.selectionKey],
  () => {
    section.value = sections.value[0] ?? 'stroke'
  },
  { immediate: true }
)
watch(sections, (available) => {
  if (!available.includes(section.value)) section.value = available[0] ?? 'stroke'
})
function chooseSection(value: Section) {
  section.value = value
  if (props.settingsOpen) emit('dismiss')
}
function sectionLabel(value: Section) {
  return t('boards.ribbon.' + value)
}
function arrangeChanged(event: Event) {
  const input = event.target as HTMLSelectElement
  if (input.value) emit('arrange', input.value as Arrangement)
  input.value = ''
}
function size(event: Event) {
  const value = (event.target as HTMLInputElement).valueAsNumber
  if (Number.isFinite(value))
    emit('fontSize', Math.max(8, Math.min(72, Math.round(value))))
}
</script>
<template>
  <section
    ref="root"
    class="paper-context-bar"
    :aria-label="t('boards.atelier.context')"
    @pointerdown.stop
    @wheel.stop
    @keydown.stop
    @keydown.esc.prevent="emit('dismiss')"
  >
    <div class="paper-context-heading">
      <strong class="paper-context-name">{{
        selection ? t('boards.usability.properties') : t(`boards.tools.${tool}`)
      }}</strong>
      <button
        v-if="!selection && !['select', 'lasso', 'pan', 'eraser', 'image'].includes(tool)"
        data-keep-tool
        :aria-pressed="keepTool"
        :title="t('boards.ribbon.continuousHint')"
        @click="emit('keepTool', !keepTool)"
      >
        {{ t('boards.ribbon.continuous') }}
      </button>
      <div
        v-if="sections.length > 1"
        class="paper-context-tabs"
        role="group"
        :aria-label="t('boards.ribbon.sections')"
      >
        <button
          v-for="value in sections"
          :key="value"
          :data-context-section="value"
          :aria-pressed="section === value"
          @click="chooseSection(value)"
        >
          {{ sectionLabel(value) }}
        </button>
      </div>
      <button
        v-if="adjustable"
        data-context-settings
        :aria-expanded="settingsOpen"
        @click="emit('settings')"
      >
        <SlidersHorizontal :size="16" />{{ t('boards.atelier.adjustments') }}
      </button>
    </div>
    <div class="paper-context-content">
      <div
        class="paper-context-controls"
        v-show="!selection || section === 'arrange'"
        v-if="['select', 'lasso'].includes(tool)"
      >
        <button
          data-guides-toggle
          :aria-pressed="guidesEnabled"
          @click="emit('guides')"
        >
          {{ t('boards.guides.title') }}
        </button>
        <button
          data-snap-toggle
          :aria-pressed="snapEnabled && guidesEnabled"
          :disabled="!guidesEnabled"
          :title="t('boards.guides.hint')"
          @click="emit('snap')"
        >
          {{ t('boards.guides.snap') }}
        </button>
      </div>
      <template v-if="tool === 'eraser'">
        <div
          class="paper-context-sizes"
          role="group"
          :aria-label="t('boards.eraser.size')"
        >
          <button
            v-for="value in [12, 24, 48]"
            :key="value"
            :data-eraser-size="value"
            :aria-pressed="eraserSize === value"
            @click="emit('eraserSize', value)"
          >
            {{ value }} px
          </button>
        </div>
        <span class="paper-context-hint">{{ t('boards.eraser.hint') }}</span> </template
      ><span
        v-if="!selection && ['select', 'lasso', 'pan'].includes(tool)"
        class="paper-context-hint"
        >{{
          t(
            tool === 'lasso'
              ? 'boards.atelier.lassoHint'
              : tool === 'select'
                ? 'boards.atelier.selectHint'
                : 'boards.atelier.panHint'
          )
        }}</span
      >
      <div
        v-show="section === 'stroke'"
        class="paper-context-controls"
        data-context-page="stroke"
      >
        <template v-if="drawing">
          <button
            v-if="!selection"
            data-shape-recognition
            :aria-pressed="shapeRecognition"
            :title="t('boards.recognition.hint')"
            @click="emit('shapeRecognition')"
          >
            {{ t('boards.recognition.toggle') }}
          </button>
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
          </select> </template
        ><template v-if="connector">
          <select
            data-connector-style
            :value="connectorStyle ?? 'straight'"
            :aria-label="t('boards.connectors.path')"
            @change="
              emit(
                'connectorStyle',
                ($event.target as HTMLSelectElement).value as BoardConnectorStyle
              )
            "
          >
            <option
              v-for="id in ['straight', 'elbow', 'curve']"
              :key="id"
              :value="id"
            >
              {{ t('boards.connectors.' + id) }}
            </option>
          </select>
          <input
            v-if="selection"
            data-connector-label-input
            type="text"
            maxlength="80"
            :value="connectorLabel"
            :placeholder="t('boards.connectors.label')"
            :aria-label="t('boards.connectors.label')"
            @change="emit('connectorLabel', ($event.target as HTMLInputElement).value)"
            @keydown.enter.prevent="($event.target as HTMLInputElement).blur()"
          /> </template
        ><template v-if="hasStroke">
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
            >{{ t('boards.usability.stroke')
            }}<input
              data-context-stroke
              type="color"
              :value="color"
              :aria-label="t('boards.usability.stroke')"
              @change="
                emit('brush', { strokeColor: ($event.target as HTMLInputElement).value })
              "
          /></label>

          <div
            class="paper-context-sizes paper-ink-widths"
            role="group"
            :aria-label="t('boards.studio.quickWidths')"
          >
            <button
              v-for="value in [0.5, 1, 2, 4, 8]"
              :key="value"
              :data-context-width="value"
              :aria-pressed="width === value"
              :aria-label="value + ' px'"
              :title="value + ' px'"
              @click="emit('brush', { strokeWidth: value })"
            >
              <svg
                width="24"
                height="14"
                viewBox="0 0 24 14"
                aria-hidden="true"
              >
                <path
                  d="M3 9 Q9 3 13 7 T21 5"
                  fill="none"
                  :stroke="color"
                  :stroke-width="value"
                  stroke-linecap="round"
                />
              </svg>
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
                v-if="![0.5, 1, 2, 4, 6, 8, 12, 20, 32].includes(width)"
                :value="width"
              >
                {{ width }} px
              </option>
              <option
                v-for="value in [0.5, 1, 2, 4, 6, 8, 12, 20, 32]"
                :key="value"
                :value="value"
              >
                {{ value }} px
              </option>
            </select></label
          >
          <select
            v-if="!drawing"
            :value="strokeStyle ?? 'pencil'"
            :aria-label="t('boards.strokeStyle')"
            @change="
              emit(
                'strokeStyle',
                ($event.target as HTMLSelectElement).value as BoardStrokeStyle
              )
            "
          >
            <option
              v-for="id in ['pencil', 'pen', 'clean']"
              :key="id"
              :value="id"
            >
              {{ t(`boards.strokeStyles.${id}`) }}
            </option>
          </select>
        </template>
        <select
          v-if="hasStroke && !drawing"
          data-context-pattern
          :value="sketch?.strokePattern ?? 'solid'"
          :aria-label="t('boards.toolReview.pattern')"
          @change="
            emit('sketch', {
              strokePattern: ($event.target as HTMLSelectElement)
                .value as BoardSketchOptions['strokePattern'],
            })
          "
        >
          <option
            v-for="id in ['solid', 'dashed', 'dotted']"
            :key="id"
            :value="id"
          >
            {{ t('boards.toolReview.patterns.' + id) }}
          </option>
        </select>
      </div>
      <div
        v-show="section === 'fill'"
        class="paper-context-controls"
        data-context-page="fill"
      >
        <template v-if="fill">
          <div
            class="paper-context-colors paper-fill-presets"
            role="group"
            :aria-label="t('boards.atelier.fill')"
          >
            <button
              v-for="value in ['#ffffff', '#fff0b3', '#d8eaff', '#d3f2dc', '#f7d8df']"
              :key="value"
              :data-context-fill="value"
              :aria-label="t('boards.atelier.fill') + ' ' + value"
              :aria-pressed="fillColor === value"
              :style="{ '--ink-color': value }"
              @click="emit('fillColor', value)"
            >
              <span />
            </button>
          </div>
          <label class="paper-context-color"
            >{{ t('boards.atelier.fill')
            }}<input
              type="color"
              :value="fillColor?.startsWith('#') ? fillColor : '#ffffff'"
              :aria-label="t('boards.atelier.fill')"
              @change="
                emit('fillColor', ($event.target as HTMLInputElement).value)
              " /></label
          ><button
            :aria-pressed="fillColor === 'transparent'"
            @click="emit('fillColor', 'transparent')"
          >
            {{ t('boards.atelier.transparent') }}
          </button>
          <select
            :value="fillStyle"
            :aria-label="t('boards.fillStyles.title')"
            @change="
              emit(
                'fillStyle',
                ($event.target as HTMLSelectElement).value as BoardFillStyle
              )
            "
          >
            <option
              v-for="id in ['solid', 'hachure', 'cross-hatch', 'zigzag']"
              :key="id"
              :value="id"
            >
              {{ t(`boards.fillStyles.${id}`) }}
            </option>
          </select></template
        >
        <template
          v-if="
            fill &&
            fillColor &&
            fillColor !== 'transparent' &&
            fillStyle &&
            fillStyle !== 'solid'
          "
        >
          <label class="paper-context-color"
            >{{ t('boards.toolReview.hatchAngle')
            }}<input
              data-context-hatch-angle
              type="number"
              min="-90"
              max="90"
              :value="sketch?.hachureAngle ?? -41"
              @change="
                emit('sketch', {
                  hachureAngle: Math.max(
                    -90,
                    Math.min(90, Number(($event.target as HTMLInputElement).value) || 0)
                  ),
                })
              "
          /></label>
          <label class="paper-context-color"
            >{{ t('boards.toolReview.hatchGap')
            }}<input
              data-context-hatch-gap
              type="number"
              min="5"
              max="24"
              :value="sketch?.hachureGap ?? 8"
              @change="
                emit('sketch', {
                  hachureGap: Math.max(
                    5,
                    Math.min(24, Number(($event.target as HTMLInputElement).value) || 5)
                  ),
                })
              "
          /></label>
        </template>
      </div>
      <div
        v-show="section === 'text'"
        class="paper-context-controls"
        data-context-page="text"
      >
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
              @change="emit('textColor', ($event.target as HTMLInputElement).value)"
          /></label>
          <select
            v-if="fill"
            :value="verticalAlign ?? 'top'"
            :aria-label="t('boards.textVerticalAlignment')"
            @change="
              emit(
                'verticalAlign',
                ($event.target as HTMLSelectElement).value as BoardTextVerticalAlign
              )
            "
          >
            <option
              v-for="id in ['top', 'middle', 'bottom']"
              :key="id"
              :value="id"
            >
              {{ t(`boards.textVerticalAlignments.${id}`) }}
            </option>
          </select>
          <select
            v-if="textBox"
            :value="textBackground ?? 'none'"
            :aria-label="t('boards.textBackground')"
            @change="
              emit(
                'background',
                ($event.target as HTMLSelectElement).value as BoardTextBackground
              )
            "
          >
            <option
              v-for="id in ['none', 'rectangle', 'ellipse']"
              :key="id"
              :value="id"
            >
              {{ t(`boards.textBackgrounds.${id}`) }}
            </option>
          </select>
        </template>
      </div>
      <div
        v-show="section === 'arrange'"
        class="paper-context-controls"
        data-context-page="arrange"
      >
        <template v-if="selection">
          <button
            data-save-library
            @click="emit('library')"
          >
            {{ t('boards.library.save') }}
          </button>
          <button
            v-if="canGroup"
            data-context-group-top
            @click="emit('group')"
          >
            {{ t('boards.grouping.group') }}
          </button>
          <button
            v-if="canUngroup"
            data-context-ungroup-top
            @click="emit('ungroup')"
          >
            {{ t('boards.grouping.ungroup') }}
          </button>
          <select
            v-if="(movableCount ?? 0) > 1"
            data-context-arrange
            value=""
            :aria-label="t('boards.toolReview.arrange')"
            @change="arrangeChanged"
          >
            <option
              value=""
              disabled
            >
              {{ t('boards.toolReview.arrange') }}
            </option>
            <option
              v-for="id in [
                'left',
                'center',
                'right',
                'top',
                'middle',
                'bottom',
                'horizontal',
                'vertical',
              ]"
              :key="id"
              :value="id"
            >
              {{ t('boards.toolReview.arrangements.' + id) }}
            </option>
          </select>
          <template v-if="rotatable"
            ><button
              :aria-label="t('boards.rotateLeft')"
              @click="emit('rotate', -Math.PI / 12)"
            >
              ↶ 15°</button
            ><button
              :aria-label="t('boards.rotateRight')"
              @click="emit('rotate', Math.PI / 12)"
            >
              ↷ 15°
            </button></template
          >
          <button
            v-if="textBox"
            data-context-auto-width
            :aria-pressed="autoWidth"
            @click="emit('autoWidth', !autoWidth)"
          >
            {{ t('boards.toolReview.autoWidth') }}
          </button> </template
        ><button
          v-if="selection && editAvailable"
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
      </div>
      <label
        v-if="adjustable"
        class="paper-context-color"
        >{{ t('boards.studio.opacity')
        }}<select
          data-context-opacity
          :value="opacity ?? 1"
          :aria-label="t('boards.studio.opacity')"
          @change="
            emit('brush', { opacity: Number(($event.target as HTMLSelectElement).value) })
          "
        >
          <option
            v-if="![0.25, 0.5, 0.75, 1].includes(opacity ?? 1)"
            :value="opacity"
          >
            {{ Math.round((opacity ?? 1) * 100) }}%
          </option>
          <option
            v-for="value in [0.25, 0.5, 0.75, 1]"
            :key="value"
            :value="value"
          >
            {{ value * 100 }}%
          </option>
        </select></label
      >
    </div>
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
  max-height: 144px;
  overflow: auto;
  background: var(--pe-surface);
  color: var(--pe-ink);
  border-bottom: 1px solid var(--pe-border);
  font-size: 12px;
}
.paper-context-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 30px;
}
.paper-context-heading > [data-context-settings] {
  margin-left: auto;
}
.paper-context-tabs {
  display: flex;
  gap: 2px;
}
.paper-context-tabs button {
  border-color: transparent;
  min-height: 28px;
  padding: 3px 10px;
}
.paper-context-content,
.paper-context-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.paper-context-content {
  width: 100%;
}
.paper-context-controls > .paper-context-color {
  white-space: nowrap;
}
.paper-ink-widths {
  gap: 2px;
}
.paper-ink-widths button {
  padding: 3px;
  width: 32px;
}
.paper-fill-presets {
  padding-left: 8px;
  border-left: 1px solid var(--pe-border);
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
button:disabled {
  opacity: 0.45;
  cursor: default;
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
