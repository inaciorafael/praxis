import { setTheme as setNativeTheme } from "@tauri-apps/api/app";

import type { AppTheme } from "@/shared/types/app";

const THEME_STORAGE_KEY = "praxis:theme";

export function applyTheme(theme: AppTheme) {
	document.documentElement.dataset.theme = theme;
	document.documentElement.style.colorScheme = theme;
	localStorage.setItem(THEME_STORAGE_KEY, theme);
	void setNativeTheme(theme).catch(() => undefined);
}

export function applyStoredTheme() {
	const theme = localStorage.getItem(THEME_STORAGE_KEY);
	applyTheme(theme === "dark" ? "dark" : "light");
}
