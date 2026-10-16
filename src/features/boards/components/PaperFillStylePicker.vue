<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { BoardFillStyle } from '@/shared/types/board'
defineProps<{ modelValue?: BoardFillStyle }>()
const emit = defineEmits<{ 'update:modelValue': [BoardFillStyle] }>()
const { t } = useI18n()
const styles: BoardFillStyle[] = ['solid', 'hachure', 'cross-hatch', 'zigzag']
</script>
<template>
  <div
    class="paper-fill-styles"
    role="group"
    :aria-label="t('boards.fillStyles.title')"
  >
    <button
      v-for="style in styles"
      :key="style"
      type="button"
      :data-fill-style="style"
      :aria-pressed="modelValue === style"
      :title="t(`boards.fillStyles.${style}`)"
      @click="emit('update:modelValue', style)"
    >
      <svg
        viewBox="0 0 32 24"
        aria-hidden="true"
      >
        <rect
          v-if="style === 'solid'"
          x="3"
          y="3"
          width="26"
          height="18"
          fill="currentColor"
          opacity=".6"
        />
        <path
          v-else-if="style === 'zigzag'"
          d="M3 6 L8 3 L13 6 L18 3 L23 6 L28 3 M3 13 L8 10 L13 13 L18 10 L23 13 L28 10 M3 20 L8 17 L13 20 L18 17 L23 20 L28 17"
          fill="none"
          stroke="currentColor"
        />
        <g
          v-else
          fill="none"
          stroke="currentColor"
        >
          <path d="M3 11 L11 3 M3 20 L20 3 M11 21 L29 3 M21 21 L29 13" />
          <path
            v-if="style === 'cross-hatch'"
            d="M3 13 L11 21 M3 3 L21 21 M13 3 L29 19 M23 3 L29 9"
          />
        </g>
      </svg>
      <span>{{ t(`boards.fillStyles.${style}`) }}</span>
    </button>
  </div>
</template>
<style scoped>
.paper-fill-styles {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 5px;
  margin: 6px 0;
}
button {
  display: grid;
  justify-items: center;
  gap: 2px;
  padding: 5px 3px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--ink);
  cursor: pointer;
  font-size: 10px;
}
button[aria-pressed='true'] {
  background: var(--hover);
  border-color: currentColor;
  box-shadow: inset 0 0 0 1px currentColor;
}
svg {
  width: 32px;
  height: 24px;
}
</style>
