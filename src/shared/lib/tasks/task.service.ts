import { invoke } from "@tauri-apps/api/core";

import type { CreateChecklistItemInput, UpdateChecklistItemInput } from "@/shared/types/checklist";
import type { TaskTimeline } from "@/shared/types/lifecycle";
import type { CreateTaskInput, TaskCollection, TaskListOptions, TaskListResult, TaskViewCounts, UpdateTaskInput } from "@/shared/types/task";
import { todayLocalDate, tomorrowLocalDate } from "@/shared/lib/tasks/task.rules";

export async function listTasks() {
  return invoke<TaskCollection>("list_tasks", { today: todayLocalDate() });
}

export async function generateDueRecurringTasks() {
  return invoke<TaskCollection>("generate_due_recurring_tasks", { today: todayLocalDate() });
}

export async function listTodayTasks(options?: TaskListOptions) {
  return invoke<TaskListResult>("list_today_tasks", { today: todayLocalDate(), options });
}

export async function listWeekTasks(options?: TaskListOptions, startDate = tomorrowLocalDate()) {
  return invoke<TaskListResult>("list_week_tasks", { today: startDate, options });
}

export async function listPendingTasks(options?: TaskListOptions) {
  return invoke<TaskListResult>("list_pending_tasks", { today: todayLocalDate(), options });
}

export async function listOverdueTasks(options?: TaskListOptions) {
  return invoke<TaskListResult>("list_overdue_tasks", { today: todayLocalDate(), options });
}

export async function listUpcomingTasks(options?: TaskListOptions) {
  return invoke<TaskListResult>("list_upcoming_tasks", { today: todayLocalDate(), options });
}

export async function listReminderTasks(options?: TaskListOptions) {
  return invoke<TaskListResult>("list_reminder_tasks", { today: todayLocalDate(), options });
}

export async function listCompletedTasks(options?: TaskListOptions) {
  return invoke<TaskListResult>("list_completed_tasks", { today: todayLocalDate(), options });
}

export async function getTaskViewCounts(weekStartDate = tomorrowLocalDate()) {
  return invoke<TaskViewCounts>("get_task_view_counts", { today: todayLocalDate(), weekStartDate });
}

export async function createTask(input: CreateTaskInput) {
  return invoke<TaskCollection>("create_task", {
    input,
    today: todayLocalDate(),
  });
}

export async function updateTask(id: string, input: UpdateTaskInput) {
  return invoke<TaskCollection>("update_task", {
    id,
    input,
    today: todayLocalDate(),
  });
}

export async function setTaskCompleted(id: string, completed: boolean) {
  return invoke<TaskCollection>("set_task_completed", {
    id,
    completed,
    today: todayLocalDate(),
  });
}

export async function deleteTask(id: string) {
  return invoke<TaskCollection>("delete_task", {
    id,
    today: todayLocalDate(),
  });
}

export async function createChecklistItem(input: CreateChecklistItemInput) {
  return invoke<TaskCollection>("create_checklist_item", {
    input,
    today: todayLocalDate(),
  });
}

export async function updateChecklistItem(id: string, input: UpdateChecklistItemInput) {
  return invoke<TaskCollection>("update_checklist_item", {
    id,
    input,
    today: todayLocalDate(),
  });
}

export async function setChecklistItemCompleted(id: string, completed: boolean) {
  return invoke<TaskCollection>("set_checklist_item_completed", {
    id,
    completed,
    today: todayLocalDate(),
  });
}

export async function deleteChecklistItem(id: string) {
  return invoke<TaskCollection>("delete_checklist_item", {
    id,
    today: todayLocalDate(),
  });
}

export async function listTaskTimeline(taskId: string) {
  return invoke<TaskTimeline>("list_task_timeline", { taskId });
}
