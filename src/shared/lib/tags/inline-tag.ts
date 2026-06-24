export type ActiveInlineTag = {
	query: string;
	start: number;
	end: number;
};

export function findActiveInlineTag(
	value: string,
	caretPosition: number,
): ActiveInlineTag | null {
	const safeCaret = Math.max(0, Math.min(caretPosition, value.length));
	const beforeCaret = value.slice(0, safeCaret);
	const match = beforeCaret.match(/(?:^|\s)\+([^\s+]*)$/);

	if (!match) {
		return null;
	}

	const token = match[0].trimStart();
	const start = safeCaret - token.length;

	return {
		query: match[1],
		start,
		end: safeCaret,
	};
}

export function removeInlineTagToken(
	value: string,
	token: ActiveInlineTag,
): { value: string; caretPosition: number } {
	const before = value.slice(0, token.start);
	const after = value.slice(token.end);
	const needsSpace =
		before.length > 0 &&
		after.length > 0 &&
		!/\s$/.test(before) &&
		!/^\s/.test(after);
	const nextValue = `${before}${needsSpace ? " " : ""}${after}`
		.replace(/\s{2,}/g, " ")
		.trimStart();

	return {
		value: nextValue,
		caretPosition: Math.min(
			nextValue.length,
			before.trimStart().length + (needsSpace ? 1 : 0),
		),
	};
}

export function normalizeTagName(value: string) {
	return value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}
