import { defineStore } from "pinia";

import { syncTaskReminders } from "@/shared/lib/notifications/notification.service";
import {
  createChecklistItem,
  createTask,
  deleteChecklistItem,
  deleteTask,
  getTaskViewCounts,
  listCompletedTasks,
  listOverdueTasks,
  listPendingTasks,
  listReminderTasks,
  listTaskTimeline,
  listTasks,
  listTodayTasks,
  listUpcomingTasks,
  listWeekTasks,
  setChecklistItemCompleted,
  setTaskCompleted,
  updateChecklistItem,
  updateTask,
} from "@/shared/lib/tasks/task.service";
import type { ChecklistItem, CreateChecklistItemInput, UpdateChecklistItemInput } from "@/shared/types/checklist";
import type { TaskTimeline } from "@/shared/types/lifecycle";
import type { CreateTaskInput, Task, TaskCollection, TaskListOptions, TaskListResult, TaskViewCounts, UpdateTaskInput } from "@/shared/types/task";
import { useBadgeStore } from "@/stores/badge.store";
import { useNotificationStore } from "@/stores/notification.store";

type TaskStoreState = {
  tasks: Task[];
  myDay: Task[];
  myWeek: Task[];
  pending: Task[];
  overdue: Task[];
  upcoming: Task[];
  withReminders: Task[];
  completed: Task[];
  checklistItems: ChecklistItem[];
  viewCounts: Omit<TaskViewCounts, "badge">;
  timelinesByTaskId: Record<string, TaskTimeline>;
  selectedTaskId: string;
  isReady: boolean;
  error: string;
};

