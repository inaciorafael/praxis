import type { DayStatusOptions, DayStatusSnapshot } from "@/shared/types/day-status";
import type { Task } from "@/shared/types/task";

const DEFAULT_WARNING_WINDOW_MINUTES = 60;

export function buildDayStatus(tasks: Task[], now = new Date(), options: DayStatusOptions = {}): DayStatusSnapshot {
  const warningWindowMinutes = options.warningWindowMinutes ?? DEFAULT_WARNING_WINDOW_MINUTES;
  const pendingTodayTasks = tasks.filter((task) => task.status === "pending");
  const dueTasks = pendingTodayTasks
    .map((task) => ({ task, dueAt: parseDate(task.dueAt) }))
    .filter((item): item is { task: Task; dueAt: Date } => item.dueAt !== null)
    .sort((left, right) => left.dueAt.getTime() - right.dueAt.getTime());
  const reminderTasks = pendingTodayTasks
    .map((task) => ({ task, reminderAt: parseDate(task.reminderAt) }))
    .filter((item): item is { task: Task; reminderAt: Date } => item.reminderAt !== null && item.reminderAt.getTime() >= now.getTime())
    .sort((left, right) => left.reminderAt.getTime() - right.reminderAt.getTime());

  const overdue = dueTasks.filter(({ dueAt }) => dueAt.getTime() <= now.getTime());
  const dueSoon = dueTasks.filter(({ dueAt }) => {
    const minutes = minutesBetween(now, dueAt);
    return minutes > 0 && minutes <= warningWindowMinutes;
  });
  const nextDue = dueTasks.find(({ dueAt }) => dueAt.getTime() > now.getTime()) ?? null;
  const nextReminder = reminderTasks[0] ?? null;

  const base = {
    clockLabel: formatClock(now),
    dateLabel: formatDate(now),
    pendingTodayCount: pendingTodayTasks.length,
    overdueCount: overdue.length,
    dueSoonCount: dueSoon.length,
    nextDueTask: nextDue?.task ?? null,
    nextReminderTask: nextReminder?.task ?? null,
    minutesUntilNextDue: nextDue ? minutesBetween(now, nextDue.dueAt) : null,
    minutesUntilNextReminder: nextReminder ? minutesBetween(now, nextReminder.reminderAt) : null,
    checkedAt: now.toISOString(),
  };

  if (overdue.length > 0) {
    return {
      ...base,
      level: "critical",
      reason: "overdue",
      title: pluralize(overdue.length, "tarefa vencida", "tarefas vencidas"),
      message: "Resolva ou reagende para limpar o alerta do dia.",
    };
  }

  if (dueSoon.length > 0 && nextDue) {
    return {
      ...base,
      level: "warning",
      reason: "due-soon",
      title: `${nextDue.task.title} vence em ${formatMinutes(base.minutesUntilNextDue ?? 0)}`,
      message: pluralize(dueSoon.length, "tarefa vence em breve", "tarefas vencem em breve"),
    };
  }

  if (pendingTodayTasks.length > 0) {
    return {
      ...base,
      level: "normal",
      reason: "pending",
      title: pluralize(pendingTodayTasks.length, "tarefa hoje", "tarefas hoje"),
      message: nextReminder ? `Proximo lembrete em ${formatMinutes(base.minutesUntilNextReminder ?? 0)}` : "Sem urgencias no momento.",
    };
  }

  return {
    ...base,
    level: "normal",
    reason: "clear",
    title: "Dia limpo",
    message: "Nenhuma tarefa pendente para hoje.",
  };
}

function parseDate(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function minutesBetween(start: Date, end: Date) {
  return Math.max(0, Math.ceil((end.getTime() - start.getTime()) / 60_000));
}

function formatClock(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

function formatDate(value: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  }).format(value);
}

function formatMinutes(value: number) {
  if (value < 60) {
    return `${value} min`;
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes > 0 ? `${hours}h ${minutes}min` : `${hours}h`;
}

function pluralize(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}
