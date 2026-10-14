<script setup lang="ts">
import { computed } from 'vue'
import type { BoardElement } from '@/shared/types/board'
import { layoutRichText, plainToRich, richHighlightPaths } from '../lib/rich-text'

const props = defineProps<{ element: BoardElement; fontReady?: number }>()
const layout = computed(() => {
  void props.fontReady
  return layoutRichText(
    props.element,
    props.element.richText ?? plainToRich(props.element.text, props.element)
  )
})
const highlights = computed(() => richHighlightPaths(props.element, layout.value))
</script>

<template>
  <g
    :transform="`translate(${element.x} ${element.y})`"
    pointer-events="none"
  >
    <path
      v-for="(path, index) in highlights"
      :key="index"
      :d="path.d"
      :transform="path.transform"
      :fill="path.fill"
      :opacity="path.opacity"
      stroke="none"
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
        :font-size="run.fontSize"
        :font-weight="run.bold ? 700 : 400"
        :font-style="run.italic ? 'italic' : 'normal'"
        :text-decoration="run.underline ? 'underline' : undefined"
        :fill="run.color"
        :data-handwritten="run.font === 'handwritten' ? 'true' : undefined"
        xml:space="preserve"
        >{{ run.text }}</text
      >
    </g>
  </g>
</template>
