<script setup lang="ts">
import { RouterLink, useRouter } from "vue-router";

import { AppNavigationItem, appNavigationItems } from "@/app/shell/navigation";
import { useTaskStore } from "@/stores/task.store";
import { useTagStore } from "@/stores/tag.store";
import { useVaultStore } from "@/stores/vault.store";
import { useBadgeStore } from "@/stores/badge.store";
import { LogOut, Plus, RefreshCw, Search } from "@lucide/vue";
import dayjs from "dayjs";
import { useI18n } from "vue-i18n";

const vault = useVaultStore();
const tasks = useTaskStore();
const tags = useTagStore();
const badge = useBadgeStore();
const router = useRouter();
const { t } = useI18n();

const emit = defineEmits<{
	handleClickSearchTask: [];
}>();

function getBadgeCount(key: AppNavigationItem["badgeKey"]) {
	if (!key) {
		return 0;
	}

	return tasks.viewCounts[key] ?? 0;
}

async function lockVault() {
	await vault.close();
	tasks.resetLocal();
	tags.resetLocal();
	await badge.clear();
	await router.replace({ name: "vault" });
}

function openFreeCreateModal() {
	tasks.openFreeCreateTaskModal();
}
</script>

<template>
  <nav
    class="flex h-full flex-col justify-between gap-1 overflow-y-auto p-3"
    :aria-label="t('nav.mainNavigation')"
  >
    <div class="flex flex-col gap-3">
      <button
        @click="emit('handleClickSearchTask')"
        class="bg-hover flex flex-row items-center justify-between gap-2 px-3 py-1"
      >
        <div class="flex flex-row items-center gap-2">
          <Search :size="18" />
          <span class="text-ink-soft">{{ t('nav.search') }}</span>
        </div>
        <span class="text-ink-soft">Ctrl+k</span>
      </button>

      <button
        type="button"
        class="mb-3 flex min-h-10 w-full items-center justify-center gap-2 border border-border bg-surface px-3 py-2 text-body font-semibold text-ink transition-colors hover:bg-hover"
        @click="openFreeCreateModal"
      >
        <Plus :size="18" />
        <span>{{ t('nav.newTask') }}</span>
      </button>

      <div class="flex flex-col gap-2">
        <RouterLink
          v-for="item in appNavigationItems"
          v-slot="{ isActive }"
          :key="item.to"
          :to="item.to"
        >
          <div
            :class="[
              'flex flex-row min-h-10 items-center justify-between gap-2 px-3 py-2 border-l-[3px] transition-colors',
              {
                'border-l-blue bg-hover text-ink': isActive,
                'border-l-transparent text-ink-soft': !isActive,
              },
            ]"
          >
            <div class="flex flex-row gap-2 items-center">
              <component
                :is="item.icon"
                class="size-5 shrink-0"
              />
              <span class="truncate">{{ t(item.labelKey) }}</span>
            </div>
            <span
              v-if="getBadgeCount(item.badgeKey) > 0"
              class="bg-brick px-2 py-0.5 text-caption font-semibold text-on-accent"
            >
              {{ getBadgeCount(item.badgeKey) }}
            </span>
          </div>
        </RouterLink>
      </div>
    </div>

    <div class="border-t flex flex-col gap-3 border-border py-3">
      <div
        v-if="vault.active"
        class="flex text-sage font-semibold flex-row gap-2 items-center"
      >
        <div class="h-2 w-2 rounded-full bg-sage"></div>
        <span class="text-small">{{ t('nav.vaultOnline') }}</span>
      </div>

      <div
        class="flex text-small font-semibold flex-row gap-2 items-center justify-between"
      >
        <div class="flex flex-row items-center gap-1">
          <RefreshCw :size="15" />
          {{ t('nav.lastSynced') }}
          <span>{{ dayjs(vault.dataFileUpdatedAt).format('DD/MM/YYYY HH:mm A') }}</span>
        </div>

        <button
          class="text-on-accent bg-brick flex flex-row items-center p-2"
          :aria-label="t('nav.lockVault')"
          :title="t('nav.lockVault')"
          @click="lockVault"
        >
          <LogOut :size="15" />
        </button>
      </div>
    </div>
  </nav>
</template>