export const useTaskStore = defineStore("tasks", {
  state: (): TaskStoreState => ({
    tasks: [],
    myDay: [],
    myWeek: [],
    pending: [],
    overdue: [],
    upcoming: [],
    withReminders: [],
    completed: [],
    checklistItems: [],
    viewCounts: emptyViewCounts(),
    timelinesByTaskId: {},
    selectedTaskId: "",
    isReady: false,
    error: "",
  }),

  actions: {
    async applyCollection(collection: TaskCollection) {
      this.tasks = collection.tasks;
      this.myDay = collection.myDay;
      this.myWeek = collection.myWeek;
      this.pending = collection.pending;
      this.overdue = collection.overdue;
      this.upcoming = collection.upcoming;
      this.withReminders = collection.withReminders;
      this.completed = collection.completed;
      this.checklistItems = collection.checklistItems;
      this.viewCounts = countsFromCollection(collection);
      this.isReady = true;
      this.error = "";
      const notifications = useNotificationStore();
      if (!notifications.nativeLaunchReminderId) {
        await notifications.hydrateLaunchContext();
      }
      useBadgeStore().applySnapshot(collection.badge);
      notifications.applyPendingReminders(
        await syncTaskReminders(collection.tasks, collection.reminders, {
          fireDueReminderIds: notifications.nativeLaunchReminderId ? [notifications.nativeLaunchReminderId] : [],
        }),
      );
    },

    async applyTaskList(result: TaskListResult, target: "myDay" | "myWeek" | "pending" | "overdue" | "upcoming" | "withReminders" | "completed") {
      this[target] = result.tasks;
      this.checklistItems = mergeChecklistItemsForTasks(this.checklistItems, result.checklistItems, result.tasks.map((task) => task.id));
      this.isReady = true;
      this.error = "";
      const notifications = useNotificationStore();
      if (!notifications.nativeLaunchReminderId) {
        await notifications.hydrateLaunchContext();
      }
      useBadgeStore().applySnapshot(result.badge);
      notifications.applyPendingReminders(
        await syncTaskReminders(result.tasks, result.reminders, {
          fireDueReminderIds: notifications.nativeLaunchReminderId ? [notifications.nativeLaunchReminderId] : [],
        }),
      );
    },

    applyViewCounts(counts: TaskViewCounts) {
      const { badge, ...viewCounts } = counts;
      this.viewCounts = viewCounts;
      useBadgeStore().applySnapshot(badge);
      this.error = "";
    },

    resetLocal() {
      this.tasks = [];
      this.myDay = [];
      this.myWeek = [];
      this.pending = [];
      this.overdue = [];
      this.upcoming = [];
      this.withReminders = [];
      this.completed = [];
      this.checklistItems = [];
      this.viewCounts = emptyViewCounts();
      this.timelinesByTaskId = {};
      this.selectedTaskId = "";
      this.isReady = false;
      this.error = "";
    },

    async hydrate() {
      try {
        await this.applyCollection(await listTasks());
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Abra o cofre para carregar tarefas.";
      }
    },

    async hydrateViewCounts() {
      try {
        this.applyViewCounts(await getTaskViewCounts());
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel carregar contadores de tarefas.";
      }
    },

    async hydrateToday(options?: TaskListOptions) {
      try {
        await this.applyTaskList(await listTodayTasks(options), "myDay");
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel carregar tarefas de hoje.";
      }
    },

    async hydrateWeek(options?: TaskListOptions) {
      try {
        await this.applyTaskList(await listWeekTasks(options), "myWeek");
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel carregar tarefas da semana.";
      }
    },

    async hydratePending(options?: TaskListOptions) {
      try {
        await this.applyTaskList(await listPendingTasks(options), "pending");
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel carregar tarefas pendentes.";
      }
    },

    async hydrateOverdue(options?: TaskListOptions) {
      try {
        await this.applyTaskList(await listOverdueTasks(options), "overdue");
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel carregar tarefas vencidas.";
      }
    },

    async hydrateUpcoming(options?: TaskListOptions) {
      try {
        await this.applyTaskList(await listUpcomingTasks(options), "upcoming");
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel carregar proximas tarefas.";
      }
    },

    async hydrateWithReminders(options?: TaskListOptions) {
      try {
        await this.applyTaskList(await listReminderTasks(options), "withReminders");
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel carregar tarefas com lembrete.";
      }
    },

    async hydrateCompleted(options?: TaskListOptions) {
      try {
        await this.applyTaskList(await listCompletedTasks(options), "completed");
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel carregar tarefas concluidas.";
      }
    },

    async create(input: CreateTaskInput) {
      try {
        await this.applyCollection(await createTask(input));
        return true;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel criar a tarefa.";
        return false;
      }
    },

    async update(id: string, input: UpdateTaskInput) {
      try {
        await this.applyCollection(await updateTask(id, input));
        return true;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel atualizar a tarefa.";
        return false;
      }
    },

    async setCompleted(id: string, completed: boolean) {
      try {
        await this.applyCollection(await setTaskCompleted(id, completed));
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel atualizar a tarefa.";
      }
    },

    async delete(id: string) {
      try {
        await this.applyCollection(await deleteTask(id));
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel remover a tarefa.";
      }
    },

    async createChecklistItem(input: CreateChecklistItemInput) {
      try {
        await this.applyCollection(await createChecklistItem(input));
        return true;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel criar o item.";
        return false;
      }
    },

    async updateChecklistItem(id: string, input: UpdateChecklistItemInput) {
      try {
        await this.applyCollection(await updateChecklistItem(id, input));
        return true;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel atualizar o item.";
        return false;
      }
    },

    async setChecklistItemCompleted(id: string, completed: boolean) {
      try {
        await this.applyCollection(await setChecklistItemCompleted(id, completed));
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel atualizar o item.";
      }
    },

    async deleteChecklistItem(id: string) {
      try {
        await this.applyCollection(await deleteChecklistItem(id));
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel remover o item.";
      }
    },

    async loadTimeline(taskId: string) {
      try {
        const timeline = await listTaskTimeline(taskId);
        this.timelinesByTaskId[taskId] = timeline;
        this.error = "";
        return timeline;
      } catch (error) {
        this.error = error instanceof Error ? error.message : "Nao foi possivel carregar a timeline da tarefa.";
        return null;
      }
    },

    selectTask(taskId: string) {
      this.selectedTaskId = taskId;
    },
  },
});

function mergeChecklistItemsForTasks(existing: ChecklistItem[], incoming: ChecklistItem[], taskIds: string[]) {
  const refreshedTaskIds = new Set(taskIds);

  return [
    ...existing.filter((item) => !refreshedTaskIds.has(item.taskId)),
    ...incoming,
  ];
}

function emptyViewCounts(): Omit<TaskViewCounts, "badge"> {
  return {
    today: 0,
    week: 0,
    pending: 0,
    overdue: 0,
    upcoming: 0,
    reminders: 0,
    completed: 0,
  };
}

function countsFromCollection(collection: TaskCollection): Omit<TaskViewCounts, "badge"> {
  return {
    today: collection.myDay.length,
    week: collection.myWeek.length,
    pending: collection.pending.length,
    overdue: collection.overdue.length,
    upcoming: collection.upcoming.length,
    reminders: collection.withReminders.length,
    completed: collection.completed.length,
  };
}
