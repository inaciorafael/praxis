<script setup lang="ts">
import { RouterLink, useRouter } from "vue-router";

import { AppNavigationItem, appNavigationItems } from "@/app/shell/navigation";
import { useTaskStore } from "@/stores/task.store";
import { useTagStore } from "@/stores/tag.store";
import { useVaultStore } from "@/stores/vault.store";
import { useBadgeStore } from "@/stores/badge.store";
import { Hash, RefreshCw } from "@lucide/vue";
import dayjs from "dayjs";

const vault = useVaultStore();
const tasks = useTaskStore();
const tags = useTagStore();
const badge = useBadgeStore();
const router = useRouter();

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
</script>

<template>
  <nav class="flex gap-1 p-3 flex-col justify-between h-full" aria-label="Navegacao principal">
    <div>
      <div class="flex flex-col gap-2">
        <RouterLink
          v-for="item in appNavigationItems"
          :key="item.to"
          :to="item.to"
          class="flex min-h-10 items-center justify-between gap-2 rounded-md px-3 py-2 text-body font-semibold text-ink-soft transition-colors hover:bg-hover hover:text-ink"
          active-class="bg-black text-paper hover:bg-black"
        >
        <div class="flex flex-row items-center gap-2">
          <component :is="item.icon" class="size-5 shrink-0" />
          <span class="truncate">{{ item.label }}</span>
        </div>
        <span
          v-if="getBadgeCount(item.badgeKey) > 0"
          class="rounded-full border border-border bg-brick px-2 py-0.5 text-caption font-semibold text-paper"
          >
          {{ getBadgeCount(item.badgeKey) }}
        </span>
        </RouterLink>
      </div>

      <div class="flex flex-col py-3 gap-3">
        <span class="text-heading">Minhas #tags</span>

        <button class="flex flex-row items-center gap-1 px-3 py-2 hover:bg-hover" v-for="tag in tags.tags">
          <div
            :style="{ backgroundColor: tag.color }"
            :class="[
            'h-4 w-4 rounded flex items-center justify-center text-paper',
            ]">
            <Hash :size="10" />
          </div>
          <span>{{ tag.name }}</span>
        </button>
      </div>
    </div>

    <div class="border-t flex flex-col gap-3 border-border py-3">
      <div v-if="vault.active" class="flex text-sage font-semibold flex-row gap-2 items-center">
        <div class="h-2 w-2 rounded-full bg-sage"></div>
        <span class="text-small">Cofre Online</span>
      </div>

      <div class="flex text-small font-semibold flex-row gap-2 items-center">
        <RefreshCw :size="15" />
        last synced
        <span>{{ dayjs(vault.dataFileUpdatedAt).format('DD/MM/YYYY HH:mm A') }}</span>
      </div>

      <button class="bg-brick text-paper p-3 rounded-xl" @click="lockVault">
        <span class="text-paper">Sair</span>
      </button>
    </div>

  </nav>
</template>
