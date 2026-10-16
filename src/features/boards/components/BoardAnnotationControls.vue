<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import BoardColorPresets from './BoardColorPresets.vue'
import { PEN_COLORS, HIGHLIGHT_COLORS } from '../lib/ink-colors'
import type {
  BoardAnnotationSide,
  BoardAnnotationType,
  BoardTextAnnotation,
} from '@/shared/types/board'

const props = defineProps<{ modelValue?: BoardTextAnnotation | null }>()
const emit = defineEmits<{
  'update:modelValue': [BoardTextAnnotation | null]
  replay: []
}>()
const { t } = useI18n()
const types: BoardAnnotationType[] = [
  'underline',
  'box',
  'circle',
  'highlight',
  'strike-through',
  'crossed-off',
  'bracket',
]
const sides: BoardAnnotationSide[] = ['top', 'right', 'bottom', 'left']
const defaults: BoardTextAnnotation = {
  type: 'underline',
  color: '#e07a28',
  strokeWidth: 2,
  padding: 5,
  iterations: 2,
  brackets: ['right'],
  animate: false,
  animationDuration: 800,
  animationDelay: 0,
  multiline: true,
  rtl: false,
}
const value = computed(() => props.modelValue ?? defaults)
const paddingSides = computed(() => {
  const p = value.value.padding
  return typeof p === 'number'
    ? [p, p, p, p]
    : p.length === 2
      ? [p[0], p[1], p[0], p[1]]
      : p
})
function update(patch: Partial<BoardTextAnnotation>) {
  emit('update:modelValue', {
    ...value.value,
    ...patch,
    brackets: [...(patch.brackets ?? value.value.brackets)],
  })
}
function number(event: Event, min: number, max: number) {
  const n = Number((event.target as HTMLInputElement).value)
  return Math.min(max, Math.max(min, Number.isFinite(n) ? n : min))
}
function checked(event: Event) {
  return (event.target as HTMLInputElement).checked
}
function setSide(side: BoardAnnotationSide) {
  const brackets = value.value.brackets.includes(side)
    ? value.value.brackets.filter((s) => s !== side)
    : [...value.value.brackets, side]
  update({ brackets: brackets.length ? brackets : [side] })
}
function setPaddingSide(index: number, event: Event) {
  const padding = [...paddingSides.value] as [number, number, number, number]
  padding[index] = number(event, 0, 24)
  update({ padding })
}
</script>

