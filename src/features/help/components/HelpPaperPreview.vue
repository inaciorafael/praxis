<script setup lang="ts">
import {
  ArrowUpRight,
  Check,
  Ellipsis,
  FilePenLine,
  Hand,
  Maximize,
  MousePointer2,
  Pencil,
  PenTool,
  Plus,
  Type,
} from '@lucide/vue'
import { useI18n } from 'vue-i18n'

defineProps<{ stage: 'create' | 'draw' | 'text' | 'organize' | 'link' | 'share' }>()
const { t } = useI18n()
const wheel = [Pencil, PenTool, MousePointer2, Hand, Type, FilePenLine]
</script>

<template>
  <figure class="grid gap-3 border border-border bg-surface p-4">
    <span class="text-caption font-semibold uppercase text-ink-muted">{{
      t('help.papers.tutorial.illustration')
    }}</span>
    <div
      class="paper-example"
      aria-hidden="true"
    >
      <template v-if="stage === 'create'">
        <div class="example-gallery">
          <strong>{{ t('papers.title') }}</strong>
          <span class="example-action"><Plus :size="14" />{{ t('papers.new') }}</span>
          <div class="example-card">
            <FilePenLine :size="28" /><strong>{{ t('help.papers.exampleTitle') }}</strong
            ><span>{{ t('papers.open') }}<ArrowUpRight :size="13" /></span>
          </div>
        </div>
      </template>
      <template v-else-if="stage === 'link'">
        <div class="example-gallery">
          <span class="example-caption">{{ t('help.papers.tutorial.taskLabel') }}</span>
          <strong>{{ t('help.papers.tutorial.taskTitle') }}</strong>
          <div class="example-link">
            <FilePenLine :size="20" />
            <div>
              <strong>{{ t('papers.taskSection') }}</strong>
              <p>{{ t('help.papers.exampleTitle') }}</p>
            </div>
            <Check :size="18" />
          </div>
          <span class="example-action">{{ t('papers.attachExisting') }}</span>
          <span class="example-return">← {{ t('papers.backToTask') }}</span>
        </div>
      </template>
      <template v-else>
        <div class="example-header">
          <span>{{ t('help.papers.exampleTitle') }}</span
          ><Check :size="13" /><Maximize :size="13" /><Ellipsis :size="15" />
        </div>
        <div class="example-wheel">
          <span
            v-for="(icon, index) in wheel"
            :key="index"
            :class="{
              'example-active':
                (stage === 'draw' && index === 0) ||
                (stage === 'text' && index === 4) ||
                (stage === 'organize' && index === 2),
            }"
            :style="{
              left: `${30 + 24 * Math.sin((index * Math.PI) / 3)}px`,
              top: `${30 - 24 * Math.cos((index * Math.PI) / 3)}px`,
            }"
            ><component
              :is="icon"
              :size="12"
          /></span>
        </div>
        <svg
          viewBox="0 0 320 250"
          class="example-drawing"
        >
          <g
            fill="none"
            stroke="#985610"
            stroke-width="1.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M94 55 L190 56 L189 102 L95 101 Z M96 54 L191 57 L188 103" />
            <path d="M143 105 Q141 121 143 140 M137 133 L143 140 L149 133" />
            <path d="M97 145 L191 144 L193 193 L95 192 Z M96 147 L192 146" />
            <path
              v-if="stage === 'draw'"
              d="M218 69 Q258 52 279 82 Q293 101 269 116 Q245 137 222 113"
              stroke="#285bb5"
              stroke-width="2"
            />
          </g>
          <text
            x="143"
            y="83"
            text-anchor="middle"
            fill="#33312c"
            font-size="13"
          >
            {{ t('help.papers.tutorial.screenOne') }}
          </text>
          <text
            x="143"
            y="173"
            text-anchor="middle"
            fill="#33312c"
            font-size="13"
          >
            {{ t('help.papers.tutorial.screenTwo') }}
          </text>
          <g v-if="stage === 'text'">
            <path
              d="M215 146 Q251 142 290 148 L289 162 Q251 158 217 162 Z"
              fill="#ffe28a"
              opacity="0.75"
            />
            <text
              x="216"
              y="158"
              fill="#33312c"
              font-size="12"
            >
              {{ t('help.papers.tutorial.annotation') }}
            </text>
          </g>
          <g
            v-if="stage === 'organize'"
            fill="none"
            stroke="#b57e29"
            stroke-width="1"
          >
            <rect
              x="91"
              y="50"
              width="104"
              height="57"
              stroke-dasharray="4 3"
            />
            <rect
              x="88"
              y="47"
              width="6"
              height="6"
              fill="#b57e29"
            />
            <rect
              x="192"
              y="104"
              width="6"
              height="6"
              fill="#b57e29"
            />
            <path d="M143 50 L143 36" />
            <circle
              cx="143"
              cy="32"
              r="4"
            />
          </g>
        </svg>
        <div
          v-if="stage === 'draw'"
          class="example-settings"
        >
          <span>{{ t('boards.strokeStyles.pencil') }}</span
          ><span>{{ t('boards.studio.strokeSize') }} · 2 px</span
          ><span class="example-stroke" />
        </div>
        <div
          v-if="stage === 'text'"
          class="example-text-tools"
        >
          <Type :size="14" /><strong>B</strong><em>I</em><span class="example-marker" />{{
            t('boards.rich.highlight')
          }}
        </div>
        <div
          v-if="stage === 'share'"
          class="example-export"
        >
          <Ellipsis :size="16" /><strong>{{ t('boards.exportPng') }}</strong
          ><span>{{ t('help.papers.tutorial.fileName') }}</span>
        </div>
      </template>
    </div>
    <figcaption class="text-small leading-5 text-ink-soft">
      {{ t(`help.papers.tutorial.${stage}.caption`) }}
    </figcaption>
  </figure>
