<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import type { PostitMode } from '@/shared/types/postit'
defineProps<{ mode: PostitMode; locked?: boolean; disabled?: boolean }>()
const emit = defineEmits<{ mode: [mode: PostitMode]; lock: [locked: boolean] }>()
const modes: PostitMode[] = ['micro', 'compact', 'expanded']
const { t } = useI18n()
</script>
<template>
  <div class="postit-modes">
    <select
      :value="mode"
      :disabled="disabled"
      :aria-label="t('postits.adaptive.mode')"
      @change="emit('mode', ($event.target as HTMLSelectElement).value as PostitMode)"
    >
      <option
        v-for="value in modes"
        :key="value"
        :value="value"
      >
        {{ t('postits.adaptive.' + value) }}
      </option>
    </select>
    <label
      ><input
        type="checkbox"
        :checked="locked"
        :disabled="disabled"
        @change="emit('lock', ($event.target as HTMLInputElement).checked)"
      />{{ t('postits.adaptive.keepMode') }}</label
    >
  </div>
</template>
<style scoped>
.postit-modes {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  font:
    12px/1.4 system-ui,
    sans-serif;
}
select {
  border: 1px solid #38382b40;
  background: transparent;
  color: inherit;
  font: inherit;
  padding: 3px;
  min-height: 28px;
  max-width: 100%;
}
label {
  display: flex;
  align-items: center;
  gap: 3px;
}
input {
  accent-color: #51492e;
}
:focus-visible {
  outline: 2px solid currentColor;
  outline-offset: 2px;
}
</style>
