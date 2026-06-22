import { defineStore } from "pinia";

import {
	closeDataFile,
	createDataFile,
	getVaultStatus,
	getSafetyCopiesDir,
	listSafetyCopies,
	openDataFile,
	reloadActiveDataFile,
	selectDataFilePath,
	selectNewDataFilePath,
	suggestDataFilePath,
	validateDataFile,
} from "@/shared/lib/vault/vault.service";
import type {
	DataFileCredentials,
	DataFileValidation,
	SafetyCopyInfo,
	VaultStatus,
} from "@/shared/types/vault";

type VaultStoreState = VaultStatus & {
	suggestedPath: string;
	validation: DataFileValidation | null;
	safetyCopies: SafetyCopyInfo[];
	safetyCopiesDir: string;
	isReady: boolean;
	error: string;
};

export const useVaultStore = defineStore("vault", {
	state: (): VaultStoreState => ({
		active: false,
		selectedDataFilePath: null,
		activeDataFilePath: null,
		fileId: null,
		schemaVersion: null,
		dataFileUpdatedAt: null,
		dataFileModifiedAt: null,
		deviceId: "",
		credentialSaved: false,
		autoUnlockError: null,
		suggestedPath: "",
		validation: null,
		safetyCopies: [],
		safetyCopiesDir: "",
		isReady: false,
		error: "",
	}),

	actions: {
		applyStatus(status: VaultStatus) {
			this.active = status.active;
			this.selectedDataFilePath = status.selectedDataFilePath;
			this.activeDataFilePath = status.activeDataFilePath;
			this.fileId = status.fileId;
			this.schemaVersion = status.schemaVersion;
			this.dataFileUpdatedAt = status.dataFileUpdatedAt;
			this.dataFileModifiedAt = status.dataFileModifiedAt;
			this.deviceId = status.deviceId;
			this.credentialSaved = status.credentialSaved;
			this.autoUnlockError = status.autoUnlockError;
			this.isReady = true;
			this.error = "";
		},

		async hydrate() {
			try {
				const [status, suggestedPath] = await Promise.all([
					getVaultStatus(),
					suggestDataFilePath(),
				]);
				this.applyStatus(status);
				this.suggestedPath = suggestedPath;
			} catch (error) {
				this.error = errorMessage(error, "Nao foi possivel carregar o cofre.");
			}
		},

		async refreshStatus() {
			try {
				this.applyStatus(await getVaultStatus());
			} catch (error) {
				this.error = errorMessage(
					error,
					"Nao foi possivel atualizar o status do cofre.",
				);
			}
		},

		async validate(path: string) {
			try {
				this.validation = await validateDataFile(path);
				this.error = "";
				return this.validation;
			} catch (error) {
				this.error = errorMessage(error, "Nao foi possivel validar o arquivo.");
				return null;
			}
		},

		async selectExistingDataFile() {
			try {
				const selectedPath = await selectDataFilePath(
					this.selectedDataFilePath ?? this.suggestedPath,
				);

				if (!selectedPath) {
					return null;
				}

				this.selectedDataFilePath = selectedPath;
				this.validation = await validateDataFile(selectedPath);
				this.error = "";
				return selectedPath;
			} catch (error) {
				this.error = errorMessage(error, "Nao foi possivel selecionar o cofre.");
				return null;
			}
		},

		async selectNewDataFile(defaultPath?: string) {
			try {
				const selectedPath = await selectNewDataFilePath(
					defaultPath || this.suggestedPath,
				);

				if (!selectedPath) {
					return null;
				}

				this.selectedDataFilePath = selectedPath;
				this.validation = null;
				this.error = "";
				return selectedPath;
			} catch (error) {
				this.error = errorMessage(
					error,
					"Nao foi possivel escolher onde criar o cofre.",
				);
				return null;
			}
		},

		async hydrateSafetyCopies() {
			try {
				const [copies, dir] = await Promise.all([
					listSafetyCopies(),
					getSafetyCopiesDir(),
				]);
				this.safetyCopies = copies;
				this.safetyCopiesDir = dir;
				this.error = "";
			} catch (error) {
				this.error = errorMessage(
					error,
					"Nao foi possivel carregar copias de seguranca.",
				);
			}
		},

		async reloadFromDisk() {
			try {
				this.applyStatus(await reloadActiveDataFile());
				return true;
			} catch (error) {
				this.error = errorMessage(
					error,
					"Nao foi possivel recarregar o arquivo .praxis.",
				);
				return false;
			}
		},

		async create(credentials: DataFileCredentials) {
			try {
				this.applyStatus(await createDataFile(credentials));
				this.validation = null;
				return true;
			} catch (error) {
				this.error = errorMessage(
					error,
					"Nao foi possivel criar o arquivo .praxis.",
				);
				return false;
			}
		},

		async open(credentials: DataFileCredentials) {
			try {
				this.applyStatus(await openDataFile(credentials));
				this.validation = null;
				return true;
			} catch (error) {
				this.error = errorMessage(
					error,
					"Nao foi possivel abrir o arquivo .praxis.",
				);
				return false;
			}
		},

		async close() {
			try {
				this.applyStatus(await closeDataFile());
			} catch (error) {
				this.error = errorMessage(error, "Nao foi possivel bloquear o cofre.");
			}
		},
	},
});

function errorMessage(error: unknown, fallback: string) {
	if (error instanceof Error) {
		return error.message;
	}

	if (typeof error === "string") {
		return error;
	}

	return fallback;
}
