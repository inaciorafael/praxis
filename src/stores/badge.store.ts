import { defineStore } from "pinia";

import {
	clearBadgeCount,
	getBadgeCount,
	setBadgeCount,
} from "@/shared/lib/badge/badge.service";
import type { BadgeSnapshot } from "@/shared/types/badge";

type BadgeStoreState = BadgeSnapshot & {
	isReady: boolean;
	error: string;
};

export const useBadgeStore = defineStore("badge", {
	state: (): BadgeStoreState => ({
		count: 0,
		visible: false,
		platform: "unknown",
		nativeBadgeSupported: false,
		persistsWhenClosed: false,
		isReady: false,
		error: "",
	}),

	actions: {
		applySnapshot(snapshot: BadgeSnapshot) {
			this.count = snapshot.count;
			this.visible = snapshot.visible;
			this.platform = snapshot.platform;
			this.nativeBadgeSupported = snapshot.nativeBadgeSupported;
			this.persistsWhenClosed = snapshot.persistsWhenClosed;
			this.isReady = true;
			this.error = "";
		},

		async hydrate() {
			try {
				this.applySnapshot(await getBadgeCount());
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel carregar o badge.";
			}
		},

		async setCount(count: number) {
			try {
				this.applySnapshot(await setBadgeCount(count));
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel atualizar o badge.";
			}
		},

		async clear() {
			try {
				this.applySnapshot(await clearBadgeCount());
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel limpar o badge.";
			}
		},
	},
});
