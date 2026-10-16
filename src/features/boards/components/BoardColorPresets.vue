<script setup lang="ts">
import { useI18n } from 'vue-i18n'
defineProps<{
  colors: readonly { id: string; color: string }[]
  value?: string
  label: string
}>()
const emit = defineEmits<{ choose: [color: string] }>()
const { t } = useI18n()
</script>
<template>
  <div
    class="paper-color-presets"
    role="group"
    :aria-label="label"
  >
    <button
      v-for="item in colors"
      :key="item.color"
      type="button"
      :data-color-preset="item.color"
      :style="{ '--ink-swatch': item.color }"
      :aria-label="t(`boards.inkColors.${item.id}`)"
      :title="t(`boards.inkColors.${item.id}`)"
      :aria-pressed="value?.toLowerCase() === item.color"
      @mousedown.prevent
      @click="emit('choose', item.color)"
    >
      <span aria-hidden="true" />
    </button>
  </div>
</template>
<style scoped>
.paper-color-presets {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.paper-color-presets button {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  padding: 4px;
  border: 1px solid var(--border, #d9dee6);
  border-radius: 4px;
  background: var(--paper, white);
  cursor: pointer;
}
.paper-color-presets button span {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: var(--ink-swatch);
  border: 1px solid #0002;
}
.paper-color-presets button[aria-pressed='true'] {
  outline: 2px solid var(--ink, #263238);
  outline-offset: 1px;
}
.paper-color-presets button:focus-visible {
  outline: 2px solid var(--ink, #263238);
  outline-offset: 2px;
}
</style>
