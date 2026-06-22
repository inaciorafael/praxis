import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTaskStatusScheduler } from "./task-status-scheduler";
import type { SchedulerTask } from "./task-status-scheduler.types";

describe("createTaskStatusScheduler", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-06-18T12:00:00.000Z"));
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("refreshes when the next pending dueAt is reached", async () => {
		const tasks: SchedulerTask[] = [
			task({ id: "later", dueAt: "2026-06-18T12:10:00.000Z" }),
			task({ id: "next", dueAt: "2026-06-18T12:05:00.000Z" }),
			task({
				id: "completed",
				status: "completed",
				dueAt: "2026-06-18T12:01:00.000Z",
			}),
		];
		const onDueStateMayHaveChanged = vi.fn();
		const scheduler = createTaskStatusScheduler({
			getTasks: () => tasks,
			onDueStateMayHaveChanged,
		});

		scheduler.start();
		await vi.advanceTimersByTimeAsync(5 * 60 * 1000 + 249);

		expect(onDueStateMayHaveChanged).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);

		expect(onDueStateMayHaveChanged).toHaveBeenCalledTimes(1);
	});

	it("does not schedule completed, overdue, or undated tasks", async () => {
		const scheduler = createTaskStatusScheduler({
			getTasks: () => [
				task({ id: "overdue", dueAt: "2026-06-18T11:59:00.000Z" }),
				task({
					id: "completed",
					status: "completed",
					dueAt: "2026-06-18T12:01:00.000Z",
				}),
				task({ id: "undated", dueAt: null }),
			],
			onDueStateMayHaveChanged: vi.fn(),
		});

		scheduler.start();
		await vi.runOnlyPendingTimersAsync();

		expect(vi.getTimerCount()).toBe(0);
	});
});

function task(overrides: Partial<SchedulerTask>): SchedulerTask {
	return {
		id: overrides.id ?? "task",
		status: overrides.status ?? "pending",
		dueAt: overrides.dueAt ?? null,
		isOverdue: overrides.isOverdue ?? false,
	};
}
