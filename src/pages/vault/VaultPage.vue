<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";

import { useVaultStore } from "@/stores/vault.store";
import Input from "@/shared/ui/Input.vue";
import { KeyRound } from "@lucide/vue";
import BaseButton from "@/shared/ui/BaseButton.vue";
import { takeDeferredAppNavigation } from "@/shared/lib/app/app-navigation.service";
import { useI18n } from "vue-i18n";

const router = useRouter();
const vault = useVaultStore();
const { t } = useI18n();

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
		t("vault.noneSelected"),
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
		return mode.value === "create" ? t("vault.creating") : t("vault.opening");
	}

	return mode.value === "create" ? t("vault.createAndEnter") : t("vault.open");
});
const selectedModeLabel = computed(() =>
	mode.value === "create" ? t("vault.new") : t("vault.existing"),
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
		formError.value = t("vault.passwordRequired");
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
        <span class="text-display">{{ t('vault.heading') }}</span>
        <span class="text-ink-soft">{{ t('vault.subtitle') }}</span>

        <div class="grid grid-cols-2 gap-2">
          <button
            type="button"
            :class="[
              'border px-3 py-2 text-body font-semibold hover:bg-hover',
              mode === 'open' ? 'border-accent bg-selection text-ink' : 'border-border bg-surface text-ink-soft'
            ]"
            @click="selectExistingDataFile"
          >
            {{ t('vault.select') }}
          </button>

          <button
            type="button"
            :class="[
              'border px-3 py-2 text-body font-semibold hover:bg-hover',
              mode === 'create' ? 'border-accent bg-selection text-ink' : 'border-border bg-surface text-ink-soft'
            ]"
            @click="createCurrentDataFile"
          >
            {{ t('vault.create') }}
          </button>
        </div>

        <Input
          v-model="dataFilePath"
          :label="selectedModeLabel"
          :placeholder="t('vault.pathPlaceholder')"
          @blur="validateCurrentDataFile"
        >
          <template #suffix>
            <button
              class="text-small font-semibold text-accent"
              type="button"
              @click="mode === 'create' ? createCurrentDataFile() : selectExistingDataFile()"
            >
              {{ mode === "create" ? t('vault.createAt') : t('vault.selectAction') }}
            </button>
          </template>
        </Input>
        <span class="break-all text-small text-ink-muted">{{ vaultPath }}</span>
        <span v-if="mode === 'open' && vault.validation?.valid" class="text-small font-semibold text-sage">{{ t('vault.recognized') }}</span>
        <span v-if="mode === 'open' && vault.validation?.error" class="text-small font-semibold text-brick">{{ vault.validation.error }}</span>
        <span v-if="mode === 'create' && dataFilePath" class="text-small font-semibold text-sage">{{ t('vault.willCreate') }}</span>

        <Input
          v-model="dataFilePassword"
          :label="t('vault.password')"
          :placeholder="t('vault.passwordPlaceholder')"
          :type="passwordIsVisible ? 'text' : 'password'"
          @keydown.enter.prevent="submitVault"
        >
          <template #prefix>
            <KeyRound />
          </template>

          <template #suffix>
            <button class="text-small font-semibold text-accent" type="button" @click="passwordIsVisible = !passwordIsVisible">
              {{ passwordIsVisible ? t('vault.hide') : t('vault.show') }}
            </button>
          </template>
        </Input>
        <span>
          {{ t('vault.instruction') }}
        </span>
        <span v-if="formError" class="text-small font-semibold text-brick">{{ formError }}</span>
        <span v-if="vault.error" class="text-small font-semibold text-brick">{{ vault.error }}</span>
        <BaseButton variant="success" :label="submitLabel" :disabled="!canSubmit" @click="submitVault" />
      </div>
    </div>
  </section>
</template>
