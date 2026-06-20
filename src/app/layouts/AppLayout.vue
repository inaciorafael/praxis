<script setup lang="ts">
import { onMounted } from 'vue';
import AppAside from '../shell/AppAside.vue';
import { useTagStore } from '@/stores/tag.store';

const tags = useTagStore()

onMounted(async () => {
  if (!tags.isReady) {
    await tags.hydrate();
  }
})

</script>

<template>
  <div class="grid min-h-screen grid-cols-12 bg-paper text-ink">
    <aside class="border-r col-span-2 border-border bg-surface">
      <AppAside />
    </aside>

    <main class="h-screen p-10 overflow-y-auto col-span-10 bg-paper">
      <RouterView />
    </main>
  </div>
</template>
