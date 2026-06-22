<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import dayjs from "dayjs";

import {
	checkForAppUpdate,
	downloadAndInstallAppUpdate,
	type AppUpdateInfo,
} from "@/shared/lib/app/app-update.service";
import { seedShowcaseData } from "@/shared/lib/tasks/task.service";
import { useAppStore } from "@/stores/app.store";
import { useBadgeStore } from "@/stores/badge.store";
import { useNotificationStore } from "@/stores/notification.store";
import { useTaskStore } from "@/stores/task.store";
import { useVaultStore } from "@/stores/vault.store";

const app = useAppStore();
const badge = useBadgeStore();
const notifications = useNotificationStore();
const tasks = useTaskStore();
const vault = useVaultStore();
const updateInfo = ref<AppUpdateInfo | null>(null);
const updateStatus = ref("");
const isCheckingUpdate = ref(false);
const isInstallingUpdate = ref(false);
const showcaseStatus = ref("");
const isSeedingShowcase = ref(false);

const config = computed(() => app.config);
const dataFilePath = computed(() =>
	maskPath(vault.activeDataFilePath ?? vault.selectedDataFilePath),
);
const storageStatus = computed(() =>
	vault.active ? "Cofre aberto" : "Cofre bloqueado",
);

onMounted(async () => {
	await Promise.all([
		app.hydrateConfig(),
		vault.hydrate(),
		badge.hydrate(),
		notifications.hydrate(),
		vault.hydrateSafetyCopies(),
	]);
});

async function toggleNotifications(enabled: boolean) {
	if (enabled) {
		const granted = await notifications.requestPermission();

		if (!granted) {
			await app.updateConfig({ notificationsEnabled: false });
			return;
		}
	} else {
		await notifications.cancelAll();
	}

	await app.updateConfig({ notificationsEnabled: enabled });
}

async function toggleBadge(enabled: boolean) {
	await app.updateConfig({ badgeEnabled: enabled });

	if (enabled) {
		await tasks.hydrateViewCounts();
		return;
	}

	await badge.clear();
}

async function reloadVault() {
	await vault.reloadFromDisk();
}

async function prepareShowcase() {
	if (isSeedingShowcase.value) {
		return;
	}

	isSeedingShowcase.value = true;
	showcaseStatus.value = "Preparando dados de showcase...";

	try {
		await tasks.applyCollection(await seedShowcaseData());
		await Promise.all([tasks.hydrateViewCounts(), vault.hydrate()]);
		showcaseStatus.value = "Showcase pronto. O cofre aberto foi substituido por dados ilustrativos.";
	} catch (error) {
		showcaseStatus.value =
			error instanceof Error
				? error.message
				: "Nao foi possivel preparar o showcase.";
	} finally {
		isSeedingShowcase.value = false;
	}
}

async function checkUpdate() {
	if (isCheckingUpdate.value || isInstallingUpdate.value) {
		return;
	}

	isCheckingUpdate.value = true;
	updateStatus.value = "Verificando atualização...";

	try {
		updateInfo.value = await checkForAppUpdate();
		updateStatus.value = updateInfo.value
			? `Versão ${updateInfo.value.version} disponível.`
			: "Você já está na versão mais recente.";
	} catch (error) {
		updateInfo.value = null;
		updateStatus.value =
			error instanceof Error
				? error.message
				: "Não foi possível verificar atualizações.";
	} finally {
		isCheckingUpdate.value = false;
	}
}

async function installUpdate() {
	if (!updateInfo.value || isInstallingUpdate.value) {
		return;
	}

	isInstallingUpdate.value = true;
	updateStatus.value = "Baixando atualização...";

	try {
		await downloadAndInstallAppUpdate((progress) => {
			updateStatus.value =
				progress.percentage === null
					? "Baixando atualização..."
					: `Baixando atualização... ${progress.percentage}%`;
		});
	} catch (error) {
		updateStatus.value =
			error instanceof Error
				? error.message
				: "Não foi possível instalar a atualização.";
		isInstallingUpdate.value = false;
	}
}

function formatDate(value: string | null) {
	return value ? dayjs(value).format("DD/MM/YYYY HH:mm") : "Não disponível";
}

function yesNo(value: boolean | undefined) {
	return value ? "Ativado" : "Desativado";
}

