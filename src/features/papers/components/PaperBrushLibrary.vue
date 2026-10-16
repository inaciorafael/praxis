<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { BoardDrawBrush } from '@/shared/types/board'
defineProps<{ modelValue?: BoardDrawBrush | null; baseTool?: 'draw' | 'pen' }>()
const emit = defineEmits<{
  'update:modelValue': [BoardDrawBrush | null]
  base: ['draw' | 'pen']
}>()
const { t } = useI18n()
const groups: { name: string; tools: ('draw' | 'pen' | BoardDrawBrush)[] }[] = [
  { name: 'pencils', tools: ['draw', 'graphite'] },
  { name: 'pens', tools: ['pen', 'fountain', 'ink'] },
]
const basic = (tool: string) => tool === 'draw' || tool === 'pen'
function choose(tool: 'draw' | 'pen' | BoardDrawBrush) {
  if (tool === 'draw' || tool === 'pen') emit('base', tool)
  else emit('update:modelValue', tool)
}
// Samples identify writing tools; the canvas renders the actual material.
const curve = 'M5 22 C20 4 29 29 43 14 S65 15 75 6'
</script>
<template>
  <section
    class="paper-brush-library"
    :aria-label="t('boards.brushes.title')"
    @keydown.stop
  >
    <fieldset
      v-for="group in groups"
      :key="group.name"
      class="paper-brush-options"
    >
      <legend>{{ t(`boards.brushes.${group.name}`) }}</legend>
      <button
        v-for="brush in group.tools"
        :key="brush"
        type="button"
        class="paper-brush-option"
        :data-paper-brush="basic(brush) ? undefined : brush"
        :data-base-tool="basic(brush) ? brush : undefined"
        :aria-pressed="
          basic(brush) ? !modelValue && baseTool === brush : modelValue === brush
        "
        @click="choose(brush)"
      >
        <svg
          viewBox="0 0 80 30"
          aria-hidden="true"
          class="paper-brush-icon"
        >
          <g
            fill="none"
            stroke="currentColor"
            stroke-linecap="round"
          >
            <template v-if="brush === 'graphite' || brush === 'draw'">
              <path
                :d="curve"
                stroke-width=".9"
                opacity=".72"
              />
              <path
                v-if="brush === 'graphite'"
                :d="curve"
                transform="translate(0 .6)"
                stroke-width=".35"
                opacity=".3"
                stroke-dasharray="2 1"
              />
            </template>
            <path
              v-else-if="brush === 'ink' || brush === 'pen'"
              :d="curve"
              stroke-width="1.6"
            />
            <path
              v-else
              d="M5 22 C20 4 29 29 43 14 S65 15 75 6 C64 20 57 10 44 16 S28 12 22 13 S11 20 5 22 Z"
              fill="currentColor"
              stroke-width=".7"
            />
          </g>
        </svg>
        <span class="paper-brush-copy"
          ><strong>{{
            t(basic(brush) ? `boards.tools.${brush}` : `boards.brushes.types.${brush}`)
          }}</strong
          ><span>{{ t(`boards.brushes.descriptions.${brush}`) }}</span></span
        >
      </button>
    </fieldset>
    <p class="paper-brush-hint">{{ t('boards.brushes.pressureHint') }}</p>
  </section>
</template>
<style scoped>
.paper-brush-library {
  width: 300px;
  max-width: 100%;
  display: grid;
  gap: 10px;
  color: inherit;
  font-size: 12px;
}
.paper-brush-heading {
  font-size: 13px;
}
.paper-brush-options {
  display: grid;
  gap: 5px;
  border: 0;
  padding: 0;
  margin: 0;
  min-width: 0;
}
.paper-brush-options legend {
  padding: 4px 0 6px;
  font-weight: 600;
  color: var(--ink-muted);
}
button {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 48px;
  text-align: left;
  color: inherit;
  background: var(--color-surface, #fff);
  border: 1px solid var(--color-border, #d9dee6);
  border-radius: 4px;
  padding: 7px;
  cursor: pointer;
}
button[aria-pressed='true'] {
  background: #e07a2814;
  border-color: #bf6b26;
}
button:focus-visible {
  outline: 2px solid #bf6b26;
  outline-offset: 2px;
}
.paper-brush-icon {
  width: 76px;
  height: 30px;
  flex: 0 0 76px;
}
.paper-brush-copy {
  display: grid;
  gap: 3px;
  line-height: 1.35;
}
.paper-brush-copy > span {
  opacity: 0.7;
}
.paper-brush-hint {
  margin: 0;
  opacity: 0.7;
  line-height: 1.45;
}
</style>
