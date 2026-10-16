<script setup lang="ts">
import { Sun, Moon, X } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import type {
  PaperAppearance,
  PaperBackground,
  PaperColorScheme,
} from '@/shared/types/board'
import { paperBackgroundStyle } from '@/features/boards/lib/background'

const props = withDefaults(
  defineProps<{ background?: PaperBackground; colorScheme?: PaperColorScheme }>(),
  { background: 'plain', colorScheme: 'light' }
)
const emit = defineEmits<{ change: [appearance: PaperAppearance]; close: [] }>()
const { t } = useI18n()
const backgrounds: PaperBackground[] = ['plain', 'grid', 'ruled', 'dots']
function change(patch: Partial<PaperAppearance>) {
  emit('change', {
    background: props.background,
    colorScheme: props.colorScheme,
    ...patch,
  })
}
</script>

<template>
  <div
    class="paper-background-controls"
    @pointerdown.stop
    @wheel.stop
    @keydown.esc.stop.prevent="emit('close')"
  >
    <div class="flex items-center justify-between gap-2">
      <strong>{{ t('papers.background.title') }}</strong
      ><button
        class="paper-background-close"
        type="button"
        :aria-label="t('common.close')"
        @click="emit('close')"
      >
        <X :size="16" />
      </button>
    </div>
    <div
      class="paper-background-schemes"
      role="group"
      :aria-label="t('papers.background.appearance')"
    >
      <button
        v-for="scheme in ['light', 'dark'] as const"
        :key="scheme"
        type="button"
        :data-paper-scheme="scheme"
        :aria-pressed="colorScheme === scheme"
        @click="change({ colorScheme: scheme })"
      >
        <component
          :is="scheme === 'light' ? Sun : Moon"
          :size="16"
        />{{ t(`papers.background.${scheme}`) }}
      </button>
    </div>
    <div
      class="paper-background-options"
      role="group"
      :aria-label="t('papers.background.pattern')"
    >
      <button
        v-for="pattern in backgrounds"
        :key="pattern"
        type="button"
        :data-paper-background="pattern"
        :aria-pressed="background === pattern"
        @click="change({ background: pattern })"
      >
        <span
          class="paper-background-thumbnail"
          :style="paperBackgroundStyle(pattern, colorScheme)"
          aria-hidden="true"
        />{{ t(`papers.background.${pattern}`) }}
      </button>
    </div>
    <p>{{ t('papers.background.savedPerPaper') }}</p>
  </div>
</template>

<style scoped>
.paper-background-controls {
  width: 260px;
  max-width: calc(100vw - 24px);
  display: grid;
  gap: 14px;
  padding: 16px;
  color: #33312c;
  background: #fff;
  border: 1px solid #e5e0d5;
  border-radius: 12px;
  box-shadow: 0 6px 24px #30271918;
  font-size: 12px;
}
.paper-background-controls button {
  border: 1px solid #e5e0d5;
  border-radius: 8px;
  background: #fff;
  color: #33312c;
  cursor: pointer;
  font: inherit;
  min-height: 38px;
}
.paper-background-controls button:hover {
  background: #f5f1e8;
}
.paper-background-controls button:focus-visible {
  outline: 2px solid #b57e29;
  outline-offset: 2px;
}
.paper-background-controls button[aria-pressed='true'] {
  border-color: #b57e29;
  background: #f5e6c8;
}
.paper-background-controls .paper-background-close {
  display: grid;
  place-items: center;
  min-height: 32px;
  width: 32px;
  border: 0;
}
.paper-background-schemes,
.paper-background-options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.paper-background-schemes button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.paper-background-options button {
  display: grid;
  gap: 8px;
  padding: 8px;
}
.paper-background-thumbnail {
  display: block;
  height: 58px;
  border: 1px solid #c9ced5;
  border-radius: 5px;
}
.paper-background-controls p {
  color: #8c877b;
  font-size: 11px;
  line-height: 1.5;
}
</style>
