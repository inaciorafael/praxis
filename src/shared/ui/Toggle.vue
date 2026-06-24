<script setup lang="ts">
const props = defineProps<{
	checked?: boolean;
	disabled?: boolean;
}>();

const emit = defineEmits<{
	change: [value: boolean];
}>();

function toggle() {
	if (props.disabled) return;
	emit("change", !props.checked);
}
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="checked"
    :disabled="disabled"
    @click="toggle"
    class="relative h-7 w-12 rounded-full transition-all duration-300 disabled:cursor-not-allowed disabled:opacity-50"
    :class="checked ? 'bg-sage' : 'bg-border'"
  >
    <span
      class="absolute left-0.5 top-0.5 h-6 w-6 rounded-full border border-border bg-paper shadow-sm transition-all duration-300 ease-[cubic-bezier(.34,1.56,.64,1)]"
      :class="checked ? 'translate-x-5' : 'translate-x-0'"
    />
  </button>
</template>
