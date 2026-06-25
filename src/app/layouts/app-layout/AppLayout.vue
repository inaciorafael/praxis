<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import TaskRuntimeProvider from "@/app/providers/TaskRuntimeProvider.vue";
import AppAside from "../../shell/AppAside.vue";
import TaskEditorPanel from "@/features/tasks/components/TaskEditorPanel.vue";
import { useTagStore } from "@/stores/tag.store";
import { useTaskStore } from "@/stores/task.store";
import { useNotificationStore } from "@/stores/notification.store";
import { useShortcut } from "@/shared/composables/useShortcut";
import SearchTasksOverlay from "@/app/shell/SearchTasksOverlay.vue";

const tags = useTagStore();
const tasks = useTaskStore();
const notifications = useNotificationStore();
const hasSelectedTask = computed(() => Boolean(tasks.selectedTaskId));

const searchOverlayOpen = ref<boolean>(false);

function openSearchTask(): void {
	if (searchOverlayOpen.value) return;
	searchOverlayOpen.value = true;
}

function closeOverlayOpen(): void {
	if (searchOverlayOpen.value) {
		searchOverlayOpen.value = false;
	}
}

useShortcut(
	"Ctrl+k",
	() => {
		openSearchTask();
	},
	{
		preventDefault: true,
	},
);

onMounted(async () => {
	if (!tags.isReady) {
		await tags.hydrate();
	}

	if (!notifications.isReady) {
		await notifications.hydrate();
	}
});
</script>

<template>
  <div class="grid min-h-screen grid-cols-12 bg-paper text-ink">
    <aside class="border-r col-span-2 border-border bg-surface">
      <AppAside @handleClickSearchTask="openSearchTask" />
    </aside>

    <main
      :class="[
        'h-screen overflow-y-auto bg-paper p-10',
        hasSelectedTask ? 'col-span-7' : 'col-span-10',
      ]"
    >
      <TaskRuntimeProvider>
        <RouterView />
        <SearchTasksOverlay
          v-if="searchOverlayOpen"
          class="absolute inset-0 z-20 bg-paper"
          @close="closeOverlayOpen"
        />
      </TaskRuntimeProvider>
    </main>

    <TaskEditorPanel
      v-if="hasSelectedTask"
      class="col-span-3"
    />
  </div>
</template>
