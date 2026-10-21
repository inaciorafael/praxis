<script setup lang="ts">
import { onMounted, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import PostitNote from './PostitNote.vue'
import type { PostitView } from '@/shared/types/postit'
import {
  changePostit,
  dragPostit,
  getPostitWindow,
  onPostitsChanged,
  onPostitError,
} from '@/shared/lib/postits/postit.service'
const note = ref<PostitView | null>(null),
  error = ref(''),
  busy = ref(false)
const { locale } = useI18n()
let stops: (() => void)[] = [],
  disposed = false
async function refresh() {
  try {
    const [value, config] = await getPostitWindow()
    if (disposed) return
    locale.value = config.language
    note.value = value
  } catch {
    if (!disposed) note.value = null
  }
}
async function action(run: () => Promise<unknown>) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await run()
    await refresh()
  } catch (reason) {
    error.value = String(reason)
  } finally {
    busy.value = false
  }
}
function patch(values: { pinned?: boolean; collapsed?: boolean; completed?: boolean }) {
  if (!note.value) return
  const current = note.value.record
  void action(() =>
    changePostit({
      id: current.id,
      expectedRevision: current.revision,
      ...values,
    })
  )
}
function saveInline(values: { title: string; body: string; expectedRevision: number }) {
  if (!note.value) return
  const id = note.value.record.id
  void action(() => changePostit({ id, ...values }))
}
onMounted(async () => {
  try {
    const listeners = await Promise.all([
      onPostitsChanged(() => {
        void refresh()
      }),
      onPostitError((message) => (error.value = message)),
    ])
    if (disposed) listeners.forEach((stop) => stop())
    else stops = listeners
    await refresh()
  } finally {
    window.dispatchEvent(new Event('praxis:ready'))
  }
})
onBeforeUnmount(() => {
  disposed = true
  stops.forEach((stop) => stop())
  note.value = null
})
</script>
<template>
  <PostitNote
    v-if="note"
    :note="note"
    :busy="busy"
    :error="error"
    desktop
    @collapse="patch({ collapsed: !note.record.collapsed })"
    @unpin="patch({ pinned: false })"
    @complete="patch({ completed: true })"
    @save="saveInline"
    @drag="dragPostit().catch((reason) => (error = String(reason)))"
  />
</template>
<style>
html:has(.postit-note),
body:has(.postit-note) {
  min-width: 0 !important;
  width: 100%;
  margin: 0 !important;
  padding: 0 !important;
  overflow: hidden !important;
  background: transparent !important;
}
body:has(.postit-note) #app {
  height: 100vh;
  min-height: 0;
}
</style>
