<script setup lang="ts">
import { onBeforeUnmount, onMounted } from "vue";

import { overlay, overlayState } from "@/shared/lib/overlay/overlay.service";

function hideFromBackdrop() {
	if (overlayState.closeOnBackdrop) {
		overlay.hide();
	}
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key === "Escape" && overlayState.visible) {
		overlay.hide();
	}
}

onMounted(() => {
	window.addEventListener("keydown", handleKeydown);
});

onBeforeUnmount(() => {
	window.removeEventListener("keydown", handleKeydown);
});
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-100 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="overlayState.visible && overlayState.component"
        class="fixed inset-0 z-50 grid place-items-center bg-ink/35 p-5"
        role="presentation"
        @click.self="hideFromBackdrop"
      >
        <component
          :is="overlayState.component"
          v-bind="overlayState.props"
        />
      </div>
    </Transition>
  </Teleport>
</template>
