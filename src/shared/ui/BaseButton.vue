<script setup lang="ts">
type Props = {
	label?: string;
	variant: "primary" | "secondary" | "ghost" | "danger" | "success" | "icon";
	disabled?: boolean;
};

withDefaults(
	defineProps<{
		label?: string;
		variant: "primary" | "secondary" | "ghost" | "danger" | "success" | "icon";
		disabled?: boolean;
	}>(),
	{
		variant: "primary",
		disabled: false,
	},
);

const variants: Record<Props["variant"], string> = {
	primary: "bg-rose text-paper",
	secondary: "bg-surface text-ink hover:bg-hover",
	ghost: "bg-transparent hover:bg-hover",
	danger: "bg-brick",
	success: "bg-sage",
	icon: "",
};

const variantsLabel: Record<Props["variant"], string> = {
	primary: "text-paper",
	secondary: "text-ink",
	ghost: "text-ink",
	danger: "text-paper",
	success: "text-paper",
	icon: "",
};

// --color-accent: #b46a2b;
// --color-amber: #b58a48;
// --color-sage: #7d8974;
// --color-rose: #c7aaa7;
// --color-brick: #a26056;
</script>

<template>
  <button
    :disabled="disabled"
    :class="[
      'py-2 px-3 bg-brick rounded-xl transition-all',
      'disabled:opacity-50 disabled:pointer-events-none',
      variants[variant]
    ]"
  >
    <span :class="[
        'font-semibold',
        variantsLabel[variant]
      ]"
      v-if="label"
    >
      {{ label }}
    </span>
  </button>
</template>
