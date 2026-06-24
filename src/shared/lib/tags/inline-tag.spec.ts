import { describe, expect, it } from "vitest";

import {
	findActiveInlineTag,
	normalizeTagName,
	removeInlineTagToken,
} from "@/shared/lib/tags/inline-tag";

describe("inline task tags", () => {
	it("finds a tag command at the cursor in the middle of a title", () => {
		expect(findActiveInlineTag("Fazer compras +wor amanhã", 18)).toEqual({
			query: "wor",
			start: 14,
			end: 18,
		});
	});

	it("does not treat plus signs inside words as tag commands", () => {
		expect(findActiveInlineTag("Revisar C++ hoje", 10)).toBeNull();
	});

	it("removes the command without joining surrounding words", () => {
		const token = findActiveInlineTag("Fazer +work compras", 11);

		expect(token).not.toBeNull();
		expect(removeInlineTagToken("Fazer +work compras", token!)).toEqual({
			value: "Fazer compras",
			caretPosition: 6,
		});
	});

	it("normalizes names for matching and duplicate prevention", () => {
		expect(normalizeTagName("  Trabalho   Profundo ")).toBe(
			"trabalho profundo",
		);
	});
});
