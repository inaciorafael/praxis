export type TaskRefreshPoint = {
	id: string;
	dueAt: string | null;
};

export type TaskRefreshSchedulerOptions = {
	getRefreshPoints: () => TaskRefreshPoint[];
	refresh: () => Promise<void>;
	maxFallbackMs?: number;
};

export function createTaskRefreshScheduler(
	options: TaskRefreshSchedulerOptions,
) {
	let timer: number | null = null;
	let lastTick = Date.now();

	const maxFallbackMs = options.maxFallbackMs ?? 10 * 60 * 1000;

	async function runRefresh() {
		await options.refresh();
		scheduleNext();
	}

	function scheduleNext() {
		stopTimer();

		const now = Date.now();
		const nextDueAt = options
			.getRefreshPoints()
			.map((point) => point.dueAt)
			.filter(Boolean)
			.map((value) => new Date(value as string).getTime())
			.filter((time) => time > now)
			.sort((a, b) => a - b)[0];

		const nextRefreshAt = Math.min(
			nextDueAt ?? Infinity,
			getNextLocalMidnight().getTime(),
			now + maxFallbackMs,
		);

		const delay = Math.max(1000, nextRefreshAt - now + 1000);

		timer = window.setTimeout(runRefresh, delay);
	}

	function stopTimer() {
		if (timer !== null) {
			window.clearTimeout(timer);
			timer = null;
		}
	}

	function handleVisibilityChange() {
		if (document.visibilityState === "visible") {
			void runRefresh();
		}
	}

	function handleFocus() {
		void runRefresh();
	}

	function detectSleepResume() {
		const now = Date.now();

		if (now - lastTick > 90_000) {
			void runRefresh();
		}

		lastTick = now;
	}

	let sleepInterval: number | null = null;

	return {
		start() {
			scheduleNext();
			window.addEventListener("focus", handleFocus);
			document.addEventListener("visibilitychange", handleVisibilityChange);
			sleepInterval = window.setInterval(detectSleepResume, 60_000);
		},

		reschedule() {
			scheduleNext();
		},

		stop() {
			stopTimer();
			window.removeEventListener("focus", handleFocus);
			document.removeEventListener("visibilitychange", handleVisibilityChange);

			if (sleepInterval !== null) {
				window.clearInterval(sleepInterval);
				sleepInterval = null;
			}
		},
	};
}

function getNextLocalMidnight() {
	const value = new Date();
	value.setHours(24, 0, 0, 0);
	return value;
}
