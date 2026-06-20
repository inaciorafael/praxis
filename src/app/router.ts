import { createRouter, createWebHashHistory } from "vue-router";

import TodayPage from "@/pages/today/TodayPage.vue";
import VaultPage from "@/pages/vault/VaultPage.vue";
import { useTagStore } from "@/stores/tag.store";
import { useTaskStore } from "@/stores/task.store";
import { useVaultStore } from "@/stores/vault.store";
import PublicLayout from "./layouts/PublicLayout.vue";
import AppLayout from "./layouts/AppLayout.vue";
import MyWeekPage from "@/pages/my-week/MyWeekPage.vue";
import PendingPage from "@/pages/pending/PendingPage.vue";
import OverduePage from "@/pages/overdue/OverduePage.vue";
import RemindersPage from "@/pages/reminders/RemindersPage.vue";
import CompletedPage from "@/pages/completed/CompletedPage.vue";

export const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: "/",
      component: PublicLayout,
      children: [
        {
          path: "",
          redirect: { name: "vault" },
        },
        {
          path: "vault",
          name: "vault",
          component: VaultPage,
          meta: { public: true },
        },
      ]
    },
    {
      path: "/app",
      component: AppLayout,
      meta: { requiresVault: true },
      children: [
        {
          path: "today",
          name: "today",
          component: TodayPage,
        },
        {
          path: "my-week",
          name: "my-week",
          component: MyWeekPage,
        },

        {
          path: "pending",
          name: "pending",
          component: PendingPage,
        },

        {
          path: "overdue",
          name: "overdue",
          component: OverduePage,
        },

        {
          path: "reminders",
          name: "reminders",
          component: RemindersPage,
        },

        {
          path: "completed",
          name: "completed",
          component: CompletedPage,
        },

        {
          path: ":pathMatch(.*)*",
          redirect: { name: "today" },
        }
      ]
    },
    {
      path: "/:pathMatch(.*)*",
      redirect: { name: "today" },
    },
  ],
});

router.beforeEach(async (to) => {
  const vault = useVaultStore();

  if (!vault.isReady) {
    await vault.hydrate();
  }

  if (to.meta.requiresVault && !vault.active) {
    return { name: "vault" };
  }

  if (to.name === "vault" && vault.active) {
    await Promise.all([useTaskStore().hydrateToday(), useTagStore().hydrate()]);
    return { name: "today" };
  }

  if (to.meta.requiresVault) {
    await Promise.all([useTaskStore().hydrateToday(), useTagStore().hydrate()]);
  }

  return true;
});
