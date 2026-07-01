<script setup lang="ts">
import TaskCard from '@/features/tasks/components/TaskCard.vue'
import { useShortcut } from '@/shared/composables/useShortcut'
import type { TaskSearchFilters } from '@/shared/types/task'
import { useTagStore } from '@/stores/tag.store'
import { useTaskStore } from '@/stores/task.store'
import { RotateCcw, Search, SlidersHorizontal, X } from '@lucide/vue'
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const PAGE_SIZE = 40
const SEARCH_DELAY_MS = 250

const emit = defineEmits<{
  close: []
}>()

const tags = useTagStore()
const tasks = useTaskStore()
const { t } = useI18n()
const query = ref('')
const inputRef = ref<HTMLInputElement>()
const filters = reactive<TaskSearchFilters>({
  query: '',
  status: null,
  dateFilter: null,
  hasReminder: null,
  tagId: null,
  archiveFilter: 'active',
})
let searchTimer: number | undefined

const activeFilterCount = computed(
  () =>
    [
      filters.status,
      filters.dateFilter,
      filters.hasReminder,
      filters.tagId,
      filters.archiveFilter !== 'active' ? filters.archiveFilter : null,
    ].filter((value) => value !== null).length
)
const hasCriteria = computed(
  () => query.value.trim().length > 0 || activeFilterCount.value > 0
)
const hasMore = computed(() => tasks.searchResults.length < tasks.searchTotal)

function currentFilters(): TaskSearchFilters {
  return {
    ...filters,
    query: query.value.trim(),
  }
}

async function runSearch(append = false) {
  if (!hasCriteria.value) {
    tasks.clearSearch()
    return
  }

  await tasks.search(
    currentFilters(),
    {
      limit: PAGE_SIZE,
      offset: append ? tasks.searchResults.length : 0,
    },
    append
  )
}

function queueSearch() {
  window.clearTimeout(searchTimer)
  searchTimer = window.setTimeout(() => void runSearch(), SEARCH_DELAY_MS)
}

function clearFilters() {
  query.value = ''
  filters.status = null
  filters.dateFilter = null
  filters.hasReminder = null
  filters.tagId = null
  filters.archiveFilter = 'active'
  tasks.clearSearch()
  inputRef.value?.focus()
}

function selectResult(taskId: string) {
  tasks.selectTask(taskId)
  emit('close')
}

watch(
  [
    query,
    () => filters.status,
    () => filters.dateFilter,
    () => filters.hasReminder,
    () => filters.tagId,
    () => filters.archiveFilter,
  ],
  queueSearch
)

onMounted(() => {
  inputRef.value?.focus()
})

onBeforeUnmount(() => {
  window.clearTimeout(searchTimer)
})

useShortcut('Escape', () => emit('close'), {
  preventDefault: true,
  ignoreInputs: false,
})
</script>

