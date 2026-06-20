<script lang="ts" setup>
  defineOptions({
    inheritAttrs: false,
  })

  defineProps<{
    label?: string
    modelValue?: string
  }>()

  const emit = defineEmits<{
    'update:modelValue': [value: string];
  }>()

  const hasError = false;
</script>

<template>
  <div class="flex flex-col gap-1">
    <label :class="['font-semibold', {
      'text-brick': hasError
      }]" v-if="label">{{ label }}</label>
    <div
      :class="['border w-full px-2 gap-2 p-px rounded flex flex-row items-center justify-between', {
      'border-brick': hasError
    }]">
      <div :class="{'text-brick': hasError}">
        <slot name="prefix" />
      </div>
      <input
        v-bind="$attrs"
        class="w-full py-2 p-1"
        :value="modelValue"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
      <div :class="{'text-brick': hasError}">
        <slot name="suffix" />
      </div>
    </div>
    <span v-show="hasError" class="text-small text-brick font-semibold">não foi possivel estabeler conexão</span>
  </div>
</template>