</template>

<style scoped>
.paper-example {
  position: relative;
  min-width: 0;
  overflow: hidden;
  border: 1px solid #e5e0d5;
  background: #fff;
  color: #33312c;
  min-height: 280px;
}
.example-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 10px;
  padding: 9px;
  border: 1px solid #e5e0d5;
  border-radius: 8px;
  font-size: 11px;
}
.example-header > span {
  flex: 1;
}
.example-wheel {
  position: absolute;
  z-index: 1;
  top: 65px;
  left: 10px;
  width: 70px;
  height: 70px;
  border: 1px solid #e5e0d5;
  border-radius: 50%;
  background: #fff;
}
.example-wheel > span {
  position: absolute;
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}
.example-active {
  background: #f5e6c8;
  color: #985610;
}
.example-drawing {
  display: block;
  width: 100%;
}
.example-gallery {
  display: grid;
  gap: 15px;
  padding: 20px;
  font-size: 13px;
}
.example-action {
  display: flex;
  align-items: center;
  gap: 6px;
  width: fit-content;
  padding: 7px 10px;
  border-radius: 6px;
  background: #33312c;
  color: #fff;
  font-size: 11px;
}
.example-card {
  display: grid;
  gap: 14px;
  border: 1px solid #e5e0d5;
  border-radius: 10px;
  padding: 18px;
}
.example-card > span {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #666259;
}
.example-caption {
  color: #8c877b;
  font-size: 11px;
}
.example-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  background: #faf9f5;
  border: 1px solid #e5e0d5;
}
.example-link > div {
  flex: 1;
  min-width: 0;
}
.example-link p {
  margin-top: 5px;
  font-size: 11px;
}
.example-return {
  padding: 8px;
  border: 1px solid #e5e0d5;
  font-size: 11px;
}
.example-settings,
.example-text-tools,
.example-export {
  position: absolute;
  display: flex;
  align-items: center;
  gap: 8px;
  bottom: 12px;
  left: 12px;
  right: 12px;
  padding: 10px;
  border: 1px solid #e5e0d5;
  border-radius: 8px;
  background: #fff;
  font-size: 10px;
}
.example-stroke {
  flex: 1;
  height: 2px;
  background: #285bb5;
}
.example-marker {
  width: 18px;
  height: 8px;
  background: #ffe28a;
  transform: rotate(-4deg);
}
.example-export {
  flex-wrap: wrap;
  box-shadow: 0 3px 14px #30271918;
}
.example-export > span {
  flex-basis: 100%;
  color: #666259;
}
</style>
