import { describe, expect, it } from "vitest";

import { formatCalendarDateTime, formatDate } from "./date-format";

describe("date-format", () => {
	it("formats dates in day/month/year order", () => {
		expect(formatDate("2024-04-16T15:30:00Z")).toBe("16/04/2024");
	});

	it("never falls back to the US calendar date format", () => {
		const formatted = formatCalendarDateTime("2024-04-16T15:30:00Z");

		expect(formatted).toContain("16/04/2024");
		expect(formatted).not.toContain("04/16/2024");
	});

	it("returns an empty value for invalid dates", () => {
		expect(formatCalendarDateTime("invalid")).toBe("");
		expect(formatDate(null)).toBe("");
	});
});
