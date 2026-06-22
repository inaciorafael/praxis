<script setup lang="ts">
import { pickTagColorByName } from "@/shared/lib/tags/tag-color";
import { Tag } from "@/shared/types/tag";

const props = defineProps<Tag>();

const tagStyle = pickTagColorByName(props.name);
</script>

<template>
  <div :style="{ backgroundColor: tagStyle.background, color: tagStyle.text }" class="px-3 rounded-full">
    <span>+{{ name }}</span>
  </div>
</template>
