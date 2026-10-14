import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/app", () => ({
	setTheme: vi.fn().mockResolvedValue(undefined),
}));

import { applyStoredTheme, applyTheme } from "./theme.service";
import { APP_THEMES } from "./theme.catalog";
import { setTheme as setNativeTheme } from "@tauri-apps/api/app";

describe("theme.service", () => {
	beforeEach(() => {
		localStorage.clear();
		vi.clearAllMocks();
		delete document.documentElement.dataset.theme;
	});

	it.each(APP_THEMES)("restores $id and maps the native theme", ({ id, colorScheme }) => {
		localStorage.setItem("praxis:theme", id);
		applyStoredTheme();
		expect(document.documentElement.dataset.theme).toBe(id);
		expect(document.documentElement.style.colorScheme).toBe(colorScheme);
		expect(setNativeTheme).toHaveBeenCalledWith(colorScheme);
	});

	it("applies the preference when the storage mirror is unavailable", () => {
		const write = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
			throw new Error("Storage unavailable");
		});
		try {
			expect(() => applyTheme("forest")).not.toThrow();
			expect(document.documentElement.dataset.theme).toBe("forest");
			expect(setNativeTheme).toHaveBeenCalledWith("dark");
		} finally {
			write.mockRestore();
		}
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
