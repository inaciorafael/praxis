<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";

import { useVaultStore } from "@/stores/vault.store";
import Input from "@/shared/ui/Input.vue";
import { KeyRound } from "@lucide/vue";
import BaseButton from "@/shared/ui/BaseButton.vue";
import { takeDeferredAppNavigation } from "@/shared/lib/app/app-navigation.service";

const router = useRouter();
const vault = useVaultStore();

type VaultMode = "open" | "create";

const dataFilePath = ref("");
const dataFilePassword = ref("");
const passwordIsVisible = ref(false);
const isSubmitting = ref(false);
const mode = ref<VaultMode>("open");
const formError = ref("");

const vaultPath = computed(
	() =>
		vault.activeDataFilePath ??
		vault.selectedDataFilePath ??
		"nenhum arquivo selecionado",
);
const canOpen = computed(() =>
	Boolean(
		dataFilePath.value.trim() &&
			dataFilePassword.value.trim() &&
			mode.value === "open" &&
			!isSubmitting.value,
	),
);
const canCreate = computed(() =>
	Boolean(
		dataFilePath.value.trim() &&
			dataFilePassword.value.trim() &&
			mode.value === "create" &&
			!isSubmitting.value,
	),
);
const canSubmit = computed(() =>
	mode.value === "create" ? canCreate.value : canOpen.value,
);
const submitLabel = computed(() => {
	if (isSubmitting.value) {
		return mode.value === "create" ? "Criando cofre..." : "Abrindo cofre...";
	}

	return mode.value === "create" ? "Criar cofre e entrar" : "Abrir cofre";
});
const selectedModeLabel = computed(() =>
	mode.value === "create" ? "Novo cofre" : "Cofre existente",
);

watch(
	() => vault.selectedDataFilePath,
	(selectedPath) => {
		if (!dataFilePath.value) {
			dataFilePath.value = selectedPath || "";
		}
	},
	{ immediate: true },
);

function validateCurrentDataFile() {
	if (mode.value !== "open") {
		return;
	}

	formError.value = "";
	void vault.validate(dataFilePath.value);
}

async function selectExistingDataFile() {
	formError.value = "";
	const selectedPath = await vault.selectExistingDataFile();

	if (selectedPath) {
		mode.value = "open";
		dataFilePath.value = selectedPath;
	}
}

async function selectNewDataFile() {
	formError.value = "";
	const selectedPath = await vault.selectNewDataFile(dataFilePath.value);

	if (selectedPath) {
		mode.value = "create";
		dataFilePath.value = selectedPath;
	}
}

async function enterApp(opened: boolean) {
	if (!opened) {
		return;
	}

	await router.replace({ name: takeDeferredAppNavigation() ?? "today" });
}

async function createCurrentDataFile() {
	await selectNewDataFile();

	if (!dataFilePath.value.trim()) {
		return;
	}

	if (!dataFilePassword.value.trim()) {
		formError.value = "Informe uma senha para criar o cofre.";
		return;
	}

	await createSelectedDataFile();
}

async function createSelectedDataFile() {
	if (!canCreate.value) {
		return;
	}

	isSubmitting.value = true;
	formError.value = "";

	try {
		await enterApp(
			await vault.create({
				path: dataFilePath.value.trim(),
				password: dataFilePassword.value,
			}),
		);
	} finally {
		isSubmitting.value = false;
	}
}

async function openCurrentDataFile() {
	if (!canOpen.value) {
		return;
	}

	isSubmitting.value = true;
	formError.value = "";

	try {
		await enterApp(
			await vault.open({
				path: dataFilePath.value.trim(),
				password: dataFilePassword.value,
			}),
		);
	} finally {
		isSubmitting.value = false;
	}
}

async function submitVault() {
	if (mode.value === "create") {
		await createSelectedDataFile();
		return;
	}

	await openCurrentDataFile();
}
</script>

<template>
  <section class="grid grid-cols-12 h-screen">
    <div class="col-span-6 bg-ink text-paper mobile:hidden desktop:flex items-center justify-center">
      <span class="text-[6rem] font-semibold">Praxis</span>
    </div>

    <div class="col-span-12 desktop:col-span-6 flex items-center justify-center">
      <div class="flex mobile:w-[80%] tablet:w-[60%] desktop:w-[60%] flex-col gap-5">
        <span class="text-display">Acesse seu planejamento privado</span>
        <span class="text-ink-soft">Suas tarefas ficam locais, privadas e criptografadas.</span>

        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            :class="[
              'border px-3 py-2 text-body font-semibold hover:bg-hover',
              mode === 'open' ? 'border-accent bg-selection text-ink' : 'border-border bg-surface text-ink-soft'
            ]"
            @click="selectExistingDataFile"
          >
            Selecionar cofre
          </button>

          <button
            type="button"
            :class="[
              'border px-3 py-2 text-body font-semibold hover:bg-hover',
              mode === 'create' ? 'border-accent bg-selection text-ink' : 'border-border bg-surface text-ink-soft'
            ]"
            @click="createCurrentDataFile"
          >
            Criar novo cofre
          </button>
        </div>

        <Input
          v-model="dataFilePath"
          :label="selectedModeLabel"
          placeholder="Caminho do arquivo .praxis"
          @blur="validateCurrentDataFile"
        >
          <template #suffix>
            <button
              class="text-small font-semibold text-accent"
              type="button"
              @click="mode === 'create' ? createCurrentDataFile() : selectExistingDataFile()"
            >
              {{ mode === "create" ? "criar em..." : "selecionar" }}
            </button>
          </template>
        </Input>
        <span class="break-all text-small text-ink-muted">{{ vaultPath }}</span>
        <span v-if="mode === 'open' && vault.validation?.valid" class="text-small font-semibold text-sage">Cofre reconhecido.</span>
        <span v-if="mode === 'open' && vault.validation?.error" class="text-small font-semibold text-brick">{{ vault.validation.error }}</span>
        <span v-if="mode === 'create' && dataFilePath" class="text-small font-semibold text-sage">Novo cofre será criado nesse caminho.</span>

        <Input
          v-model="dataFilePassword"
          label="Senha"
          placeholder="Digite sua senha"
          :type="passwordIsVisible ? 'text' : 'password'"
          @keydown.enter.prevent="submitVault"
        >
          <template #prefix>
            <KeyRound />
          </template>

          <template #suffix>
            <button class="text-small font-semibold text-accent" type="button" @click="passwordIsVisible = !passwordIsVisible">
              {{ passwordIsVisible ? "ocultar" : "mostrar" }}
            </button>
          </template>
        </Input>
        <span>
          <strong class="text-purple">Escolha um cofre</strong> existente ou <strong class="text-purple">crie um novo</strong> para começar.
        </span>
        <span v-if="formError" class="text-small font-semibold text-brick">{{ formError }}</span>
        <span v-if="vault.error" class="text-small font-semibold text-brick">{{ vault.error }}</span>
        <BaseButton variant="success" :label="submitLabel" :disabled="!canSubmit" @click="submitVault" />
      </div>
    </div>
  </section>
</template>
