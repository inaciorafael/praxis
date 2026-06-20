import { describe, expect, it } from "vitest";

import { buildDayStatus } from "@/shared/lib/tasks/day-status.service";
import type { Task } from "@/shared/types/task";

const NOW = new Date("2026-06-18T14:00:00.000Z");

describe("buildDayStatus", () => {
  it("returns critical when a pending task is overdue", () => {
    const status = buildDayStatus([task({ dueAt: "2026-06-18T13:50:00.000Z" })], NOW);

    expect(status.level).toBe("critical");
    expect(status.reason).toBe("overdue");
    expect(status.overdueCount).toBe(1);
    expect(status.title).toBe("1 tarefa vencida");
  });

  it("returns warning when a pending task is due soon", () => {
    const status = buildDayStatus([task({ title: "Enviar proposta", dueAt: "2026-06-18T14:30:00.000Z" })], NOW);

    expect(status.level).toBe("warning");
    expect(status.reason).toBe("due-soon");
    expect(status.dueSoonCount).toBe(1);
    expect(status.minutesUntilNextDue).toBe(30);
    expect(status.title).toContain("Enviar proposta");
  });

  it("returns normal pending state when tasks have no immediate urgency", () => {
    const status = buildDayStatus(
      [
        task({
          dueAt: "2026-06-18T17:00:00.000Z",
          reminderAt: "2026-06-18T15:00:00.000Z",
        }),
      ],
      NOW,
    );

    expect(status.level).toBe("normal");
    expect(status.reason).toBe("pending");
    expect(status.pendingTodayCount).toBe(1);
    expect(status.minutesUntilNextReminder).toBe(60);
  });

  it("returns clear when there are no pending tasks", () => {
    const status = buildDayStatus([], NOW);

    expect(status.level).toBe("normal");
    expect(status.reason).toBe("clear");
    expect(status.title).toBe("Dia limpo");
  });

  it("ignores completed tasks when calculating urgency", () => {
    const status = buildDayStatus([task({ status: "completed", dueAt: "2026-06-18T13:30:00.000Z" })], NOW);

    expect(status.level).toBe("normal");
    expect(status.reason).toBe("clear");
    expect(status.overdueCount).toBe(0);
  });
});

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? "task-1",
    title: overrides.title ?? "Task",
    notes: overrides.notes ?? null,
    status: overrides.status ?? "pending",
    plannedFor: overrides.plannedFor ?? "2026-06-18",
    dueAt: overrides.dueAt ?? null,
    reminderAt: overrides.reminderAt ?? null,
    recurrenceId: overrides.recurrenceId ?? null,
    occurrenceDate: overrides.occurrenceDate ?? null,
    completedAt: overrides.completedAt ?? null,
    createdAt: overrides.createdAt ?? "2026-06-18T12:00:00.000Z",
    updatedAt: overrides.updatedAt ?? "2026-06-18T12:00:00.000Z",
    progress: overrides.progress ?? {
      totalItems: 0,
      completedItems: overrides.status === "completed" ? 1 : 0,
      percentage: overrides.status === "completed" ? 100 : 0,
    },
  };
}
