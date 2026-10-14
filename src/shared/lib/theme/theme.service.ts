import { setTheme as setNativeTheme } from "@tauri-apps/api/app";

import type { AppTheme } from "@/shared/types/app";
import { resolveTheme } from "./theme.catalog";

const THEME_STORAGE_KEY = "praxis:theme";

export function applyTheme(theme: AppTheme) {
	const selected = resolveTheme(theme);
	document.documentElement.dataset.theme = selected.id;
	document.documentElement.style.colorScheme = selected.colorScheme;
	try {
		localStorage.setItem(THEME_STORAGE_KEY, selected.id);
	} catch {
		// The backend preference still applies when the startup mirror is unavailable.
	}
	updateThemeColor();
	void setNativeTheme(selected.colorScheme).catch(() => undefined);
}

export function applyStoredTheme() {
	let theme: string | null = null;
	try {
		theme = localStorage.getItem(THEME_STORAGE_KEY);
	} catch {
		// Storage access can be disabled by the host.
	}
	applyTheme(resolveTheme(theme).id);
}

function updateThemeColor() {
	requestAnimationFrame(() => {
		const paperColor = getComputedStyle(document.documentElement)
			.getPropertyValue("--paper")
			.trim();
		const metaThemeColor = document.querySelector<HTMLMetaElement>(
			'meta[name="theme-color"]',
		);

		if (paperColor && metaThemeColor) {
			metaThemeColor.content = paperColor;
		}
	});
}
