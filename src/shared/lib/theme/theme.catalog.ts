import type { AppTheme } from "@/shared/types/app";

export const APP_THEMES = [
	{ id: "light", colorScheme: "light", labelKey: "settings.paper", hintKey: "settings.paperHint" },
	{ id: "dark", colorScheme: "dark", labelKey: "settings.dark", hintKey: "settings.darkHint" },
	{ id: "sepia", colorScheme: "light", labelKey: "settings.sepia", hintKey: "settings.sepiaHint" },
	{ id: "forest", colorScheme: "dark", labelKey: "settings.forest", hintKey: "settings.forestHint" },
	{ id: "midnight", colorScheme: "dark", labelKey: "settings.midnight", hintKey: "settings.midnightHint" },
] as const satisfies readonly {
	id: AppTheme;
	colorScheme: "light" | "dark";
	labelKey: string;
	hintKey: string;
}[];

export function resolveTheme(value: unknown) {
	return APP_THEMES.find((theme) => theme.id === value) ?? APP_THEMES[0];
}
