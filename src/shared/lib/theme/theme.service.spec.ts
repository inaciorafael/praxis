import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/app", () => ({
	setTheme: vi.fn().mockResolvedValue(undefined),
}));

import { applyStoredTheme, applyTheme } from "./theme.service";

describe("theme.service", () => {
	beforeEach(() => {
		localStorage.clear();
		delete document.documentElement.dataset.theme;
	});

	it("applies and persists the dark theme", () => {
		applyTheme("dark");

		expect(document.documentElement.dataset.theme).toBe("dark");
		expect(document.documentElement.style.colorScheme).toBe("dark");
		expect(localStorage.getItem("praxis:theme")).toBe("dark");
	});

	it("restores only supported themes", () => {
		localStorage.setItem("praxis:theme", "unexpected");
		applyStoredTheme();

		expect(document.documentElement.dataset.theme).toBe("light");
	});
});
