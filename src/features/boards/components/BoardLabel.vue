<script setup lang="ts">
import { computed, useId } from 'vue'
import type { BoardElement, PaperColorScheme } from '@/shared/types/board'
import { boardInkColor, labelHighlightPaths, labelLayout } from '../lib/label'
import { paperTextInk } from '../lib/background'
import { safeAnnotation } from '../lib/notation'
import BoardNotation from './BoardNotation.vue'

const props = defineProps<{
  element: BoardElement
  label: string
  fontReady?: number
  colorScheme?: PaperColorScheme
  replay?: number
  groupDelay?: number
}>()
const clipId = `board-label-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
const layout = computed(() => {
  // A loaded font changes measurement even though the element itself is unchanged.
  void props.fontReady
  return labelLayout(props.element, props.label)
})
const highlights = computed(() => labelHighlightPaths(props.element, layout.value))
const textInk = computed(() => {
  const highlighted =
    (props.element.textHighlight && props.element.textHighlight !== 'none') ||
    props.element.textAnnotation?.type === 'highlight'
  return paperTextInk(
    boardInkColor(props.element),
    highlighted ? 'light' : props.colorScheme,
    highlighted ? undefined : (props.element.fillColor ?? undefined)
  )
})
const annotation = computed(() => {
  const config = safeAnnotation(props.element.textAnnotation)
  return config
    ? {
        config,
        seed: `${props.element.id}:whole`,
        rects: layout.value.lines
          .filter((line) => line.text.trim())
          .map((line) => ({
            x: line.x,
            y: line.y - layout.value.fontSize * 0.8,
            width: line.width,
            height: layout.value.fontSize,
          })),
      }
    : null
})
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
      <BoardNotation
        v-if="annotation?.config.type === 'highlight'"
        :shape="annotation"
        :replay="replay"
        :group-delay="groupDelay"
      />
      <path
        v-for="(path, index) in highlights"
        :key="index"
        :d="path.d"
        :transform="path.transform"
        :fill="path.fill"
        :opacity="path.opacity"
        :stroke="path.stroke"
        :stroke-width="path.strokeWidth"
      />
      <text
        :data-handwritten="element.textFont === 'handwritten' ? 'true' : undefined"
        :font-family="layout.fontFamily"
        :font-size="layout.fontSize"
        :fill="textInk"
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
      <BoardNotation
        v-if="annotation && annotation.config.type !== 'highlight'"
        :shape="annotation"
        :replay="replay"
        :group-delay="groupDelay"
      />
    </g>
  </g>
</template>
