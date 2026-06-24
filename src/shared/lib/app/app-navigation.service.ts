import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type AppNavigationView =
	| "today"
	| "my-week"
	| "overdue"
	| "reminders"
	| "completed"
	| "archived"
	| "settings"
	| "help";

export type AppNavigationRequest = {
	view: AppNavigationView;
};

let pendingView: AppNavigationView | null = null;

export async function initializeAppNavigation(
	onRequest: (request: AppNavigationRequest) => void | Promise<void>,
): Promise<UnlistenFn> {
	const unlisten = await listen<AppNavigationRequest>(
		"praxis://app-navigation",
		(event) => onRequest(event.payload),
	);
	const initialRequest = await invoke<AppNavigationRequest | null>(
		"take_app_navigation_request",
	);

	if (initialRequest) {
		await onRequest(initialRequest);
	}

	return unlisten;
}

export function deferAppNavigation(view: AppNavigationView) {
	pendingView = view;
}

export function takeDeferredAppNavigation() {
	const view = pendingView;
	pendingView = null;
	return view;
}
