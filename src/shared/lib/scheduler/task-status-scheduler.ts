import type {
  SchedulerTask,
  TaskStatusScheduler,
  TaskStatusSchedulerOptions,
} from "./task-status-scheduler.types";

const MAX_TIMEOUT_MS = 2_147_483_647;
const RESYNC_GRACE_MS = 250;

export function createTaskStatusScheduler(
  options: TaskStatusSchedulerOptions,
): TaskStatusScheduler {
  let timerId: ReturnType<typeof setTimeout> | null = null;
  let started = false;
  let runningRefresh = false;

  function clearTimer() {
    if (!timerId) {
      return;
    }

    clearTimeout(timerId);
    timerId = null;
  }

  function scheduleNext() {
    clearTimer();

    if (!started) {
      return;
    }

    const nextDueAt = getNextDueAt(options.getTasks());

    if (!nextDueAt) {
      return;
    }

    const delay = Math.max(nextDueAt - Date.now() + RESYNC_GRACE_MS, 0);
    const safeDelay = Math.min(delay, MAX_TIMEOUT_MS);

    timerId = setTimeout(() => {
      void refreshAndReschedule();
    }, safeDelay);
  }

  async function refreshAndReschedule() {
    if (!started || runningRefresh) {
      return;
    }

    runningRefresh = true;

    try {
      await options.onDueStateMayHaveChanged();
    } finally {
      runningRefresh = false;

      if (started) {
        scheduleNext();
      }
    }
  }

  function start() {
    if (started) {
      return;
    }

    started = true;
    scheduleNext();
  }

  function stop() {
    started = false;
    clearTimer();
  }

  function reschedule() {
    if (!started) {
      return;
    }

    scheduleNext();
  }

  return {
    start,
    stop,
    reschedule,
  };
}

function getNextDueAt(tasks: SchedulerTask[]) {
  const now = Date.now();

  return tasks
    .filter((task) => task.status === "pending")
    .map((task) => parseDueAt(task.dueAt))
    .filter((dueAt): dueAt is number => dueAt !== null && dueAt > now)
    .sort((left, right) => left - right)[0] ?? null;
}

function parseDueAt(value: string | null) {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : null;
}
