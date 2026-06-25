<script setup lang="ts">
import { useShortcut } from "@/shared/composables/useShortcut";
import { Search } from "@lucide/vue";
import { onMounted, ref } from "vue";

const emit = defineEmits<{
	close: [];
}>();

const query = ref("");
const inputRef = ref<HTMLInputElement>();

onMounted(() => {
	inputRef.value?.focus();
});

useShortcut("Escape", () => emit("close"), {
	preventDefault: true,
	ignoreInputs: false,
});
</script>

<template>
  <section class="absolute p-3 inset-0 z-20 flex flex-col bg-paper">
    <header class="flex flex-col gap-5">
      <h1 class="text-display">Search</h1>
      <div class="bg-hover text-title flex flex-row items-center gap-2 p-3">
        <Search :size="25" />

        <input
          ref="inputRef"
          v-model="query"
          placeholder="Buscar tarefas..."
          class="w-full bg-transparent text-heading outline-none"
        />
      </div>
    </header>

    <div class="flex-1 overflow-auto p-4">
      <span v-if="query">12 resultados para "{{ query }}"</span>

      <div class="flex-1 text-ink-soft flex items-center justify-center">
        <span>EM BREVE.</span>
      </div>
    </div>
  </section>
</template>
