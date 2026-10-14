<script setup lang="ts">
import { computed, useId } from 'vue'
import type { BoardElement } from '@/shared/types/board'
import { boardInkColor, labelHighlightPaths, labelLayout } from '../lib/label'

const props = defineProps<{ element: BoardElement; label: string; fontReady?: number }>()
const clipId = `board-label-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
const layout = computed(() => {
  // A loaded font changes measurement even though the element itself is unchanged.
  void props.fontReady
  return labelLayout(props.element, props.label)
})
const highlights = computed(() => labelHighlightPaths(props.element, layout.value))
</script>

<template>
  <g
    :transform="`translate(${element.x} ${element.y})`"
    pointer-events="none"
  >
    <defs>
      <clipPath :id="clipId">
        <rect
          x="0"
          y="0"
          :width="Math.max(0, element.width)"
          :height="Math.max(0, element.height)"
        />
      </clipPath>
    </defs>
    <g :clip-path="element.kind === 'text' ? undefined : `url(#${clipId})`">
      <path
        v-for="(path, index) in highlights"
        :key="index"
        :d="path.d"
        :transform="path.transform"
        :fill="path.fill"
        :opacity="path.opacity"
        stroke="none"
      />
      <text
        :data-handwritten="element.textFont === 'handwritten' ? 'true' : undefined"
        :font-family="layout.fontFamily"
        :font-size="layout.fontSize"
        :fill="boardInkColor(element)"
        xml:space="preserve"
      >
        <tspan
          v-for="(line, index) in layout.lines"
          :key="index"
          :x="line.x"
          :y="line.y"
          >{{ line.text }}</tspan
        >
      </text>
    </g>
  </g>
</template>
