<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";

import OverlayHost from "@/shared/ui/OverlayHost.vue";
import { useAppStore } from "@/stores/app.store";
import { useVaultStore } from "@/stores/vault.store";
import { router } from "@/app/router";
import {
	deferAppNavigation,
	initializeAppNavigation,
	type AppNavigationRequest,
} from "@/shared/lib/app/app-navigation.service";

const app = useAppStore();
const vault = useVaultStore();
let stopNavigationListener: (() => void) | null = null;

onMounted(async () => {
	try {
		stopNavigationListener = await initializeAppNavigation(
			handleNavigationRequest,
		);
		await Promise.all([
			app.isReady ? Promise.resolve() : app.hydrateConfig(),
			vault.isReady ? Promise.resolve() : vault.hydrate(),
		]);
	} finally {
		await new Promise<void>((resolve) => {
			requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
		});
		window.dispatchEvent(new Event("praxis:ready"));
	}
});

onBeforeUnmount(() => {
	stopNavigationListener?.();
});

async function handleNavigationRequest(request: AppNavigationRequest) {
	if (!vault.isReady) {
		await vault.hydrate();
	}

	if (!vault.active) {
		deferAppNavigation(request.view);
		await router.replace({ name: "vault" });
		return;
	}

	await router.replace({ name: request.view });
}
</script>

<template>
  <RouterView />
  <OverlayHost />
</template>
