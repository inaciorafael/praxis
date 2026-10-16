<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { BoardSketchOptions, BoardStrokeStyle } from '@/shared/types/board'
import { DEFAULT_SKETCH_OPTIONS } from '../lib/sketch-options'
withDefaults(
  defineProps<{
    modelValue?: BoardSketchOptions | null
    strokeStyle?: BoardStrokeStyle
    fill: boolean
  }>(),
  { strokeStyle: 'clean' }
)
const emit = defineEmits<{
  change: [patch: Partial<BoardSketchOptions>]
  style: [style: BoardStrokeStyle]
}>()
const { t } = useI18n()
const patterns = ['solid', 'dashed', 'dotted'] as const
const materials = ['clean', 'pen', 'pencil'] as const
function numeric(key: keyof Omit<BoardSketchOptions, 'strokePattern'>, event: Event) {
  const value = (event.target as HTMLInputElement).valueAsNumber
  if (Number.isFinite(value)) emit('change', { [key]: value })
}
</script>
<template>
  <section
    class="sketch-controls"
    :aria-label="t('boards.sketch.title')"
    @pointerdown.stop
  >
    <strong>{{ t('boards.sketch.title') }}</strong>
    <div class="choices">
      <button
        v-for="material in materials"
        :key="material"
        :data-sketch-material="material"
        :aria-pressed="strokeStyle === material"
        @click="emit('style', material)"
      >
        {{ t(`boards.strokeStyles.${material}`) }}
      </button>
    </div>
    <div
      class="choices"
      :aria-label="t('boards.sketch.border')"
      role="group"
    >
      <button
        v-for="pattern in patterns"
        :key="pattern"
        :data-stroke-pattern="pattern"
        :aria-pressed="(modelValue ?? DEFAULT_SKETCH_OPTIONS).strokePattern === pattern"
        @click="emit('change', { strokePattern: pattern })"
      >
        <svg
          viewBox="0 0 56 12"
          aria-hidden="true"
        >
          <path
            d="M4 6H52"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            :stroke-dasharray="
              pattern === 'dashed' ? '8 6' : pattern === 'dotted' ? '0 6' : undefined
            "
          />
        </svg>
        {{ t(`boards.sketch.${pattern}`) }}
      </button>
    </div>
    <template v-if="strokeStyle !== 'clean'">
      <label
        >{{ t('boards.sketch.roughness')
        }}<input
          data-sketch-roughness
          type="range"
          min="0"
          max="2"
          step="0.25"
          :value="(modelValue ?? DEFAULT_SKETCH_OPTIONS).roughness"
          @change="numeric('roughness', $event)"
      /></label>
      <label
        >{{ t('boards.sketch.bowing')
        }}<input
          data-sketch-bowing
          type="range"
          min="0"
          max="2"
          step="0.25"
          :value="(modelValue ?? DEFAULT_SKETCH_OPTIONS).bowing"
          @change="numeric('bowing', $event)"
      /></label>
    </template>
    <details v-if="fill">
      <summary>{{ t('boards.sketch.hatching') }}</summary>
      <label
        >{{ t('boards.sketch.angle')
        }}<output>{{ (modelValue ?? DEFAULT_SKETCH_OPTIONS).hachureAngle }}°</output>
        <input
          data-hatch-angle
          type="range"
          min="-90"
          max="90"
          step="1"
          :value="(modelValue ?? DEFAULT_SKETCH_OPTIONS).hachureAngle"
          @change="numeric('hachureAngle', $event)"
      /></label>
      <label
        >{{ t('boards.sketch.spacing')
        }}<output>{{ (modelValue ?? DEFAULT_SKETCH_OPTIONS).hachureGap }} px</output>
        <input
          data-hatch-gap
          type="range"
          min="5"
          max="24"
          step="1"
          :value="(modelValue ?? DEFAULT_SKETCH_OPTIONS).hachureGap"
          @change="numeric('hachureGap', $event)"
      /></label>
    </details>
  </section>
</template>
<style scoped>
.sketch-controls {
  display: grid;
  gap: 10px;
  border-bottom: 1px solid var(--border);
  padding-bottom: 12px;
  margin-bottom: 10px;
}
.choices {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 4px;
}
button {
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 2px;
  background: var(--surface);
  color: var(--ink);
  font-size: 11px;
  cursor: pointer;
}
button:hover,
button[aria-pressed='true'] {
  background: var(--hover);
  border-color: var(--ink);
}
svg {
  display: block;
  width: 100%;
  height: 16px;
}
label {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px;
  margin-top: 6px;
}
input {
  width: 100%;
  accent-color: var(--ink);
}
summary {
  cursor: pointer;
  padding: 4px 0;
}
output {
  font-variant-numeric: tabular-nums;
}
</style>
