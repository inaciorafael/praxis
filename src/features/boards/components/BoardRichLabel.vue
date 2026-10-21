<script setup lang="ts">
import { computed, useId } from 'vue'
import type { BoardElement, PaperColorScheme } from '@/shared/types/board'
import { paperTextInk } from '../lib/background'
import {
  layoutRichText,
  plainToRich,
  richHighlightPaths,
  richAnnotationShapes,
} from '../lib/rich-text'
import BoardNotation from './BoardNotation.vue'

const props = defineProps<{
  element: BoardElement
  fontReady?: number
  colorScheme?: PaperColorScheme
  replay?: number
  groupDelay?: number
}>()
const clipId = `board-rich-label-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`
const layout = computed(() => {
  void props.fontReady
  return layoutRichText(
    props.element,
    props.element.richText ?? plainToRich(props.element.text, props.element)
  )
})
const highlights = computed(() => richHighlightPaths(props.element, layout.value))
const annotations = computed(() => {
  let delay = props.groupDelay ?? 0
  return richAnnotationShapes(props.element, layout.value).map((shape) => {
    const groupDelay = delay
    if (shape.config.animate)
      delay += shape.config.animationDelay + shape.config.animationDuration
    return { shape, groupDelay }
  })
})
</script>

<template>
  <g
    :transform="`translate(${element.x} ${element.y})`"
    pointer-events="none"
  >
    <defs
      ><clipPath :id="clipId"
        ><rect
          x="0"
          y="0"
          :width="element.width"
          :height="element.height" /></clipPath
    ></defs>
    <g :clip-path="element.kind === 'text' ? undefined : `url(#${clipId})`">
      <BoardNotation
        v-for="item in annotations.filter(
          (item) => item.shape.config.type === 'highlight'
        )"
        :key="item.shape.seed"
        :shape="item.shape"
        :replay="replay"
        :group-delay="item.groupDelay"
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
      <g
        v-for="(line, index) in layout.lines"
        :key="index"
      >
        <text
          v-for="(run, runIndex) in line.runs"
          :key="runIndex"
          :x="run.x"
          :y="run.y"
          :font-family="run.fontFamily"
          style="font-synthesis: style"
          :font-size="run.fontSize"
          :font-weight="run.bold ? 700 : 400"
          :font-style="run.italic ? 'italic' : 'normal'"
          :text-decoration="run.underline ? 'underline' : undefined"
          :fill="
            run.highlight !== 'none' ||
            run.annotation?.type === 'highlight' ||
            element.textAnnotation?.type === 'highlight'
              ? run.color
              : paperTextInk(run.color, colorScheme, element.fillColor ?? undefined)
          "
          :data-handwritten="run.font === 'handwritten' ? 'true' : undefined"
          xml:space="preserve"
          >{{ run.text }}</text
        >
      </g>
      <BoardNotation
        v-for="item in annotations.filter(
          (item) => item.shape.config.type !== 'highlight'
        )"
        :key="item.shape.seed"
        :shape="item.shape"
        :replay="replay"
        :group-delay="item.groupDelay"
      />
    </g>
  </g>
</template>
