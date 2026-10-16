<script setup lang="ts">
import { computed, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { notationPaths, type AnnotationShape } from '../lib/notation'
const props = defineProps<{
  shape: AnnotationShape
  replay?: number
  groupDelay?: number
  animateOnReplay?: boolean
  previewOnly?: boolean
}>()
const root = ref<SVGGElement>()
const paths = computed(() => notationPaths(props.shape))
let animations: Animation[] = []
let generation = 0
function cancel() {
  generation++
  animations.forEach((animation) => animation.cancel())
  animations = []
  root.value
    ?.querySelectorAll('path')
    .forEach((path) => path.style.removeProperty('stroke-dasharray'))
}
async function play(replay = false) {
  cancel()
  const current = generation
  await nextTick()
  if (
    current !== generation ||
    (props.previewOnly && !replay) ||
    (!props.shape.config.animate && !(replay && props.animateOnReplay)) ||
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  )
    return
  const nodes = [...(root.value?.querySelectorAll('path') ?? [])]
  const lengths = nodes.map((path) =>
    typeof path.getTotalLength === 'function' ? path.getTotalLength() : 0
  )
  const total = lengths.reduce((a, b) => a + b, 0)
  let delay = (props.groupDelay ?? 0) + props.shape.config.animationDelay
  for (const [index, path] of nodes.entries()) {
    const length = lengths[index]!
    if (!length || typeof path.animate !== 'function') continue
    const duration = (props.shape.config.animationDuration * length) / total
    path.style.strokeDasharray = String(length)
    const animation = path.animate(
      [{ strokeDashoffset: String(length) }, { strokeDashoffset: '0' }],
      { duration, delay, easing: 'ease-out', fill: 'both' }
    )
    animations.push(animation)
    animation.onfinish = () => {
      path.style.removeProperty('stroke-dasharray')
      animation.cancel()
    }
    delay += duration
  }
}
watch(paths, () => void play(), { immediate: true, flush: 'post' })
watch(
  () => props.replay,
  () => void play(true),
  { flush: 'post' }
)
onBeforeUnmount(cancel)
</script>
<template>
  <g
    ref="root"
    :data-notation="shape.config.type"
    pointer-events="none"
  >
    <path
      v-for="(path, index) in paths"
      :key="index"
      :d="path.d"
      fill="none"
      :stroke="path.stroke"
      :stroke-width="path.strokeWidth"
      :opacity="path.opacity"
    />
  </g>
</template>
