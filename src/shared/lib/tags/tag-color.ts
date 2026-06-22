export type TagColorKey =
	| "clay"
	| "olive"
	| "slate"
	| "mauve"
	| "ochre"
	| "moss"
	| "plum"
	| "rust"
	| "graphite"
	| "rosewood";

export type TagColorToken = {
	key: TagColorKey;
	label: string;
	background: string;
	text: string;
};

export const praxisTagColors: TagColorToken[] = [
	{
		key: "clay",
		label: "Barro",
		background: "rgba(154, 98, 70, 0.14)",
		text: "#9A6246",
	},
	{
		key: "olive",
		label: "Oliva",
		background: "rgba(104, 122, 82, 0.16)",
		text: "#687A52",
	},
	{
		key: "slate",
		label: "Ardosia",
		background: "rgba(95, 111, 115, 0.15)",
		text: "#5F6F73",
	},
	{
		key: "mauve",
		label: "Malva",
		background: "rgba(138, 102, 120, 0.15)",
		text: "#8A6678",
	},
	{
		key: "ochre",
		label: "Ocre",
		background: "rgba(155, 118, 45, 0.16)",
		text: "#9B762D",
	},
	{
		key: "moss",
		label: "Musgo",
		background: "rgba(95, 115, 93, 0.16)",
		text: "#5F735D",
	},
	{
		key: "plum",
		label: "Ameixa",
		background: "rgba(117, 101, 142, 0.15)",
		text: "#75658E",
	},
	{
		key: "rust",
		label: "Ferrugem",
		background: "rgba(168, 95, 31, 0.14)",
		text: "#A85F1F",
	},
	{
		key: "graphite",
		label: "Grafite",
		background: "rgba(94, 88, 80, 0.12)",
		text: "#5E5850",
	},
	{
		key: "rosewood",
		label: "Rosewood",
		background: "rgba(155, 95, 92, 0.15)",
		text: "#9B5F5C",
	},
];

export function pickTagColorByName(name: string): TagColorToken {
	const normalizedName = name.trim().toLocaleLowerCase();
	const hash = hashTagName(normalizedName || "tag");
	return praxisTagColors[hash % praxisTagColors.length];
}

function hashTagName(value: string) {
	let hash = 0;

	for (const character of value.normalize("NFKD")) {
		hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
	}

	return hash;
}
