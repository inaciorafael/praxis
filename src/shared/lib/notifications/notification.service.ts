import {
  isPermissionGranted,
  onAction,
  requestPermission,
  registerActionTypes,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import type { Options } from "@tauri-apps/plugin-notification";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWindow } from "@tauri-apps/api/window";

import type {
  PendingReminder,
  PersistedReminder,
  NotificationInteraction,
  NotificationLaunchContext,
  ReminderId,
  ReminderInput,
  ReminderResult,
} from "@/shared/types/notification";
import type { Task } from "@/shared/types/task";

const MAX_INT_32 = 2_147_483_647;
const TASK_REMINDER_ACTION_TYPE = "praxis-task-reminder";
const ACTION_OPEN_TASK = "open-task";
const ACTION_COMPLETE_TASK = "complete-task";
const timers = new Map<ReminderId, number>();
let interactionsInitialized = false;
let nativeLaunchReminderId: string | null = null;

type SyncTaskReminderOptions = {
  fireDueReminderIds?: string[];
};

type NotificationInteractionHandlers = {
  onOpenTask?: (interaction: NotificationInteraction) => void | Promise<void>;
  onCompleteTask?: (interaction: NotificationInteraction) => void | Promise<void>;
  onNativeLaunch?: (context: NotificationLaunchContext) => void | Promise<void>;
};

export async function getNotificationPermission(): Promise<boolean> {
  return isPermissionGranted();
}

export async function requestNotificationPermission(): Promise<boolean> {
  if (await isPermissionGranted()) {
    return true;
  }

  return (await requestPermission()) === "granted";
}

export async function notifyNow(input: ReminderInput): Promise<ReminderResult | null> {
  if (!(await requestNotificationPermission())) {
    return null;
  }

  const id = input.id ?? createReminderId();
  sendNotification(toNotificationOptions(input, id));

  return {
    id,
    title: input.title,
    body: input.body ?? "",
    scheduledAt: null,
  };
}

export async function scheduleReminder(input: ReminderInput): Promise<ReminderResult | null> {
  if (!input.scheduledAt) {
    return notifyNow(input);
  }

  if (!(await requestNotificationPermission())) {
    return null;
  }

  const id = input.id ?? createReminderId();
  const date = parseScheduledDate(input.scheduledAt);
  const scheduledAt = date.toISOString();
  const reminder = {
    id,
    reminderId: null,
    taskId: typeof input.payload?.taskId === "string" ? input.payload.taskId : null,
    title: input.title,
    body: input.body ?? "",
    scheduledAt,
  };

  persistPendingReminder(reminder);
  armReminder(reminder);

  return reminder;
}

export async function getPendingReminders(): Promise<PendingReminder[]> {
  const reminders = readTimerReminders();
  reminders.forEach((reminder) => armReminder(reminder));
  return reminders;
}

export async function cancelReminder(id: ReminderId): Promise<void> {
  clearReminderTimer(id);
  timerReminders = timerReminders.filter((reminder) => reminder.id !== id);
}

export async function cancelAllReminders(): Promise<void> {
  timers.forEach((timerId) => window.clearTimeout(timerId));
  timers.clear();
  timerReminders = [];
}

export async function syncTaskReminders(
  tasks: Task[],
  reminders: PersistedReminder[],
  options: SyncTaskReminderOptions = {},
): Promise<PendingReminder[]> {
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const fireDueReminderIds = new Set([
    ...(nativeLaunchReminderId ? [nativeLaunchReminderId] : []),
    ...(options.fireDueReminderIds ?? []),
  ]);
  const pending = reminders
    .filter((reminder) => reminder.status === "scheduled")
    .map((reminder) => toPendingTaskReminder(reminder, tasksById.get(reminder.taskId)))
    .filter((reminder): reminder is PendingReminder => reminder !== null)
    .sort((current, next) => compareScheduledAt(current, next));

  timerReminders.forEach((reminder) => clearReminderTimer(reminder.id));
  timerReminders = pending;
  timerReminders.forEach((reminder) => armReminder(reminder, { fireIfDue: shouldFireDueReminder(reminder, fireDueReminderIds) }));

  return timerReminders;
}

export async function listPersistedReminders(): Promise<PersistedReminder[]> {
  return invoke<PersistedReminder[]>("list_reminders");
}

export async function markReminderFired(id: string): Promise<PersistedReminder[]> {
  return invoke<PersistedReminder[]>("mark_reminder_fired", { id });
}

export async function getNotificationLaunchContext(): Promise<NotificationLaunchContext | null> {
  const context = await invoke<NotificationLaunchContext | null>("get_notification_launch_context");
  nativeLaunchReminderId = context?.reminderId ?? null;
  return context;
}

export async function clearNotificationLaunchContext(): Promise<void> {
  nativeLaunchReminderId = null;
  await invoke("clear_notification_launch_context");
}

export async function initializeNotificationInteractions(handlers: NotificationInteractionHandlers = {}) {
  if (interactionsInitialized) {
    return;
  }

  interactionsInitialized = true;

  await registerActionTypes([
    {
      id: TASK_REMINDER_ACTION_TYPE,
      actions: [
        {
          id: ACTION_OPEN_TASK,
          title: "Abrir",
          foreground: true,
        },
        {
          id: ACTION_COMPLETE_TASK,
          title: "Concluir",
          foreground: false,
        },
      ],
    },
  ]);

  await onAction(async (notification) => {
    const interaction = toInteraction(notification);
    await focusMainWindow();

    if (interaction.action === "complete") {
      await handlers.onCompleteTask?.(interaction);
      return;
    }

    await handlers.onOpenTask?.(interaction);
  });

  await listen<NotificationLaunchContext>("praxis://notification-launch", async (event) => {
    nativeLaunchReminderId = event.payload.reminderId;
    await handlers.onNativeLaunch?.(event.payload);
  });
}

