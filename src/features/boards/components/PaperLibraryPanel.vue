<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { X } from '@lucide/vue'
import type { BoardElement } from '@/shared/types/board'
import {
  changePaperLibrary,
  getPaperLibraryItem,
  listPaperLibrary,
  type PaperLibrarySummary,
  type PaperLibraryItem,
} from '@/shared/lib/boards/paper-library.service'
import BoardSceneContent from './BoardSceneContent.vue'
import { bounds, connectorPoints } from '../lib/geometry'
const props = defineProps<{ selection: BoardElement[]; readOnly: boolean }>()
const emit = defineEmits<{ close: []; insert: [elements: BoardElement[]] }>()
const { t } = useI18n()
const items = ref<PaperLibrarySummary[]>([]),
  selected = ref<PaperLibraryItem>(),
  query = ref(''),
  name = ref(''),
  rename = ref(''),
  error = ref(''),
  busy = ref(false),
  removing = ref(false)
let generation = 0,
  disposed = false
const matches = computed(() =>
  items.value.filter((item) =>
    item.name.toLocaleLowerCase().includes(query.value.toLocaleLowerCase())
  )
)
const endpoints = computed(
  () =>
    new Map(
      (selected.value?.elements ?? [])
        .filter((e) => e.kind === 'arrow')
        .map((e) => [e.id, connectorPoints(e, selected.value!.elements)])
    )
)
const viewBox = computed(() => {
  const b = bounds(selected.value?.elements ?? [])
  return [b.x - 16, b.y - 16, b.width + 32, b.height + 32].join(' ')
})
const layers = [{ id: 'base', name: '', visible: true, locked: true, opacity: 1 }]
async function load() {
  busy.value = true
  error.value = ''
  try {
    const result = await listPaperLibrary()
    if (!disposed) items.value = result
  } catch (e) {
    if (!disposed) error.value = String(e)
  } finally {
    if (!disposed) busy.value = false
  }
}
async function choose(id: string) {
  const request = ++generation
  selected.value = undefined
  removing.value = false
  error.value = ''
  try {
    const item = await getPaperLibraryItem(id)
    if (!disposed && request === generation) {
      selected.value = item
      rename.value = item.name
    }
  } catch (e) {
    if (!disposed && request === generation) error.value = String(e)
  }
}
async function save() {
  if (busy.value || !name.value.trim() || !props.selection.length) return
  busy.value = true
  error.value = ''
  const id = crypto.randomUUID()
  try {
    items.value = await changePaperLibrary({
      type: 'add',
      id,
      name: name.value.trim(),
      elements: props.selection,
    })
    name.value = ''
    await choose(id)
  } catch (e) {
    error.value = String(e)
  } finally {
    busy.value = false
  }
}
async function update(remove = false) {
  const item = selected.value
  if (!item || busy.value) return
  busy.value = true
  error.value = ''
  try {
    items.value = await changePaperLibrary(
      remove
        ? { type: 'remove', id: item.id, revision: item.revision }
        : { type: 'rename', id: item.id, revision: item.revision, name: rename.value }
    )
    if (remove) {
      selected.value = undefined
      removing.value = false
      generation++
    } else await choose(item.id)
  } catch (e) {
    error.value = String(e)
  } finally {
    busy.value = false
  }
}
onMounted(load)
onBeforeUnmount(() => {
  disposed = true
  generation++
})
</script>
<template>
  <aside
    class="paper-library-panel"
    :aria-label="t('boards.library.title')"
    @pointerdown.stop
    @wheel.stop
    @keydown.stop
    @keydown.esc.prevent="emit('close')"
  >
    <header>
      <strong>{{ t('boards.library.title') }}</strong
      ><button
        :aria-label="t('common.close')"
        @click="emit('close')"
      >
        <X :size="16" />
      </button>
    </header>
    <p>{{ t('boards.library.hint') }}</p>
    <form
      v-if="selection.length && !readOnly"
      @submit.prevent="save"
    >
      <label
        >{{ t('boards.library.saveSelection', { count: selection.length })
        }}<input
          v-model="name"
          data-library-name
          maxlength="80"
          :placeholder="t('boards.library.name')"
      /></label>
      <button
        data-library-save
        :disabled="busy || !name.trim()"
      >
        {{ t('boards.library.save') }}
      </button>
    </form>
    <input
      v-model="query"
      type="search"
      :aria-label="t('boards.library.search')"
      :placeholder="t('boards.library.search')"
    />
    <p
      v-if="error"
      role="alert"
    >
      {{ error }}
      <button
        :disabled="busy"
        @click="load"
      >
        {{ t('boards.library.retry') }}
      </button>
    </p>
    <p
      v-if="busy"
      role="status"
    >
      {{ t('boards.library.loading') }}
    </p>
    <p v-else-if="!items.length">{{ t('boards.library.empty') }}</p>
    <div class="library-list">
      <button
        v-for="item in matches"
        :key="item.id"
        :aria-pressed="selected?.id === item.id"
        @click="choose(item.id)"
      >
        <strong>{{ item.name }}</strong
        ><span>{{
          item.elementCount === 1
            ? t('boards.library.element')
            : t('boards.library.elements', { count: item.elementCount })
        }}</span>
      </button>
    </div>
    <template v-if="selected">
      <svg
        class="library-preview"
        :viewBox="viewBox"
        :aria-label="selected.name"
        role="img"
        style="pointer-events: none; background: white"
      >
        <BoardSceneContent
          content-id="library-preview"
          :elements="selected.elements"
          :layers="layers"
          :endpoints="endpoints"
          :zoom="1"
          color-scheme="light"
          :editing="null"
          :font-ready="0"
          :replay="0"
          :group-delays="{}"
          :eraser="false"
        />
      </svg>
      <button
        data-library-insert
        :disabled="readOnly || busy"
        @click="emit('insert', selected.elements)"
      >
        {{ t('boards.library.insert') }}
      </button>
      <form @submit.prevent="update()">
        <input
          v-model="rename"
          maxlength="80"
          :aria-label="t('boards.library.name')"
        /><button :disabled="busy || !rename.trim() || rename === selected.name">
          {{ t('boards.library.rename') }}
        </button>
      </form>
      <div v-if="removing">
        <p>{{ t('boards.library.removeHint') }}</p>
        <button
          :disabled="busy"
          @click="update(true)"
        >
          {{ t('boards.library.remove') }}</button
        ><button @click="removing = false">{{ t('boards.library.cancel') }}</button>
      </div>
      <button
        v-else
        @click="removing = true"
      >
        {{ t('boards.library.remove') }}
      </button>
    </template>
  </aside>
