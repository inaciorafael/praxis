<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";

import { useVaultStore } from "@/stores/vault.store";
import Input from "@/shared/ui/Input.vue";
import { KeyRound } from "@lucide/vue";
import BaseButton from "@/shared/ui/BaseButton.vue";

const router = useRouter();
const vault = useVaultStore();

const dataFilePath = ref("");
const dataFilePassword = ref("");
const passwordIsVisible = ref(false);
const isSubmitting = ref(false);

const vaultPath = computed(() => vault.activeDataFilePath ?? vault.selectedDataFilePath ?? "nenhum arquivo selecionado");
const canSubmit = computed(() => Boolean(dataFilePath.value.trim() && dataFilePassword.value.trim() && !isSubmitting.value));
const canCreate = computed(() => Boolean(dataFilePassword.value.trim() && !isSubmitting.value));

watch(
  () => [vault.selectedDataFilePath, vault.suggestedPath],
  ([selectedPath, suggestedPath]) => {
    if (!dataFilePath.value) {
      dataFilePath.value = selectedPath || suggestedPath || "";
    }
  },
  { immediate: true },
);

function validateCurrentDataFile() {
  void vault.validate(dataFilePath.value);
}

async function selectExistingDataFile() {
  const selectedPath = await vault.selectExistingDataFile();

  if (selectedPath) {
    dataFilePath.value = selectedPath;
  }
}

async function selectNewDataFile() {
  const selectedPath = await vault.selectNewDataFile();

  if (selectedPath) {
    dataFilePath.value = selectedPath;
  }
}

async function enterApp(opened: boolean) {
  if (!opened) {
    return;
  }

  await router.replace({ name: "today" });
}

async function createCurrentDataFile() {
  if (!dataFilePath.value.trim()) {
    await selectNewDataFile();
  }

  if (!canCreate.value || !dataFilePath.value.trim()) {
    return;
  }

  isSubmitting.value = true;
  await enterApp(
    await vault.create({
      path: dataFilePath.value.trim(),
      password: dataFilePassword.value,
    }),
  );
  isSubmitting.value = false;
}

async function openCurrentDataFile() {
  if (!canSubmit.value) {
    return;
  }

  isSubmitting.value = true;
  await enterApp(
    await vault.open({
      path: dataFilePath.value.trim(),
      password: dataFilePassword.value,
    }),
  );
  isSubmitting.value = false;
}

</script>

<template>
  <section class="grid grid-cols-12 h-screen">
    <div class="col-span-6 bg-black text-paper mobile:hidden desktop:flex items-center justify-center">
      <span class="text-[6rem] font-semibold">Praxis</span>
    </div>

    <div class="col-span-12 desktop:col-span-6 flex items-center justify-center">
      <div class="flex mobile:w-[80%] tablet:w-[60%] desktop:w-[60%] flex-col gap-5">
        <span class="text-display">Acesse seu planejamento privado</span>
        <span class="text-ink-soft">Suas tarefas ficam locais, privadas e criptografadas.</span>
        <Input
          v-model="dataFilePath"
          label="Selecione o cofre"
          placeholder="Caminho do arquivo .praxis"
          @blur="validateCurrentDataFile"
        >
          <template #suffix>
            <button class="text-small font-semibold text-accent" type="button" @click="selectExistingDataFile">
              selecionar
            </button>
            <!-- <button class="text-small font-semibold text-accent" type="button" @click="selectNewDataFile"> -->
            <!--   novo -->
            <!-- </button> -->
            <!-- <button class="text-small font-semibold text-accent" type="button" @click="useSuggestedDataFilePath"> -->
            <!--   sugerido -->
            <!-- </button> -->
          </template>
        </Input>
        <span class="break-all text-small text-ink-muted">{{ vaultPath }}</span>
        <span v-if="vault.validation?.valid" class="text-small font-semibold text-sage">Cofre reconhecido.</span>
        <span v-if="vault.validation?.error" class="text-small font-semibold text-brick">{{ vault.validation.error }}</span>

        <Input
          v-model="dataFilePassword"
          label="Senha"
          placeholder="Digite sua senha"
          :type="passwordIsVisible ? 'text' : 'password'"
          @keydown.enter.prevent="openCurrentDataFile"
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
        <span v-if="vault.error" class="text-small font-semibold text-brick">{{ vault.error }}</span>
        <BaseButton variant="success" label="Abrir cofre" :disabled="!canSubmit" @click="openCurrentDataFile" />
        <BaseButton variant="ghost" label="Cadastrar novo cofre" :disabled="!canCreate" @click="createCurrentDataFile" />
      </div>
    </div>
  </section>
</template>
