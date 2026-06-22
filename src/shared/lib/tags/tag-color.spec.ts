import { describe, expect, it } from "vitest";

import { pickTagColorByName } from "@/shared/lib/tags/tag-color";

describe("pickTagColorByName", () => {
	it("returns the same color for the same normalized tag name", () => {
		expect(pickTagColorByName("Work")).toEqual(pickTagColorByName(" work "));
	});

	it("returns an e-ink background and text color", () => {
		const color = pickTagColorByName("personal");

		expect(color.background).toMatch(/^rgba\(/);
		expect(color.text).toMatch(/^#[0-9A-F]{6}$/);
	});
});
