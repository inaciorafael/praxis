<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from 'vue'

const props = defineProps<{ surface: HTMLElement | null | undefined }>()
type Point = { x: number; y: number }
type Segment = { id: number; from: Point; to: Point; time: number; opacity: number }
const head = ref<Point | null>(null)
const segments = ref<Segment[]>([])
const lifetime = 1100
const maxSegments = 256
let sequence = 0
let frame = 0
let pointerId: number | null = null
let previous: Point | null = null

function position(event: PointerEvent, surface: HTMLElement): Point {
  const bounds = surface.getBoundingClientRect()
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
}
function fade() {
  frame = 0
  const now = performance.now()
  segments.value = segments.value.filter((segment) => now - segment.time < lifetime)
  for (const segment of segments.value) {
    // Each part ages separately, so the oldest end disappears first.
    segment.opacity = Math.pow(1 - (now - segment.time) / lifetime, 1.5)
  }
  if (segments.value.length) frame = requestAnimationFrame(fade)
}
function append(from: Point, to: Point) {
  segments.value.push({ id: sequence++, from, to, time: performance.now(), opacity: 1 })
  if (segments.value.length > maxSegments)
    segments.value.splice(0, segments.value.length - maxSegments)
  if (!frame) frame = requestAnimationFrame(fade)
}

const stopWatching = watch(
  () => props.surface,
  (surface, _, onCleanup) => {
    if (!surface) return
    function overControls(event: PointerEvent) {
      return (
        event.target instanceof Element &&
        !!event.target.closest('.paper-presentation-controls')
      )
    }
    function down(event: PointerEvent) {
      if (event.button !== 0 || pointerId !== null || overControls(event)) return
      pointerId = event.pointerId
      head.value = previous = position(event, surface!)
      append(previous, previous)
      surface!.setPointerCapture?.(event.pointerId)
    }
    function move(event: PointerEvent) {
      if (overControls(event) && pointerId === null) {
        head.value = null
        return
      }
      if (pointerId !== null && pointerId !== event.pointerId) return
      const samples = pointerId === event.pointerId ? event.getCoalescedEvents?.() : []
      for (const sample of samples?.length ? samples : [event]) {
        const current = position(sample, surface!)
        head.value = current
        if (pointerId === event.pointerId && previous) {
          const distance = Math.hypot(current.x - previous.x, current.y - previous.y)
          if (distance >= 1) {
            append(previous, current)
            previous = current
          }
        }
      }
    }
    function end(event: PointerEvent) {
      if (event.pointerId !== pointerId) return
      if (event.type === 'pointerup') move(event)
      pointerId = null
      previous = null
      if (surface!.hasPointerCapture?.(event.pointerId))
        surface!.releasePointerCapture(event.pointerId)
      if (event.type !== 'pointerup' || event.pointerType === 'touch') head.value = null
    }
    function leave() {
      head.value = null
    }
    function blur() {
      const captured = pointerId
      pointerId = null
      previous = null
      head.value = null
      if (captured !== null && surface!.hasPointerCapture?.(captured))
        surface!.releasePointerCapture(captured)
    }
    surface.addEventListener('pointerdown', down)
    surface.addEventListener('pointermove', move)
    surface.addEventListener('pointerup', end)
    surface.addEventListener('pointercancel', end)
    surface.addEventListener('lostpointercapture', end)
    surface.addEventListener('pointerleave', leave)
    window.addEventListener('blur', blur)
    onCleanup(() => {
      surface.removeEventListener('pointerdown', down)
      surface.removeEventListener('pointermove', move)
      surface.removeEventListener('pointerup', end)
      surface.removeEventListener('pointercancel', end)
      surface.removeEventListener('lostpointercapture', end)
      surface.removeEventListener('pointerleave', leave)
      window.removeEventListener('blur', blur)
      blur()
      cancelAnimationFrame(frame)
      frame = 0
      segments.value = []
    })
  },
  { immediate: true }
)
onBeforeUnmount(stopWatching)
</script>

<template>
  <svg
    class="paper-presentation-laser"
    aria-hidden="true"
  >
    <g
      v-for="segment in segments"
      :key="segment.id"
      :opacity="segment.opacity"
      data-laser-segment
    >
      <path
        :d="`M${segment.from.x},${segment.from.y} L${segment.to.x},${segment.to.y}`"
        class="laser-glow"
      />
      <path
        :d="`M${segment.from.x},${segment.from.y} L${segment.to.x},${segment.to.y}`"
        class="laser-core"
      />
    </g>
    <g
      v-if="head"
      :transform="`translate(${head.x} ${head.y})`"
      data-laser-head
    >
      <circle
        r="8"
        fill="#ff3045"
        opacity=".2"
      />
      <circle
        r="4"
        fill="#ff3045"
      />
      <circle
        r="1.8"
        fill="#fff5f5"
      />
    </g>
  </svg>
</template>

<style scoped>
.paper-presentation-laser {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: hidden;
  pointer-events: none;
  z-index: 30;
}
path {
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.laser-glow {
  stroke: #ff3045;
  stroke-width: 7;
  opacity: 0.4;
}
.laser-core {
  stroke: #ff5261;
  stroke-width: 3;
}
</style>
