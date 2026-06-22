import { defineStore } from "pinia";

import {
	getAppConfig,
	getAppHealth,
	updateAppConfig,
} from "@/shared/lib/app/app-config.service";
import type { AppConfig, AppConfigPatch, AppHealth } from "@/shared/types/app";

type AppStoreState = {
	name: string;
	config: AppConfig | null;
	health: AppHealth | null;
	isReady: boolean;
	error: string;
};

export const useAppStore = defineStore("app", {
	state: (): AppStoreState => ({
		name: "Praxis",
		config: null,
		health: null,
		isReady: false,
		error: "",
	}),

	actions: {
		async hydrateConfig() {
			try {
				this.config = await getAppConfig();
				this.isReady = true;
				this.error = "";
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel carregar configuracoes.";
			}
		},

		async updateConfig(patch: AppConfigPatch) {
			try {
				this.config = await updateAppConfig(patch);
				this.error = "";
				return true;
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel atualizar configuracoes.";
				return false;
			}
		},

		async checkHealth() {
			try {
				this.health = await getAppHealth();
				this.config = this.health.config;
				this.error = "";
				return this.health;
			} catch (error) {
				this.error =
					error instanceof Error
						? error.message
						: "Nao foi possivel verificar o estado do app.";
				return null;
			}
		},
	},
});
