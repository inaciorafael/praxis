<script setup lang="ts">
import { Task } from '@/shared/types/task';
import { useTagStore } from '@/stores/tag.store';
import { Check } from '@lucide/vue';

const props = defineProps<Task>()

const tags = useTagStore();

</script>

<template>
  <div :class="[
    `p-3 border-l-5 hover:bg-hover transition-all border-sage flex flex-col`
  ]">
    <div class="flex cursor-pointer flex-row gap-3 items-center">
      <div :class="[
          'border w-8 h-8 flex items-center justify-center rounded-xl',
          { 'bg-sage text-paper': true }
        ]">
        <Check :size="18" />
      </div>
      <span class="text-title">{{ props.title }}</span>
      {{ JSON.stringify(tags.tagsByTask[id]) }}
    </div>

    <span v-if="props.notes">{{ props.notes }}</span>
  </div>
</template>