function toNotificationOptions(input: ReminderInput, id: ReminderId): Options {
  return {
    id,
    title: input.title,
    body: input.body,
    group: input.group ?? "praxis-reminders",
    sound: input.sound,
    actionTypeId: input.payload?.source === "task" ? TASK_REMINDER_ACTION_TYPE : undefined,
    autoCancel: true,
    extra: {
      ...input.payload,
      app: "praxis",
    },
  };
}

function parseScheduledDate(value: Date | string): Date {
  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Data do lembrete invalida.");
  }

  return date;
}

function createReminderId(): ReminderId {
  const timestamp = Date.now() % MAX_INT_32;
  const random = Math.floor(Math.random() * 10_000);
  return (timestamp + random) % MAX_INT_32;
}

let timerReminders: PendingReminder[] = [];

function armReminder(reminder: PendingReminder, options: { fireIfDue?: boolean } = {}) {
  if (!reminder.scheduledAt || timers.has(reminder.id)) {
    return;
  }

  const delay = new Date(reminder.scheduledAt).getTime() - Date.now();

  if (delay <= 0) {
    if (options.fireIfDue) {
      void fireReminder(reminder);
    }

    return;
  }

  const timerId = window.setTimeout(() => {
    void fireReminder(reminder);
  }, delay);

  timers.set(reminder.id, timerId);
}

async function fireReminder(reminder: PendingReminder) {
  clearReminderTimer(reminder.id);

  if (!(await requestNotificationPermission())) {
    return;
  }

  sendNotification(
    toNotificationOptions(
      {
        title: reminder.title,
        body: reminder.body,
        group: "praxis-task-reminders",
        payload: {
          source: reminder.taskId ? "task" : "system",
          taskId: reminder.taskId ?? undefined,
          reminderId: reminder.reminderId ?? undefined,
        },
      },
      reminder.id,
    ),
  );

  if (reminder.reminderId) {
    await markReminderFired(reminder.reminderId);
  }

  timerReminders = timerReminders.filter((item) => item.id !== reminder.id);
}

function persistPendingReminder(reminder: PendingReminder) {
  timerReminders = timerReminders.filter((item) => item.id !== reminder.id);
  timerReminders.push(reminder);
  timerReminders.sort((current, next) => compareScheduledAt(current, next));
}

function readTimerReminders(): PendingReminder[] {
  return timerReminders.filter(isPendingReminder);
}

function clearReminderTimer(id: ReminderId) {
  const timerId = timers.get(id);

  if (timerId) {
    window.clearTimeout(timerId);
  }

  timers.delete(id);
}

function isPendingReminder(value: PendingReminder) {
  return typeof value.id === "number" && typeof value.title === "string";
}

function compareScheduledAt(current: PendingReminder, next: PendingReminder) {
  return new Date(current.scheduledAt ?? 0).getTime() - new Date(next.scheduledAt ?? 0).getTime();
}

function toPendingTaskReminder(reminder: PersistedReminder, task: Task | undefined): PendingReminder | null {
  if (!task || task.status !== "pending") {
    return null;
  }

  const scheduledAt = new Date(reminder.scheduledAt);

  if (Number.isNaN(scheduledAt.getTime())) {
    return null;
  }

  return {
    id: reminder.notificationId,
    reminderId: reminder.id,
    taskId: task.id,
    title: task.title,
    body: task.notes ?? "",
    scheduledAt: scheduledAt.toISOString(),
  };
}

function shouldFireDueReminder(reminder: PendingReminder, allowedReminderIds: Set<string>) {
  if (!reminder.scheduledAt || new Date(reminder.scheduledAt).getTime() > Date.now()) {
    return false;
  }

  return reminder.reminderId !== null && allowedReminderIds.has(reminder.reminderId);
}

function toInteraction(notification: Options): NotificationInteraction {
  const raw = notification as Options & {
    actionId?: string;
    action?: string;
    input?: string;
  };
  const extra = (notification.extra ?? {}) as Record<string, unknown>;
  const actionId = raw.actionId ?? raw.action ?? "";

  return {
    action: toInteractionAction(actionId),
    notificationId: typeof notification.id === "number" ? notification.id : null,
    reminderId: typeof extra.reminderId === "string" ? extra.reminderId : null,
    taskId: typeof extra.taskId === "string" ? extra.taskId : null,
    receivedAt: new Date().toISOString(),
  };
}

function toInteractionAction(actionId: string): NotificationInteraction["action"] {
  if (!actionId || actionId === ACTION_OPEN_TASK || actionId === "default") {
    return "open";
  }

  if (actionId === ACTION_COMPLETE_TASK) {
    return "complete";
  }

  if (actionId === "dismiss") {
    return "dismiss";
  }

  return "unknown";
}

async function focusMainWindow() {
  const window = getCurrentWindow();
  await window.unminimize();
  await window.show();
  await window.setFocus();
}