</template>
<style scoped>
.paper-library-panel {
  position: absolute;
  top: var(--pe-context-height, 40px);
  right: 0;
  bottom: 44px;
  z-index: 8;
  width: min(300px, calc(100% - var(--pe-rail-width)));
  padding: 12px;
  overflow: auto;
  background: var(--pe-surface);
  color: var(--pe-ink);
  border-left: 1px solid var(--pe-border);
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 12px;
}
header,
form {
  display: flex;
  align-items: center;
  gap: 6px;
}
header {
  justify-content: space-between;
}
p {
  margin: 0;
  color: var(--pe-muted);
}
label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
  flex: 1;
}
input {
  min-width: 0;
  width: 100%;
}
input,
button {
  font: inherit;
  min-height: 32px;
  border: 1px solid var(--pe-border);
  border-radius: var(--pe-radius);
  background: var(--pe-surface);
  color: inherit;
  padding: 6px;
}
button {
  cursor: pointer;
}
button:hover,
button[aria-pressed='true'] {
  background: var(--pe-active);
}
button:disabled {
  opacity: 0.45;
  cursor: default;
}
.library-list {
  max-height: 200px;
  overflow: auto;
  display: grid;
  gap: 4px;
  flex-shrink: 0;
}
.library-list button {
  display: flex;
  text-align: left;
  justify-content: space-between;
  gap: 8px;
}
.library-list strong {
  overflow-wrap: anywhere;
}
.library-list span {
  color: var(--pe-muted);
  white-space: nowrap;
}
.library-preview {
  width: 100%;
  height: 150px;
  flex-shrink: 0;
  border: 1px solid var(--pe-border);
}
input:focus-visible,
button:focus-visible {
  outline: 2px solid var(--pe-ink);
  outline-offset: 2px;
}
</style>
