import { defineStore } from "pinia";

import {
  cancelAllReminders,
  cancelReminder,
  clearNotificationLaunchContext,
  getNotificationLaunchContext,
  getNotificationPermission,
  getPendingReminders,
  initializeNotificationInteractions,
  notifyNow,
  requestNotificationPermission,
  scheduleReminder,
} from "@/shared/lib/notifications/notification.service";
import { router } from "@/app/router";
import type { NotificationInteraction, PendingReminder, ReminderInput } from "@/shared/types/notification";

type NotificationStoreState = {
  permissionGranted: boolean;
  pendingReminders: PendingReminder[];
  nativeLaunchReminderId: string;
  lastInteraction: NotificationInteraction | null;
  isReady: boolean;
  error: string;
};

export const useNotificationStore = defineStore("notifications", {
  state: (): NotificationStoreState => ({
    permissionGranted: false,
    pendingReminders: [],
    nativeLaunchReminderId: "",
    lastInteraction: null,
    isReady: false,
    error: "",
  }),

  getters: {
    pendingCount: (state) => state.pendingReminders.length,
  },

  actions: {
    async hydrate() {
      try {
        await this.hydrateLaunchContext();
        await initializeNotificationInteractions({
          onOpenTask: async (interaction) => {
            this.lastInteraction = interaction;
            await openTaskFromNotification(interaction.taskId);
          },
          onCompleteTask: async (interaction) => {
            this.lastInteraction = interaction;
            await completeTaskFromNotification(interaction.taskId);
          },
          onNativeLaunch: async (context) => {
            this.nativeLaunchReminderId = context.reminderId;
          },
        });
        this.permissionGranted = await getNotificationPermission();
        this.pendingReminders = await getPendingReminders();
        this.isReady = true;
        this.error = "";
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel carregar notificacoes.";
      }
    },

    async hydrateLaunchContext() {
      const launchContext = await getNotificationLaunchContext();
      this.nativeLaunchReminderId = launchContext?.reminderId ?? "";
    },

    applyPendingReminders(reminders: PendingReminder[]) {
      this.pendingReminders = reminders;
      this.permissionGranted = true;
      this.isReady = true;
      this.error = "";
    },

    async clearNativeLaunchContext() {
      try {
        await clearNotificationLaunchContext();
        this.nativeLaunchReminderId = "";
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel limpar contexto da notificacao.";
      }
    },

    async requestPermission() {
      try {
        this.permissionGranted = await requestNotificationPermission();
        this.error = "";
        return this.permissionGranted;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel solicitar permissao.";
        return false;
      }
    },

    async notifyNow(input: ReminderInput) {
      try {
        const reminder = await notifyNow(input);
        this.permissionGranted = reminder !== null;
        this.error = "";
        return reminder;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel disparar notificacao.";
        return null;
      }
    },

    async schedule(input: ReminderInput) {
      try {
        const reminder = await scheduleReminder(input);
        this.permissionGranted = reminder !== null;
        this.pendingReminders = await getPendingReminders();
        this.error = "";
        return reminder;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel agendar notificacao.";
        return null;
      }
    },

    async cancel(id: number) {
      try {
        await cancelReminder(id);
        this.pendingReminders = await getPendingReminders();
        this.error = "";
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel cancelar notificacao.";
      }
    },

    async cancelAll() {
      try {
        await cancelAllReminders();
        this.pendingReminders = [];
        this.error = "";
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel cancelar notificacoes.";
      }
    },
  },
});

async function openTaskFromNotification(taskId: string | null) {
  if (!taskId) {
    await router.replace({ name: "today" });
    return;
  }

  const { useTaskStore } = await import("@/stores/task.store");
  const tasks = useTaskStore();

  tasks.selectTask(taskId);
  await router.replace({ name: "today" });
}

async function completeTaskFromNotification(taskId: string | null) {
  if (!taskId) {
    await router.replace({ name: "today" });
    return;
  }

  const { useTaskStore } = await import("@/stores/task.store");
  const tasks = useTaskStore();

  await tasks.setCompleted(taskId, true);
  tasks.selectTask(taskId);
  await router.replace({ name: "today" });
}
