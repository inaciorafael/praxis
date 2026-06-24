<script setup lang="ts" generic="T extends { id: string | number }">
import { computed, ref } from "vue";

const props = defineProps<{
	items: T[];
	modelValue?: T | null;
	placeholder?: string;
}>();

const emit = defineEmits<{
	"update:modelValue": [value: T];
}>();

const open = ref(false);

const selected = computed(() => props.modelValue ?? null);

function selectItem(item: T) {
	emit("update:modelValue", item);
	open.value = false;
}

function close(): void {
	if (open.value) {
		open.value = false;
	}
}
</script>

<template>
  <div
    v-click-outside="close"
    class="relative w-full"
  >
    <button
      type="button"
      class="flex w-full items-center justify-between rounded-lg border border-border bg-paper px-3 py-2 text-left text-body text-ink"
      @click="open = !open"
    >
      <span>
        <slot
          name="selected"
          :item="selected"
        >
          {{ selected ? selected.id : placeholder }}
        </slot>
      </span>

      <span
        class="transition-transform duration-200"
        :class="open ? 'rotate-180' : 'rotate-0'"
      >
        ↓
      </span>
    </button>

    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0 -translate-y-2 scale-95"
      enter-to-class="opacity-100 translate-y-0 scale-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100 translate-y-0 scale-100"
      leave-to-class="opacity-0 -translate-y-2 scale-95"
    >
      <div
        v-if="open"
        class="absolute left-0 top-full z-50 mt-2 w-full overflow-hidden rounded-lg border border-border bg-paper shadow-lg"
      >
        <button
          v-for="item in items"
          :key="item.id"
          type="button"
          class="flex hover:bg-hover transition-colors w-full items-center px-3 py-2 text-left text-body"
          @click="selectItem(item)"
        >
          <slot
            name="item"
            :item="item"
          >
            {{ item.id }}
          </slot>
        </button>
      </div>
    </Transition>
  </div>
</template>
