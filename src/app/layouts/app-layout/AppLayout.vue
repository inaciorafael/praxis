<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import TaskRuntimeProvider from '@/app/providers/TaskRuntimeProvider.vue'
import AppAside from '../../shell/AppAside.vue'
import TaskEditorPanel from '@/features/tasks/components/TaskEditorPanel.vue'
import { useTagStore } from '@/stores/tag.store'
import { useTaskStore } from '@/stores/task.store'
import { useBoardStore } from '@/stores/board.store'
import { useNotificationStore } from '@/stores/notification.store'
import { useShortcut } from '@/shared/composables/useShortcut'
import SearchTasksOverlay from '@/app/shell/SearchTasksOverlay.vue'

const tags = useTagStore()
const tasks = useTaskStore()
const boards = useBoardStore()
const notifications = useNotificationStore()
const route = useRoute()
const isBoardPage = computed(() => route.name === 'boards' || route.name === 'papers')
const isBoardFocus = computed(() => isBoardPage.value && route.query.focus === '1')
const isPaperStudio = computed(() => isBoardPage.value && Boolean(boards.current))
const hasSelectedTask = computed(() => Boolean(tasks.selectedTaskId))

const searchOverlayOpen = ref<boolean>(false)

function openSearchTask(): void {
  if (searchOverlayOpen.value) return
  searchOverlayOpen.value = true
}

function closeOverlayOpen(): void {
  if (searchOverlayOpen.value) {
    searchOverlayOpen.value = false
  }
}

useShortcut(
  'Ctrl+k',
  () => {
    openSearchTask()
  },
  {
    preventDefault: true,
  }
)

onMounted(async () => {
  if (!tags.isReady) {
    await tags.hydrate()
  }

  if (!notifications.isReady) {
    await notifications.hydrate()
  }
})
</script>

<template>
  <div
    class="relative grid min-h-screen bg-paper text-ink"
    :class="
      isBoardFocus || isPaperStudio
        ? 'grid-cols-[minmax(0,1fr)]'
        : isBoardPage
          ? 'grid-cols-[11rem_minmax(0,1fr)]'
          : 'grid-cols-12'
    "
  >
    <aside
      v-if="!isBoardFocus && !isPaperStudio"
      class="min-w-0 border-r border-border bg-surface"
      :class="isBoardPage ? '' : 'col-span-2'"
    >
      <AppAside @handleClickSearchTask="openSearchTask" />
    </aside>

    <main
      :class="[
        'h-screen min-w-0 bg-paper',
        isBoardPage ? 'overflow-hidden p-0' : 'overflow-y-auto p-10',
        isBoardPage ? 'col-span-1' : hasSelectedTask ? 'col-span-7' : 'col-span-10',
      ]"
    >
      <TaskRuntimeProvider>
        <RouterView />
        <SearchTasksOverlay
          v-if="searchOverlayOpen && !isBoardFocus"
          class="absolute inset-0 z-20 bg-paper"
          @close="closeOverlayOpen"
        />
      </TaskRuntimeProvider>
    </main>

    <TaskEditorPanel
      v-if="hasSelectedTask"
      v-show="!isBoardFocus"
      :class="
        isBoardPage
          ? [
              'absolute right-0 top-0 z-30 w-80 shadow-xl',
              isBoardFocus || isPaperStudio ? 'max-w-full' : 'max-w-[calc(100%-11rem)]',
            ]
          : 'col-span-3'
      "
    />
  </div>
</template>
