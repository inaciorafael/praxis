<script setup lang="ts">
import { computed, ref, type Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { Ellipsis, LockKeyhole, SlidersHorizontal } from '@lucide/vue'

const props = defineProps<{
  activeTool: string
  tools: { id: string; icon: Component; shortcut?: string }[]
  color: string
  width: number
  opacity: number
  settingsOpen: boolean
  keepTool: boolean
}>()
const emit = defineEmits<{
  choose: [toolId: string]
  toggleSettings: []
  toggleKeepTool: []
}>()
const { t } = useI18n()
const expanded = ref(false)
const primaryIds = ['draw', 'pen', 'select', 'pan', 'text', 'note']
const primary = computed(() =>
  primaryIds.flatMap((id) => {
    const tool = props.tools.find((item) => item.id === id)
    return tool ? [tool] : []
  })
)
const additional = computed(() =>
  props.tools.filter((tool) => !primaryIds.includes(tool.id))
)
const label = (tool: { id: string; shortcut?: string }) =>
  `${t(`boards.tools.${tool.id}`)}${tool.shortcut ? ` (${tool.shortcut})` : ''}`
function position(index: number) {
  const angle = (index * Math.PI) / 3 - Math.PI / 2
  return { left: `${93 + Math.cos(angle) * 64}px`, top: `${93 + Math.sin(angle) * 64}px` }
}
function choose(id: string) {
  emit('choose', id)
  expanded.value = false
}
</script>

<template>
  <div
    class="paper-tool-wheel"
    @pointerdown.stop
    @wheel.stop
    @keydown.stop
  >
    <div
      class="paper-tool-ring"
      role="toolbar"
      :aria-label="t('boards.studio.toolWheel')"
    >
      <div
        class="paper-tool-orbit"
        aria-hidden="true"
      />
      <button
        v-for="(tool, index) in primary"
        :key="tool.id"
        type="button"
        class="paper-tool-slot"
        :style="position(index)"
        :data-tool="tool.id"
        :aria-pressed="activeTool === tool.id"
        :aria-label="label(tool)"
        :title="label(tool)"
        @click="choose(tool.id)"
      >
        <component
          :is="tool.icon"
          :size="20"
          aria-hidden="true"
        />
      </button>
      <button
        type="button"
        class="paper-tool-center"
        data-tool-settings
        :aria-label="t('boards.studio.toolSettings')"
        :title="t('boards.studio.toolSettings')"
        :aria-expanded="settingsOpen"
        @click="emit('toggleSettings')"
      >
        <span
          class="paper-tool-swatch"
          :style="{ backgroundColor: color, opacity }"
          aria-hidden="true"
        />
        <SlidersHorizontal
          :size="16"
          aria-hidden="true"
        />
        <span class="paper-tool-values">
          <span :aria-label="`${t('boards.studio.strokeSize')}: ${width}`">{{
            width
          }}</span>
          <span aria-hidden="true">·</span>
          <span
            :aria-label="`${t('boards.studio.opacity')}: ${Math.round(opacity * 100)}%`"
            >{{ Math.round(opacity * 100) }}%</span
          >
        </span>
      </button>
    </div>
    <div class="paper-tool-footer">
      <button
        type="button"
        data-keep-tool
        :aria-pressed="keepTool"
        :aria-label="t('boards.keepToolActive')"
        :title="t('boards.keepToolActive')"
        @click="emit('toggleKeepTool')"
      >
        <LockKeyhole
          :size="15"
          aria-hidden="true"
        />
      </button>
      <span
        class="paper-tool-divider"
        aria-hidden="true"
      />
      <button
        type="button"
        data-more-tools
        :aria-expanded="expanded"
        :aria-label="t('boards.studio.moreTools')"
        :title="t('boards.studio.moreTools')"
        @click="expanded = !expanded"
      >
        <Ellipsis
          :size="20"
          aria-hidden="true"
        />
      </button>
    </div>
    <div
      v-show="expanded"
      class="paper-tool-drawer"
      role="toolbar"
      :aria-label="t('boards.studio.moreTools')"
    >
      <button
        v-for="tool in additional"
        :key="tool.id"
        type="button"
        :data-tool="tool.id"
        :aria-pressed="activeTool === tool.id"
        :aria-label="label(tool)"
        :title="label(tool)"
        @click="choose(tool.id)"
      >
        <component
          :is="tool.icon"
          :size="19"
          aria-hidden="true"
        />
      </button>
    </div>
  </div>
</template>

<style scoped>
.paper-tool-wheel {
  position: absolute;
  left: 12px;
  top: 70px;
  z-index: 4;
  width: 186px;
  color: #33312c;
  user-select: none;
}
.paper-tool-ring {
  position: relative;
  width: 186px;
  height: 186px;
  border: 1px solid #e5e0d5;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.97);
  box-shadow:
    0 8px 25px #30271912,
    0 2px 6px #30271908;
}
.paper-tool-orbit {
  position: absolute;
  inset: 29px;
  border: 1px solid #f1ede5;
  border-radius: 50%;
  pointer-events: none;
}
.paper-tool-wheel button {
  display: flex;
  align-items: center;
  justify-content: center;
  border: 0;
  color: inherit;
  background: transparent;
  cursor: pointer;
  transition:
    background 0.12s,
    color 0.12s;
}
.paper-tool-wheel button:hover {
  background: #f5f1e8;
}
.paper-tool-wheel button:focus-visible {
  outline: 2px solid #b57e29;
  outline-offset: 3px;
}
.paper-tool-wheel button[aria-pressed='true'] {
  color: #835a1f;
  background: #f5e6c8;
}
.paper-tool-slot {
  position: absolute;
  width: 36px;
  height: 36px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.paper-tool-wheel .paper-tool-center {
  position: absolute;
  top: 50%;
  left: 50%;
  width: 65px;
  height: 65px;
  transform: translate(-50%, -50%);
  border: 1px solid #ece6db;
  border-radius: 50%;
  background: #faf8f3;
  flex-wrap: wrap;
  align-content: center;
  gap: 5px;
}
.paper-tool-center[aria-expanded='true'] {
  box-shadow: 0 0 0 2px #d6b274;
}
.paper-tool-swatch {
  display: block;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  box-shadow: inset 0 0 0 1px #00000012;
}
.paper-tool-values {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  gap: 4px;
  font-size: 10px;
  font-weight: 600;
  color: #777165;
}
.paper-tool-footer {
  display: flex;
  justify-content: center;
  gap: 4px;
  width: max-content;
  margin: 8px auto 0;
  padding: 3px 7px;
  background: #fff;
  border: 1px solid #e5e0d5;
  border-radius: 20px;
  box-shadow: 0 3px 10px #3027190a;
}
.paper-tool-footer button {
  width: 29px;
  height: 27px;
  border-radius: 50%;
}
.paper-tool-divider {
  width: 1px;
  align-self: center;
  height: 15px;
  background: #e9e4db;
}
.paper-tool-drawer {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 3px;
  padding: 7px;
  margin-top: 8px;
  background: #fff;
  border: 1px solid #e5e0d5;
  border-radius: 16px;
  box-shadow: 0 5px 16px #30271912;
}
.paper-tool-drawer button {
  width: 31px;
  height: 32px;
  border-radius: 9px;
}
@media (max-height: 500px) {
  .paper-tool-wheel {
    top: 54px;
  }
}
</style>
