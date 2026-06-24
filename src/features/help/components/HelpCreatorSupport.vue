<script setup lang="ts">
import { Check, Clipboard, Code2, Coffee, Heart } from "@lucide/vue";
import { computed, onBeforeUnmount, ref } from "vue";

const pixKey = import.meta.env.VITE_PRAXIS_PIX_KEY?.trim() ?? "";
const copied = ref(false);
const copyError = ref(false);
let copiedTimer: number | null = null;

const maskedPixKey = computed(() => {
	if (!pixKey) {
		return "";
	}

	if (pixKey.includes("@")) {
		const [name, domain] = pixKey.split("@");
		return `${name.slice(0, 3)}${"•".repeat(Math.min(6, name.length))}@${domain}`;
	}

	if (pixKey.length <= 12) {
		return pixKey;
	}

	return `${pixKey.slice(0, 6)}••••${pixKey.slice(-4)}`;
});

async function copyPixKey() {
	if (!pixKey) {
		return;
	}

	try {
		await navigator.clipboard.writeText(pixKey);
		copied.value = true;
		copyError.value = false;
	} catch {
		copied.value = false;
		copyError.value = true;
		return;
	}

	if (copiedTimer !== null) {
		window.clearTimeout(copiedTimer);
	}

	copiedTimer = window.setTimeout(() => {
		copied.value = false;
		copiedTimer = null;
	}, 2400);
}

onBeforeUnmount(() => {
	if (copiedTimer !== null) {
		window.clearTimeout(copiedTimer);
	}
});
</script>

<template>
  <div class="grid gap-5">
    <div class="grid gap-3 text-body leading-6 text-ink-soft">
      <p>
        O Praxis é criado e mantido de forma independente por
        <strong class="font-semibold text-ink">Rafael Inácio</strong>, com atenção especial
        à privacidade, ao desempenho e aos detalhes que tornam o uso diário mais tranquilo.
      </p>
      <p>
        Se a ferramenta ajuda você a lembrar do que importa, uma contribuição voluntária
        apoia o tempo de desenvolvimento, os testes no Windows e a continuidade do
        projeto. O Praxis continuará funcionando normalmente sem qualquer doação.
      </p>
    </div>

    <div class="flex flex-wrap gap-x-5 gap-y-2 text-small text-ink-muted">
      <span class="flex items-center gap-2">
        <Heart :size="15" />
        Apoio único e opcional
      </span>
      <span class="flex items-center gap-2">
        <Coffee :size="15" />
        Sem assinatura
      </span>
      <span class="flex items-center gap-2">
        <Code2 :size="15" />
        Projeto independente
      </span>
    </div>

    <div
      v-if="pixKey"
      class="grid gap-3 border border-border bg-surface p-4"
    >
      <div class="grid gap-1">
        <span class="text-caption font-semibold uppercase text-ink-muted">
          Apoiar via Pix
        </span>
        <span class="text-body text-ink-soft">
          Qualquer valor já contribui para manter o desenvolvimento ativo.
        </span>
      </div>

      <div class="flex flex-wrap items-center gap-3 border border-border bg-paper p-2">
        <code class="min-w-0 flex-1 break-all px-2 text-body text-ink">
          {{ maskedPixKey }}
        </code>
        <button
          type="button"
          class="inline-flex min-h-10 items-center gap-2 bg-blue px-3 py-2 text-body font-semibold text-on-accent"
          @click="copyPixKey"
        >
          <Check
            v-if="copied"
            :size="17"
          />
          <Clipboard
            v-else
            :size="17"
          />
          {{ copied ? "Chave copiada" : "Copiar chave Pix" }}
        </button>
      </div>

      <span
        :class="[
          'text-small',
          copyError ? 'text-brick' : 'text-ink-muted',
        ]"
        aria-live="polite"
      >
        {{
          copyError
            ? "O Windows não permitiu copiar a chave. Tente novamente."
            : copied
              ? "Obrigado por apoiar o Praxis."
              : "A chave completa é copiada com segurança para a área de transferência."
        }}
      </span>
    </div>

    <div
      v-else
      class="flex items-center gap-3 border border-border bg-surface p-4 text-body text-ink-soft"
    >
      <Coffee
        :size="20"
        class="shrink-0 text-accent"
      />
      <span>O apoio por Pix será disponibilizado aqui em breve.</span>
    </div>
  </div>
</template>
