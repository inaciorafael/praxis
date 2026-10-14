<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { FilePenLine } from '@lucide/vue'
import { listBoards } from '@/shared/lib/boards/board.service'
import {
  attachTaskPaper,
  createTaskPaper,
  detachTaskPaper,
  listTaskPapers,
} from '@/shared/lib/papers/paper.service'
import type { BoardSummary } from '@/shared/types/board'

const props = defineProps<{ taskId: string; taskTitle: string }>()
const emit = defineEmits<{ open: [paperId: string] }>()
const { t } = useI18n()
const papers = ref<BoardSummary[]>([])
const available = ref<BoardSummary[]>([])
const loading = ref(false)
const error = ref(false)
const mode = ref<'create' | 'attach' | null>(null)
const title = ref('')
const selectedId = ref('')
let epoch = 0
let creation: { title: string; operationId: string } | null = null
let retry: (() => Promise<void>) | null = null
const choices = computed(() =>
  available.value.filter(
    (paper) => !papers.value.some((attached) => attached.id === paper.id)
  )
)

async function run(action: (taskId: string) => Promise<void>) {
  if (loading.value || !props.taskId) return
  const currentEpoch = epoch
  const taskId = props.taskId
  loading.value = true
  error.value = false
  retry = () => run(action)
  try {
    await action(taskId)
  } catch {
    if (epoch === currentEpoch) error.value = true
  } finally {
    if (epoch === currentEpoch) loading.value = false
  }
}

function load() {
  const currentEpoch = epoch
  return run(async (taskId) => {
    const result = await listTaskPapers(taskId)
    if (epoch === currentEpoch) papers.value = result
  })
}

function startCreate() {
  mode.value = 'create'
  title.value = t('papers.taskDefaultTitle', { title: props.taskTitle })
  creation = null
}

function create() {
  const name = title.value.trim()
  if (!name) return
  if (!creation || creation.title !== name)
    creation = { title: name, operationId: crypto.randomUUID() }
  const request = creation
  const currentEpoch = epoch
  return run(async (taskId) => {
    const paper = await createTaskPaper(taskId, request.title, request.operationId)
    if (epoch !== currentEpoch) return
    const { elements, ...summary } = paper
    if (!papers.value.some((item) => item.id === paper.id))
      papers.value.push({ ...summary, elementCount: elements.length })
    mode.value = null
    creation = null
    emit('open', paper.id)
  })
}

function startAttach() {
  mode.value = 'attach'
  selectedId.value = ''
  const currentEpoch = epoch
  return run(async () => {
    const result = await listBoards()
    if (epoch === currentEpoch) available.value = result
  })
}

function attach() {
  const paper = choices.value.find((item) => item.id === selectedId.value)
  if (!paper) return
  const currentEpoch = epoch
  return run(async (taskId) => {
    await attachTaskPaper(taskId, paper.id)
    if (epoch !== currentEpoch) return
    papers.value.push(paper)
    mode.value = null
  })
}

function detach(paperId: string) {
  const currentEpoch = epoch
  return run(async (taskId) => {
    await detachTaskPaper(taskId, paperId)
    if (epoch === currentEpoch)
      papers.value = papers.value.filter((paper) => paper.id !== paperId)
  })
}

watch(
  () => props.taskId,
  () => {
    epoch++
    papers.value = []
    available.value = []
    mode.value = null
    error.value = false
    loading.value = false
    creation = null
    retry = null
    void load()
  },
  { immediate: true }
)
</script>

