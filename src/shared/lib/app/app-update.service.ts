import { relaunch } from "@tauri-apps/plugin-process";
import { check, type DownloadEvent, type Update } from "@tauri-apps/plugin-updater";

export type AppUpdateInfo = {
	currentVersion: string;
	version: string;
	date: string | null;
	body: string | null;
};

export type UpdateDownloadProgress = {
	downloadedBytes: number;
	totalBytes: number | null;
	percentage: number | null;
};

let pendingUpdate: Update | null = null;

export async function checkForAppUpdate() {
	const update = await check();
	pendingUpdate = update;

	return update ? toUpdateInfo(update) : null;
}

export async function downloadAndInstallAppUpdate(
	onProgress?: (progress: UpdateDownloadProgress) => void,
) {
	if (!pendingUpdate) {
		pendingUpdate = await check();
	}

	if (!pendingUpdate) {
		return false;
	}

	let downloadedBytes = 0;
	let totalBytes: number | null = null;

	await pendingUpdate.downloadAndInstall((event) => {
		const progress = readDownloadProgress(event, downloadedBytes, totalBytes);
		downloadedBytes = progress.downloadedBytes;
		totalBytes = progress.totalBytes;
		onProgress?.(progress);
	});

	pendingUpdate = null;
	await relaunch();
	return true;
}

function toUpdateInfo(update: Update): AppUpdateInfo {
	return {
		currentVersion: update.currentVersion,
		version: update.version,
		date: update.date ?? null,
		body: update.body ?? null,
	};
}

function readDownloadProgress(
	event: DownloadEvent,
	downloadedBytes: number,
	totalBytes: number | null,
): UpdateDownloadProgress {
	if (event.event === "Started") {
		return {
			downloadedBytes: 0,
			totalBytes: event.data.contentLength ?? null,
			percentage: null,
		};
	}

	if (event.event === "Progress") {
		const nextDownloadedBytes = downloadedBytes + event.data.chunkLength;

		return {
			downloadedBytes: nextDownloadedBytes,
			totalBytes,
			percentage: totalBytes
				? Math.round((nextDownloadedBytes / totalBytes) * 100)
				: null,
		};
	}

	return {
		downloadedBytes,
		totalBytes,
		percentage: 100,
	};
}
