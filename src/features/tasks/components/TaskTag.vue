<script setup lang="ts">
import { resolveTagColor } from '@/shared/lib/tags/tag-color'
import type { Tag } from '@/shared/types/tag'
import { computed } from 'vue'

const props = defineProps<Tag>()

const tagStyle = computed(() => resolveTagColor(props.color, props.name))
</script>

<template>
  <div
    :style="{ backgroundColor: tagStyle.background, color: tagStyle.text }"
    class="rounded-full px-3"
  >
    <span>+{{ name }}</span>
  </div>
</template>
