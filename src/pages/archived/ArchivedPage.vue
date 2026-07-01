<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { Archive } from "@lucide/vue";

import { useTaskStore } from "@/stores/task.store";
import TaskCard from "@/features/tasks/components/TaskCard.vue";
import { useI18n } from "vue-i18n";

const PAGE_SIZE = 50;

const tasks = useTaskStore();
const { t } = useI18n();
const isLoadingMore = ref(false);
const hasMore = ref(true);
const archivedCount = computed(() => tasks.viewCounts.archived);

onMounted(async () => {
	tasks.setActiveTaskView("archived");
	await Promise.all([
		tasks.hydrateArchived({ limit: PAGE_SIZE, offset: 0 }),
		tasks.hydrateViewCounts(),
	]);
	hasMore.value = tasks.archived.length < archivedCount.value;
});

async function loadMore() {
	if (isLoadingMore.value || !hasMore.value) {
		return;
	}

	isLoadingMore.value = true;
	const previousLength = tasks.archived.length;

	try {
		await tasks.hydrateArchived(
			{ limit: PAGE_SIZE, offset: previousLength },
			true,
		);
		hasMore.value =
			tasks.archived.length > previousLength &&
			tasks.archived.length < archivedCount.value;
	} finally {
		isLoadingMore.value = false;
	}
}

</script>

<template>
  <section class="grid max-w-5xl gap-5">
    <header
      class="flex flex-wrap items-end justify-between gap-4 border-b border-border pb-4"
    >
      <div class="grid gap-1">
        <span class="text-display">{{ t('archived.title') }}</span>
        <span class="text-body text-ink-soft">
          {{ t('archived.subtitle') }}
        </span>
      </div>

      <div
        class="flex items-center gap-2 border border-border bg-surface px-3 py-2 text-body text-ink-soft"
      >
        <Archive :size="17" />
        <strong class="text-ink">{{ archivedCount }}</strong>
        <span>{{ t('common.tasks', archivedCount) }}</span>
      </div>
    </header>

    <div
      v-if="tasks.archived.length === 0"
      class="grid justify-items-center gap-3 border border-dashed border-border bg-surface p-10 text-center"
    >
      <Archive
        :size="28"
        class="text-ink-muted"
      />
      <div class="grid gap-1">
        <span class="text-heading">{{ t('archived.emptyTitle') }}</span>
        <span class="text-body text-ink-soft">
          {{ t('archived.emptyMessage') }}
        </span>
      </div>
    </div>

    <div class="grid gap-3">
      <TaskCard
        :key="task.id"
        v-for="task in tasks.archived"
        v-bind="task"
      />
    </div>

    <div
      v-if="hasMore"
      class="flex justify-center"
    >
      <button
        type="button"
        class="border border-border bg-surface px-4 py-2 text-body font-semibold text-ink hover:bg-hover disabled:pointer-events-none disabled:opacity-50"
        :disabled="isLoadingMore"
        @click="loadMore"
      >
        {{ isLoadingMore ? t('common.loading') : t('common.loadMore') }}
      </button>
    </div>
  </section>
</template>