<template>
  <section
    class="annotation-controls"
    @keydown.stop
  >
    <div class="annotation-heading">
      <strong>{{ t('boards.notation.title') }}</strong
      ><button
        type="button"
        data-annotation="none"
        :aria-pressed="!modelValue"
        @click="emit('update:modelValue', null)"
      >
        {{ t('boards.notation.none') }}
      </button>
    </div>
    <div class="annotation-types">
      <button
        v-for="type in types"
        :key="type"
        type="button"
        :data-annotation="type"
        :aria-pressed="modelValue?.type === type"
        @click="
          update({
            type,
            ...(!modelValue && type === 'highlight' ? { color: '#fde875' } : {}),
          })
        "
      >
        <svg
          viewBox="0 0 64 28"
          aria-hidden="true"
        >
          <path
            v-if="type === 'highlight'"
            d="M9 14 L55 14"
            :stroke="value.color"
            stroke-width="14"
            opacity=".45"
          />
          <text
            x="32"
            y="19"
            text-anchor="middle"
            fill="currentColor"
            font-size="15"
            font-family="cursive"
          >
            Abc
          </text>
          <g
            :stroke="value.color"
            stroke-width="1.7"
            fill="none"
            stroke-linecap="round"
          >
            <path
              v-if="type === 'underline'"
              d="M12 24 Q32 21 53 24 M13 25 L51 23"
            />
            <path
              v-if="type === 'box'"
              d="M8 4 L56 3 L57 25 L7 24 Z"
            />
            <ellipse
              v-if="type === 'circle'"
              cx="32"
              cy="14"
              rx="27"
              ry="12"
              transform="rotate(-3 32 14)"
            />
            <path
              v-if="type === 'strike-through'"
              d="M9 14 L55 13"
            />
            <path
              v-if="type === 'crossed-off'"
              d="M10 4 L55 25 M53 3 L9 25"
            />
            <path
              v-if="type === 'bracket'"
              d="M11 3 L6 3 L7 25 L12 25 M52 3 L58 3 L57 25 L52 25"
            />
          </g>
        </svg>
        <span>{{ t(`boards.notation.types.${type}`) }}</span>
      </button>
    </div>
    <template v-if="modelValue">
      <BoardColorPresets
        :colors="value.type === 'highlight' ? HIGHLIGHT_COLORS : PEN_COLORS"
        :value="value.color"
        :label="t('boards.notation.color')"
        @choose="update({ color: $event })"
      />
      <div class="annotation-fields">
        <label
          >{{ t('boards.notation.color')
          }}<input
            data-setting="color"
            type="color"
            :value="value.color"
            @input="update({ color: ($event.target as HTMLInputElement).value })"
        /></label>
        <label
          >{{ t('boards.notation.width')
          }}<input
            data-setting="strokeWidth"
            type="number"
            min="0.5"
            max="8"
            step="0.5"
            :value="value.strokeWidth"
            @change="update({ strokeWidth: number($event, 0.5, 8) })"
        /></label>
        <label
          >{{ t('boards.notation.padding')
          }}<input
            data-setting="padding"
            type="number"
            min="0"
            max="24"
            :value="paddingSides[0]"
            @change="update({ padding: number($event, 0, 24) })"
        /></label>
      </div>
      <fieldset v-if="value.type === 'bracket'">
        <legend>{{ t('boards.notation.sides') }}</legend>
        <div class="annotation-sides">
          <button
            v-for="side in sides"
            :key="side"
            type="button"
            :data-side="side"
            :aria-pressed="value.brackets.includes(side)"
            @click="setSide(side)"
          >
            {{ t(`boards.notation.${side}`) }}
          </button>
        </div>
      </fieldset>
      <details>
        <summary>{{ t('boards.notation.advanced') }}</summary>
        <div class="annotation-fields annotation-padding">
          <label
            v-for="(side, index) in sides"
            :key="side"
            >{{ t(`boards.notation.${side}`)
            }}<input
              :data-padding-side="side"
              type="number"
              min="0"
              max="24"
              :value="paddingSides[index]"
              @change="setPaddingSide(index, $event)"
          /></label>
        </div>
        <label class="annotation-inline"
          >{{ t('boards.notation.iterations')
          }}<input
            data-setting="iterations"
            type="number"
            min="1"
            max="4"
            :value="value.iterations"
            @change="update({ iterations: Math.round(number($event, 1, 4)) })"
        /></label>
        <label class="annotation-check"
          ><input
            data-setting="multiline"
            type="checkbox"
            :checked="value.multiline"
            @change="update({ multiline: checked($event) })"
          />{{ t('boards.notation.multiline') }}</label
        >
        <label class="annotation-check"
          ><input
            data-setting="rtl"
            type="checkbox"
            :checked="value.rtl"
            @change="update({ rtl: checked($event) })"
          />{{ t('boards.notation.rtl') }}</label
        >
        <label class="annotation-check"
          ><input
            data-setting="animate"
            type="checkbox"
            :checked="value.animate"
            @change="update({ animate: checked($event) })"
          />{{ t('boards.notation.animate') }}</label
        >
        <div
          v-if="value.animate"
          class="annotation-fields animation-fields"
        >
          <label
            >{{ t('boards.notation.duration')
            }}<input
              data-setting="animationDuration"
              type="number"
              min="100"
              max="5000"
              step="100"
              :value="value.animationDuration"
              @change="update({ animationDuration: number($event, 100, 5000) })" /></label
          ><label
            >{{ t('boards.notation.delay')
            }}<input
              data-setting="animationDelay"
              type="number"
              min="0"
              max="5000"
              step="100"
              :value="value.animationDelay"
              @change="update({ animationDelay: number($event, 0, 5000) })"
          /></label>
        </div>
      </details>
      <button
        v-if="value.animate"
        class="annotation-replay"
        type="button"
        @click="emit('replay')"
      >
        {{ t('boards.notation.replay') }}
      </button>
    </template>
  </section>
</template>

<style scoped>
.annotation-controls {
  display: grid;
  gap: 10px;
  color: inherit;
  font-size: 12px;
}
.annotation-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
button {
  cursor: pointer;
  border: 1px solid var(--color-border, #d9dee6);
  border-radius: 7px;
  padding: 6px 8px;
  background: var(--color-surface, #fff);
  color: inherit;
}
button[aria-pressed='true'] {
  border-color: #bf6b26;
  background: #e07a2818;
}
.annotation-types {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
}
.annotation-types button {
  display: grid;
  justify-items: center;
  gap: 3px;
  min-height: 58px;
  padding: 5px 3px;
  line-height: 1.2;
}
.annotation-types svg {
  width: 64px;
  max-width: 100%;
  height: 28px;
}
.annotation-fields {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.annotation-fields label {
  display: grid;
  gap: 4px;
  min-width: 0;
}
input[type='number'] {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--color-border, #d9dee6);
  border-radius: 6px;
  padding: 5px;
  background: var(--color-surface, #fff);
  color: inherit;
}
input[type='color'] {
  width: 100%;
  height: 30px;
  border: 1px solid var(--color-border, #d9dee6);
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
}
fieldset {
  border: 0;
  padding: 0;
  margin: 0;
}
legend {
  margin-bottom: 5px;
}
.annotation-sides {
  display: flex;
  gap: 5px;
  flex-wrap: wrap;
}
summary {
  cursor: pointer;
  padding: 6px 0;
}
.annotation-padding {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin: 5px 0 10px;
}
.annotation-inline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.annotation-inline input {
  width: 62px;
}
.annotation-check {
  display: flex;
  gap: 7px;
  align-items: center;
  margin-top: 9px;
}
.annotation-check input {
  accent-color: #bf6b26;
}
.animation-fields {
  grid-template-columns: repeat(2, minmax(0, 1fr));
  margin-top: 10px;
}
.annotation-replay {
  justify-self: start;
}
button:focus-visible,
input:focus-visible,
summary:focus-visible {
  outline: 2px solid #bf6b26;
  outline-offset: 2px;
}
</style>
