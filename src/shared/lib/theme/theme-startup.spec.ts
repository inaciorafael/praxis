import { beforeEach, describe, expect, it, vi } from "vitest";
import startupHtml from "../../../../index.html?raw";
import { APP_THEMES } from "./theme.catalog";

const bootstrap = startupHtml.match(/<script>([\s\S]*?)<\/script>/)?.[1];

function runBootstrap() {
	if (!bootstrap) throw new Error("Startup theme script is missing");
	new Function(bootstrap)();
}

describe("startup theme before Vue mounts", () => {
	beforeEach(() => {
		localStorage.clear();
		delete document.documentElement.dataset.theme;
	});

	it.each(APP_THEMES)("paints $id with the matching native scheme", ({ id, colorScheme }) => {
		localStorage.setItem("praxis:theme", id);
		runBootstrap();
		expect(document.documentElement.dataset.theme).toBe(id);
		expect(document.documentElement.style.colorScheme).toBe(colorScheme);
	});

	it.each(["unknown", "__proto__", "constructor"])("ignores invalid stored value %s", (value) => {
		localStorage.setItem("praxis:theme", value);
		runBootstrap();
		expect(document.documentElement.dataset.theme).toBe("light");
	});

	it("still starts when storage access is blocked", () => {
		const read = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
			throw new Error("Storage unavailable");
		});
		try {
			expect(runBootstrap).not.toThrow();
			expect(document.documentElement.dataset.theme).toBe("light");
		} finally {
			read.mockRestore();
		}
	});
});
