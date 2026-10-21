<script setup lang="ts">
import { watch, onMounted, onBeforeUnmount } from 'vue'
import { isTauri } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { useRouter } from 'vue-router'
import { useVaultStore } from '@/stores/vault.store'
import {
  syncPostits,
  listPostits,
  onPostitsChanged,
} from '@/shared/lib/postits/postit.service'
const vault = useVaultStore()
const router = useRouter()
let expiryGeneration = 0
let expiryTimer: ReturnType<typeof setTimeout> | undefined
let stopChanges: (() => void) | undefined
async function scheduleExpiry() {
  const generation = ++expiryGeneration
  clearTimeout(expiryTimer)
  if (!vault.active) return
  const fileId = vault.fileId
  try {
    const list = await listPostits()
    if (
      disposed ||
      generation !== expiryGeneration ||
      !vault.active ||
      vault.fileId !== fileId
    )
      return
    const deadlines = list.notes.flatMap((note) =>
      note.record.archived && note.record.completedAt
        ? [note.record.completedAt + 7 * 86400000]
        : []
    )
    if (deadlines.length)
      expiryTimer = setTimeout(
        () => {
          void syncPostits().catch(() => {})
        },
        Math.max(100, Math.min(...deadlines) - Date.now())
      )
  } catch {
    /* Persistence failures are surfaced by the native Post-it error event. */
  }
}
let stop: (() => void) | undefined
let disposed = false
watch(
  () => [vault.active, vault.fileId],
  () => {
    expiryGeneration++
    clearTimeout(expiryTimer)
    if (vault.active) void syncPostits().catch(() => {})
  },
  { immediate: true }
)
onMounted(async () => {
  if (!isTauri()) return
  const changes = await onPostitsChanged(() => {
    void scheduleExpiry()
  })
  if (disposed) changes()
  else stopChanges = changes
  void scheduleExpiry()
  const unlisten = await listen<string>('praxis://postit-open', (event) => {
    if (vault.active)
      void router.push({ name: 'postits', query: { note: event.payload } })
  })
  if (disposed) unlisten()
  else stop = unlisten
})
onBeforeUnmount(() => {
  disposed = true
  stop?.()
  stopChanges?.()
  clearTimeout(expiryTimer)
})
</script>
<template></template>