<template>
  <section
    class="grid gap-3"
    :aria-label="t('papers.taskSection')"
  >
    <div class="flex flex-wrap items-center justify-between gap-2">
      <h3 class="text-sm font-semibold text-ink">{{ t('papers.taskSection') }}</h3>
      <div class="flex gap-2">
        <button
          type="button"
          class="border border-border bg-surface px-2 py-1 font-semibold text-ink hover:bg-hover disabled:opacity-50 text-xs"
          data-action="new"
          :disabled="loading"
          @click="startCreate"
        >
          {{ t('papers.new') }}
        </button>
        <button
          type="button"
          class="border border-border bg-surface px-2 py-1 font-semibold text-ink hover:bg-hover disabled:opacity-50 text-xs"
          data-action="picker"
          :disabled="loading"
          @click="startAttach"
        >
          {{ t('papers.attachExisting') }}
        </button>
      </div>
    </div>
    <p class="text-xs leading-5 text-ink-soft">
      {{ t('papers.taskDescription') }}
    </p>
    <p
      v-if="loading"
      role="status"
      class="text-xs text-ink-muted"
    >
      {{ t('papers.loading') }}
    </p>
    <div
      v-if="error"
      role="alert"
      class="flex items-center gap-2 text-xs text-ink"
    >
      <span>{{ t('papers.error') }}</span>
      <button
        type="button"
        class="border border-border bg-surface px-2 py-1 font-semibold text-ink hover:bg-hover disabled:opacity-50"
        data-action="retry"
        :disabled="loading"
        @click="retry?.()"
      >
        {{ t('papers.retry') }}
      </button>
    </div>
    <form
      v-if="mode === 'create'"
      class="grid gap-2"
      @submit.prevent="create"
    >
      <label
        class="text-xs text-ink"
        :for="`paper-title-${taskId}`"
        >{{ t('papers.createTitle') }}</label
      >
      <input
        :id="`paper-title-${taskId}`"
        v-model="title"
        class="w-full border border-border bg-surface px-3 py-2 text-sm text-ink"
        :disabled="loading"
        :placeholder="t('papers.titlePlaceholder')"
        maxlength="180"
      />
      <div class="flex gap-2">
        <button
          type="submit"
          class="border border-accent bg-accent px-3 py-1 text-white disabled:opacity-50"
          :disabled="loading || !title.trim()"
        >
          {{ t('papers.new') }}
        </button>
        <button
          type="button"
          class="border border-border bg-surface px-2 py-1 font-semibold text-ink hover:bg-hover disabled:opacity-50"
          :disabled="loading"
          @click="mode = null"
        >
          {{ t('papers.cancel') }}
        </button>
      </div>
    </form>
    <form
      v-if="mode === 'attach'"
      class="grid gap-2"
      @submit.prevent="attach"
    >
      <label
        class="text-xs text-ink"
        :for="`paper-picker-${taskId}`"
        >{{ t('papers.choosePaper') }}</label
      >
      <select
        :id="`paper-picker-${taskId}`"
        v-model="selectedId"
        class="w-full border border-border bg-surface px-3 py-2 text-sm text-ink"
        :disabled="loading"
      >
        <option value="">{{ t('papers.choosePaper') }}</option>
        <option
          v-for="paper in choices"
          :key="paper.id"
          :value="paper.id"
        >
          {{ paper.title }}
        </option>
      </select>
      <div class="flex gap-2">
        <button
          type="submit"
          class="border border-accent bg-accent px-3 py-1 text-white disabled:opacity-50"
          :disabled="loading || !selectedId"
        >
          {{ t('papers.attach') }}
        </button>
        <button
          type="button"
          class="border border-border bg-surface px-2 py-1 font-semibold text-ink hover:bg-hover disabled:opacity-50"
          :disabled="loading"
          @click="mode = null"
        >
          {{ t('papers.cancel') }}
        </button>
      </div>
    </form>
    <p
      v-if="!papers.length && !loading && !error"
      class="text-xs text-ink-muted"
    >
      {{ t('papers.noAttachments') }}
    </p>
    <ul
      v-if="papers.length"
      class="grid gap-2"
    >
      <li
        v-for="paper in papers"
        :key="paper.id"
        class="praxis-row grid grid-cols-[20px_minmax(0,1fr)] items-start gap-2 p-3"
      >
        <FilePenLine
          :size="20"
          class="shrink-0 text-accent"
          aria-hidden="true"
        />
        <button
          type="button"
          class="grid min-w-0 flex-1 gap-1 text-left text-ink hover:text-accent disabled:opacity-50"
          data-action="open"
          :disabled="loading"
          :aria-label="t('papers.openNamed', { title: paper.title })"
          @click="emit('open', paper.id)"
        >
          <span class="break-words text-sm font-semibold">{{ paper.title }}</span>
          <span class="text-xs text-ink-muted">{{
            t('papers.elementCount', paper.elementCount)
          }}</span>
        </button>
        <button
          type="button"
          class="col-start-2 justify-self-end border border-border bg-surface px-2 py-1 font-semibold text-ink hover:bg-hover disabled:opacity-50 text-xs"
          data-action="detach"
          :disabled="loading"
          :title="t('papers.detachedHint')"
          @click="detach(paper.id)"
        >
          {{ t('papers.detach') }}
        </button>
      </li>
    </ul>
  </section>
</template>