<template>
  <section class="absolute inset-0 z-20 flex min-h-0 flex-col bg-paper text-ink">
    <header class="border-b border-border bg-paper px-6 py-5">
      <div class="mb-4 flex items-center justify-between gap-4">
        <div>
          <h1 class="text-display">{{ t('search.title') }}</h1>
          <p class="text-body text-ink-soft">
            {{ t('search.subtitle') }}
          </p>
        </div>

        <button
          type="button"
          class="flex h-10 w-10 shrink-0 items-center justify-center border border-border text-ink-soft hover:bg-hover hover:text-ink"
          :aria-label="t('common.close')"
          :title="t('common.close')"
          @click="emit('close')"
        >
          <X :size="20" />
        </button>
      </div>

      <div
        class="flex min-h-12 items-center gap-3 border border-border bg-surface px-4 focus-within:border-accent"
      >
        <Search
          :size="21"
          class="shrink-0 text-ink-soft"
        />
        <input
          ref="inputRef"
          v-model="query"
          type="search"
          autocomplete="off"
          :placeholder="t('search.placeholder')"
          class="w-full bg-transparent text-heading text-ink outline-none placeholder:text-ink-muted"
        />
        <span
          v-if="tasks.isSearching"
          class="shrink-0 text-small text-ink-muted"
          >{{ t('search.searching') }}</span
        >
      </div>

      <div class="mt-4 flex items-center gap-2 text-label font-semibold text-ink-soft">
        <SlidersHorizontal :size="17" />
        <span>{{ t('search.filters') }}</span>
        <span
          v-if="activeFilterCount"
          class="bg-accent px-2 text-on-accent"
          >{{ activeFilterCount }}</span
        >
      </div>

      <div class="mt-2 grid grid-cols-1 gap-2 tablet:grid-cols-2 desktop:grid-cols-5">
        <label class="grid gap-1 text-small text-ink-soft">
          {{ t('search.status') }}
          <select
            v-model="filters.status"
            class="h-10 border border-border bg-surface px-3 text-body text-ink outline-none focus:border-accent"
          >
            <option :value="null">{{ t('search.all') }}</option>
            <option value="pending">{{ t('nav.pending') }}</option>
            <option value="completed">{{ t('nav.completed') }}</option>
          </select>
        </label>

        <label class="grid gap-1 text-small text-ink-soft">
          {{ t('search.due') }}
          <select
            v-model="filters.dateFilter"
            class="h-10 border border-border bg-surface px-3 text-body text-ink outline-none focus:border-accent"
          >
            <option :value="null">{{ t('search.anyDue') }}</option>
            <option value="dueToday">{{ t('search.dueToday') }}</option>
            <option value="overdue">{{ t('nav.overdue') }}</option>
            <option value="upcoming">{{ t('search.upcoming') }}</option>
            <option value="withoutDue">{{ t('search.withoutDue') }}</option>
          </select>
        </label>

        <label class="grid gap-1 text-small text-ink-soft">
          {{ t('search.reminder') }}
          <select
            v-model="filters.hasReminder"
            class="h-10 border border-border bg-surface px-3 text-body text-ink outline-none focus:border-accent"
          >
            <option :value="null">{{ t('search.all') }}</option>
            <option :value="true">{{ t('search.withReminder') }}</option>
            <option :value="false">{{ t('search.withoutReminder') }}</option>
          </select>
        </label>

        <label class="grid gap-1 text-small text-ink-soft">
          {{ t('search.tag') }}
          <select
            v-model="filters.tagId"
            class="h-10 border border-border bg-surface px-3 text-body text-ink outline-none focus:border-accent"
          >
            <option :value="null">{{ t('search.allTags') }}</option>
            <option
              v-for="tag in tags.tags"
              :key="tag.id"
              :value="tag.id"
            >
              +{{ tag.name }}
            </option>
          </select>
        </label>

        <label class="grid gap-1 text-small text-ink-soft">
          {{ t('search.archive') }}
          <select
            v-model="filters.archiveFilter"
            class="h-10 border border-border bg-surface px-3 text-body text-ink outline-none focus:border-accent"
          >
            <option value="active">{{ t('search.active') }}</option>
            <option value="archived">{{ t('search.archived') }}</option>
            <option value="all">{{ t('search.all') }}</option>
          </select>
        </label>
      </div>

      <button
        v-if="hasCriteria"
        type="button"
        class="mt-3 flex items-center gap-2 text-small font-semibold text-ink-soft hover:text-ink"
        @click="clearFilters"
      >
        <RotateCcw :size="15" />
        {{ t('search.clear') }}
      </button>
    </header>

    <div class="min-h-0 flex-1 overflow-y-auto px-6 py-5">
      <div
        v-if="!hasCriteria"
        class="grid min-h-52 place-items-center border border-dashed border-border bg-surface text-center"
      >
        <div class="max-w-md">
          <Search
            :size="28"
            class="mx-auto mb-3 text-ink-muted"
          />
          <p class="text-title">{{ t('search.promptTitle') }}</p>
          <p class="mt-1 text-body text-ink-soft">
            {{ t('search.prompt') }}
          </p>
        </div>
      </div>

      <template v-else>
        <div class="mb-3 flex items-center justify-between border-b border-border pb-3">
          <span class="text-body text-ink-soft">
            {{ t('search.results', tasks.searchTotal) }}
            <template v-if="query.trim()"> para “{{ query.trim() }}”</template>
          </span>
        </div>

        <div
          v-if="tasks.error && !tasks.isSearching"
          class="border border-brick bg-surface p-4 text-body text-brick"
        >
          {{ tasks.error }}
        </div>

        <div
          v-else-if="!tasks.isSearching && tasks.searchResults.length === 0"
          class="border border-border bg-surface p-6 text-center text-body text-ink-soft"
        >
          {{ t('search.noResults') }}
        </div>

        <div
          v-else
          class="grid gap-1"
        >
          <div
            v-for="task in tasks.searchResults"
            :key="task.id"
            @click="selectResult(task.id)"
          >
            <TaskCard v-bind="task" />
          </div>
        </div>

        <button
          v-if="hasMore"
          type="button"
          :disabled="tasks.isSearching"
          class="mx-auto mt-5 flex min-h-10 items-center justify-center border border-border bg-surface px-5 text-body font-semibold text-ink hover:bg-hover disabled:pointer-events-none disabled:opacity-50"
          @click="runSearch(true)"
        >
          {{ tasks.isSearching ? t('common.loading') : t('common.loadMore') }}
        </button>
      </template>
    </div>
  </section>
</template>