function maskPath(value: string | null) {
	if (!value) {
		return "Não selecionado";
	}

	const normalized = value.replace(/\//g, "\\");
	const parts = normalized.split("\\").filter(Boolean);
	const filename = parts[parts.length - 1] ?? normalized;
	const root = normalized.match(/^[A-Za-z]:/)?.[0] ?? "";

	return root ? `${root}\\...\\${filename}` : `...\\${filename}`;
}
</script>

<template>
  <section class="grid max-w-4xl gap-6">
    <div class="flex flex-col gap-1">
      <span class="text-display">Configurações</span>
      <span class="text-body text-ink-soft">Preferências locais e estado seguro do Praxis.</span>
    </div>

    <div class="grid border border-border bg-surface">
      <div class="flex items-center justify-between gap-6 border-b border-border p-4">
        <div class="grid gap-1">
          <span class="text-heading">Receber notificações</span>
          <span class="text-body text-ink-soft">Permite que lembretes de tarefas pendentes disparem notificações.</span>
        </div>
        <button
          type="button"
          :class="[
            'min-w-24 border px-3 py-2 text-body font-semibold',
            config?.notificationsEnabled ? 'border-sage bg-sage text-paper' : 'border-border bg-paper text-ink'
          ]"
          @click="toggleNotifications(!config?.notificationsEnabled)"
        >
          {{ config?.notificationsEnabled ? "Ativado" : "Desativado" }}
        </button>
      </div>

      <div class="flex items-center justify-between gap-6 border-b border-border p-4">
        <div class="grid gap-1">
          <span class="text-heading">Mostrar badge no ícone</span>
          <span class="text-body text-ink-soft">Mostra a contagem de tarefas pendentes no ícone do aplicativo quando disponível.</span>
        </div>
        <button
          type="button"
          :class="[
            'min-w-24 border px-3 py-2 text-body font-semibold',
            config?.badgeEnabled ? 'border-sage bg-sage text-paper' : 'border-border bg-paper text-ink'
          ]"
          @click="toggleBadge(!config?.badgeEnabled)"
        >
          {{ config?.badgeEnabled ? "Ativado" : "Desativado" }}
        </button>
      </div>

      <div class="flex items-center justify-between gap-6 border-b border-border p-4">
        <div class="grid gap-1">
          <span class="text-heading">Iniciar com o Windows</span>
          <span class="text-body text-ink-soft">Abre o Praxis automaticamente ao iniciar o sistema.</span>
        </div>
        <button
          type="button"
          :class="[
            'min-w-24 border px-3 py-2 text-body font-semibold',
            config?.startWithWindows ? 'border-sage bg-sage text-paper' : 'border-border bg-paper text-ink'
          ]"
          @click="app.updateConfig({ startWithWindows: !config?.startWithWindows })"
        >
          {{ config?.startWithWindows ? "Ativado" : "Desativado" }}
        </button>
      </div>

      <div class="flex items-center justify-between gap-6 border-b border-border p-4">
        <div class="grid gap-1">
          <span class="text-heading">Iniciar minimizado</span>
          <span class="text-body text-ink-soft">Mantém o Praxis discreto quando iniciado automaticamente.</span>
        </div>
        <button
          type="button"
          :class="[
            'min-w-24 border px-3 py-2 text-body font-semibold',
            config?.startMinimized ? 'border-sage bg-sage text-paper' : 'border-border bg-paper text-ink'
          ]"
          @click="app.updateConfig({ startMinimized: !config?.startMinimized })"
        >
          {{ config?.startMinimized ? "Ativado" : "Desativado" }}
        </button>
      </div>

      <div class="flex items-center justify-between gap-6 p-4">
        <div class="grid gap-1">
          <span class="text-heading">Minimizar para o tray quando desbloqueado</span>
          <span class="text-body text-ink-soft">Ao fechar a janela com o cofre aberto, o app continua rodando em segundo plano.</span>
        </div>
        <button
          type="button"
          :class="[
            'min-w-24 border px-3 py-2 text-body font-semibold',
            config?.minimizeToTrayWhenUnlocked ? 'border-sage bg-sage text-paper' : 'border-border bg-paper text-ink'
          ]"
          @click="app.updateConfig({ minimizeToTrayWhenUnlocked: !config?.minimizeToTrayWhenUnlocked })"
        >
          {{ config?.minimizeToTrayWhenUnlocked ? "Ativado" : "Desativado" }}
        </button>
      </div>
    </div>

    <div class="grid border border-border bg-surface">
      <div class="flex items-center justify-between gap-6 p-4">
        <div class="grid gap-1">
          <span class="text-heading">Atualizações</span>
          <span class="text-body text-ink-soft">
            Baixa releases assinadas publicadas no GitHub.
          </span>
          <span v-if="updateStatus" class="text-body font-semibold text-ink">
            {{ updateStatus }}
          </span>
        </div>

        <div class="flex shrink-0 gap-2">
          <button
            type="button"
            class="border border-border bg-paper px-3 py-2 text-body font-semibold text-ink hover:bg-hover disabled:pointer-events-none disabled:opacity-50"
            :disabled="isCheckingUpdate || isInstallingUpdate"
            @click="checkUpdate"
          >
            {{ isCheckingUpdate ? "Verificando..." : "Verificar" }}
          </button>

          <button
            type="button"
            class="border border-accent bg-accent px-3 py-2 text-body font-semibold text-paper disabled:pointer-events-none disabled:opacity-50"
            :disabled="!updateInfo || isInstallingUpdate"
            @click="installUpdate"
          >
            {{ isInstallingUpdate ? "Instalando..." : "Instalar" }}
          </button>
        </div>
      </div>
    </div>

    <div class="grid border border-border bg-surface">
      <div class="grid gap-1 border-b border-border p-4">
        <div class="flex justify-between gap-4">
          <span class="text-heading">Status do banco</span>
          <span class="text-body font-semibold text-ink">{{ storageStatus }}</span>
        </div>
        <span class="text-body text-ink-soft">O arquivo .praxis é a fonte local dos dados.</span>
      </div>

      <div class="grid gap-1 border-b border-border p-4">
        <div class="flex justify-between gap-4">
          <span class="text-heading">Arquivo do cofre</span>
          <span class="break-all text-right text-body font-semibold text-ink">{{ dataFilePath }}</span>
        </div>
        <span class="text-body text-ink-soft">Caminho mascarado para evitar exposição desnecessária.</span>
      </div>

      <div class="grid gap-1 border-b border-border p-4">
        <div class="flex justify-between gap-4">
          <span class="text-heading">Criptografia</span>
          <span class="text-body font-semibold text-ink">Ativa</span>
        </div>
        <span class="text-body text-ink-soft">O Praxis não exibe senha nem conteúdo bruto do cofre.</span>
      </div>

      <div class="grid gap-1 border-b border-border p-4">
        <div class="flex justify-between gap-4">
          <span class="text-heading">Credencial salva</span>
          <span class="text-body font-semibold text-ink">{{ yesNo(vault.credentialSaved) }}</span>
        </div>
        <span class="text-body text-ink-soft">Usada apenas para auto unlock local quando disponível.</span>
      </div>

      <div class="grid gap-1 border-b border-border p-4">
        <div class="flex justify-between gap-4">
          <span class="text-heading">Última atualização interna</span>
          <span class="text-body font-semibold text-ink">{{ formatDate(vault.dataFileUpdatedAt) }}</span>
        </div>
        <span class="text-body text-ink-soft">Marcador gravado dentro do arquivo .praxis.</span>
      </div>

      <div class="grid gap-1 border-b border-border p-4">
        <div class="flex justify-between gap-4">
          <span class="text-heading">Última modificação do arquivo</span>
          <span class="text-body font-semibold text-ink">{{ formatDate(vault.dataFileModifiedAt) }}</span>
        </div>
        <span class="text-body text-ink-soft">Data informada pelo sistema de arquivos.</span>
      </div>

      <div class="grid gap-1 p-4">
        <div class="flex justify-between gap-4">
          <span class="text-heading">Permissão de notificações</span>
          <span class="text-body font-semibold text-ink">{{ notifications.permissionGranted ? "Concedida" : "Pendente" }}</span>
        </div>
        <span class="text-body text-ink-soft">Permissão do sistema operacional para exibir lembretes.</span>
      </div>
    </div>

    <div class="grid border border-border bg-surface">
      <div class="flex items-center justify-between gap-6 p-4">
        <div class="grid gap-1">
          <span class="text-heading">Showcase para GitHub</span>
          <span class="text-body text-ink-soft">
            Substitui os dados do cofre aberto por tarefas ilustrativas para screenshots.
          </span>
          <span v-if="showcaseStatus" class="text-body font-semibold text-ink">
            {{ showcaseStatus }}
          </span>
        </div>

        <button
          type="button"
          class="border border-brick bg-paper px-3 py-2 text-body font-semibold text-brick hover:bg-hover disabled:pointer-events-none disabled:opacity-50"
          :disabled="!vault.active || isSeedingShowcase"
          @click="prepareShowcase"
        >
          {{ isSeedingShowcase ? "Preparando..." : "Preparar showcase" }}
        </button>
      </div>
    </div>

    <div class="flex justify-end">
      <button class="border border-border bg-surface px-3 py-2 text-body font-semibold text-ink hover:bg-hover" @click="reloadVault">
        Recarregar cofre do disco
      </button>
    </div>
  </section>
</template>
