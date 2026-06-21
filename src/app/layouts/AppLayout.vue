<script setup lang="ts">
import { computed, onMounted } from 'vue';
import TaskRuntimeProvider from '@/app/providers/TaskRuntimeProvider.vue';
import AppAside from '../shell/AppAside.vue';
import TaskEditorPanel from '@/features/tasks/components/TaskEditorPanel.vue';
import { useTagStore } from '@/stores/tag.store';
import { useTaskStore } from '@/stores/task.store';

const tags = useTagStore()
const tasks = useTaskStore()
const hasSelectedTask = computed(() => Boolean(tasks.selectedTaskId))

onMounted(async () => {
  if (!tags.isReady) {
    await tags.hydrate();
  }
})

</script>

<template>
  <div class="grid min-h-screen grid-cols-12 bg-paper text-ink">
    <aside class="border-r col-span-2 border-border bg-surface">
      <AppAside />
    </aside>

    <main :class="[
      'h-screen overflow-y-auto bg-paper p-10',
      hasSelectedTask ? 'col-span-7' : 'col-span-10'
    ]">
      <TaskRuntimeProvider>
        <RouterView />
      </TaskRuntimeProvider>
    </main>

    <TaskEditorPanel v-if="hasSelectedTask" class="col-span-3" />
  </div>
</template>
