<script setup lang="ts">
import { pickTagColorByName, praxisTagColors } from '@/shared/lib/tags/tag-color'
import { normalizeTagName } from '@/shared/lib/tags/inline-tag'
import type { Tag } from '@/shared/types/tag'
import { useTagStore } from '@/stores/tag.store'
import { Check, Pencil, Plus, Trash2, X } from '@lucide/vue'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

const tags = useTagStore()
const { t } = useI18n()
const newName = ref('')
const newColor = ref(pickTagColorByName('tag').text)
const newColorWasSelected = ref(false)
const editingTagId = ref('')
const editName = ref('')
const editColor = ref('')
const confirmDeleteId = ref('')
const isCreating = ref(false)
const isSaving = ref(false)
const deletingTagId = ref('')
const status = ref('')

const sortedTags = computed(() =>
  [...tags.tags].sort((left, right) =>
    left.name.localeCompare(right.name, 'pt-BR', { sensitivity: 'base' })
  )
)

const usageByTagId = computed(() => {
  const usage: Record<string, number> = {}

  for (const relation of tags.taskTags) {
    usage[relation.tagId] = (usage[relation.tagId] ?? 0) + 1
  }

  return usage
})

watch(newName, (name) => {
  if (!newColorWasSelected.value) {
    newColor.value = pickTagColorByName(name).text
  }
})

function tagNameExists(name: string, ignoredTagId = '') {
  const normalizedName = normalizeTagName(name)

  return tags.tags.some(
    (tag) => tag.id !== ignoredTagId && normalizeTagName(tag.name) === normalizedName
  )
}

function selectNewColor(color: string) {
  newColor.value = color
  newColorWasSelected.value = true
}

async function createTag() {
  const name = newName.value.trim()

  if (!name) {
    status.value = t('tags.nameRequired')
    return
  }

  if (tagNameExists(name)) {
    status.value = t('tags.exists', { name })
    return
  }

  if (isCreating.value) {
    return
  }

  isCreating.value = true
  status.value = ''
  const created = await tags.create({ name, color: newColor.value })
  isCreating.value = false

  if (!created) {
    status.value = tags.error
    return
  }

  status.value = t('tags.created', { name })
  newName.value = ''
  newColorWasSelected.value = false
  newColor.value = pickTagColorByName('tag').text
}

function startEditing(tag: Tag) {
  editingTagId.value = tag.id
  editName.value = tag.name
  editColor.value = tag.color
  confirmDeleteId.value = ''
  status.value = ''
}

function cancelEditing() {
  editingTagId.value = ''
  editName.value = ''
  editColor.value = ''
}

async function saveTag(tag: Tag) {
  const name = editName.value.trim()

  if (!name) {
    status.value = t('tags.nameRequired')
    return
  }

  if (tagNameExists(name, tag.id)) {
    status.value = t('tags.exists', { name })
    return
  }

  if (isSaving.value) {
    return
  }

  isSaving.value = true
  status.value = ''
  const updated = await tags.update(tag.id, {
    name,
    color: editColor.value,
  })
  isSaving.value = false

  if (!updated) {
    status.value = tags.error
    return
  }

  status.value = t('tags.updated', { name })
  cancelEditing()
}

async function requestDelete(tag: Tag) {
  if (confirmDeleteId.value !== tag.id) {
    confirmDeleteId.value = tag.id
    editingTagId.value = ''
    status.value = t('tags.confirmMessage', { name: tag.name })
    return
  }

  if (deletingTagId.value) {
    return
  }

  deletingTagId.value = tag.id
  const deleted = await tags.delete(tag.id)
  deletingTagId.value = ''

  if (!deleted) {
    status.value = tags.error
    return
  }

  confirmDeleteId.value = ''
  status.value = t('tags.deleted', { name: tag.name })
}

function cancelDelete() {
  confirmDeleteId.value = ''
  status.value = ''
}
</script>

<template>
  <div class="grid border border-border bg-surface">
    <div class="grid gap-4 border-b border-border p-4">
      <div class="grid gap-1">
        <span class="text-heading">{{ t('tags.title') }}</span>
        <span class="text-body text-ink-soft">
          {{ t('tags.description') }}
        </span>
      </div>

      <form
        class="grid gap-3"
        @submit.prevent="createTag"
      >
        <div class="flex flex-wrap gap-2">
          <input
            v-model="newName"
            type="text"
            maxlength="48"
            autocomplete="off"
            :placeholder="t('tags.newPlaceholder')"
            class="min-h-10 min-w-56 flex-1 border border-border bg-paper px-3 text-body text-ink outline-none placeholder:text-ink-muted focus:border-accent"
          />

          <button
            type="submit"
            :disabled="isCreating || !newName.trim()"
            class="flex min-h-10 items-center justify-center gap-2 border border-accent bg-accent px-4 text-body font-semibold text-on-accent disabled:pointer-events-none disabled:opacity-50"
          >
            <Plus :size="17" />
            {{ isCreating ? t('tags.creating') : t('tags.create') }}
          </button>
        </div>

        <div
          class="flex flex-wrap gap-2"
          aria-label="Cor da nova tag"
        >
          <button
            v-for="color in praxisTagColors"
            :key="color.key"
            type="button"
            :aria-label="color.label"
            :title="color.label"
            :aria-pressed="newColor === color.text"
            :class="[
              'flex h-8 w-8 items-center justify-center border transition-colors',
              newColor === color.text
                ? 'border-ink'
                : 'border-border hover:border-ink-soft',
            ]"
            :style="{ backgroundColor: color.background }"
            @click="selectNewColor(color.text)"
          >
            <Check
              v-if="newColor === color.text"
              :size="15"
              :style="{ color: color.text }"
            />
          </button>
        </div>
      </form>
    </div>

    <p
      v-if="status"
      role="status"
      class="border-b border-border px-4 py-3 text-body text-ink-soft"
    >
      {{ status }}
    </p>

    <div
      v-if="sortedTags.length === 0"
      class="p-4 text-body text-ink-soft"
    >
      {{ t('tags.empty') }}
    </div>

    <div
      v-for="tag in sortedTags"
      :key="tag.id"
      class="border-b border-border last:border-b-0"
    >
      <div
        v-if="editingTagId === tag.id"
        class="grid gap-3 p-4"
      >
        <div class="flex flex-wrap items-center gap-2">
          <input
            v-model="editName"
            type="text"
            maxlength="48"
            autocomplete="off"
            class="min-h-10 min-w-56 flex-1 border border-border bg-paper px-3 text-body text-ink outline-none focus:border-accent"
            @keydown.escape="cancelEditing"
          />

          <button
            type="button"
            :disabled="isSaving"
            class="flex h-10 w-10 items-center justify-center border border-sage text-sage hover:bg-hover disabled:pointer-events-none disabled:opacity-50"
            :aria-label="t('tags.save')"
            :title="t('tags.save')"
            @click="saveTag(tag)"
          >
            <Check :size="18" />
          </button>

          <button
            type="button"
            class="flex h-10 w-10 items-center justify-center border border-border text-ink-soft hover:bg-hover hover:text-ink"
            :aria-label="t('common.cancel')"
            :title="t('common.cancel')"
            @click="cancelEditing"
          >
            <X :size="18" />
          </button>
        </div>

        <div
          class="flex flex-wrap gap-2"
          :aria-label="`Cor da tag ${tag.name}`"
        >
          <button
            v-for="color in praxisTagColors"
            :key="color.key"
            type="button"
            :aria-label="color.label"
            :title="color.label"
            :aria-pressed="editColor.toLowerCase() === color.text.toLowerCase()"
            :class="[
              'flex h-8 w-8 items-center justify-center border transition-colors',
              editColor.toLowerCase() === color.text.toLowerCase()
                ? 'border-ink'
                : 'border-border hover:border-ink-soft',
            ]"
            :style="{ backgroundColor: color.background }"
            @click="editColor = color.text"
          >
            <Check
              v-if="editColor.toLowerCase() === color.text.toLowerCase()"
              :size="15"
              :style="{ color: color.text }"
            />
          </button>
        </div>
      </div>

      <div
        v-else
        class="flex min-h-14 items-center gap-3 px-4 py-3 hover:bg-hover"
      >
        <span
          class="h-4 w-4 shrink-0 border border-border"
          :style="{ backgroundColor: tag.color }"
        ></span>
        <span class="min-w-0 flex-1 truncate text-body font-semibold text-ink"
          >+{{ tag.name }}</span
        >
        <span class="shrink-0 text-small text-ink-muted">
          {{ t('tags.usage', usageByTagId[tag.id] ?? 0) }}
        </span>

        <template v-if="confirmDeleteId === tag.id">
          <button
            type="button"
            :disabled="deletingTagId === tag.id"
            class="min-h-9 border border-brick px-3 text-small font-semibold text-brick hover:bg-hover disabled:pointer-events-none disabled:opacity-50"
            @click="requestDelete(tag)"
          >
            {{ deletingTagId === tag.id ? t('tags.deleting') : t('tags.confirmDelete') }}
          </button>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center border border-border text-ink-soft hover:bg-hover hover:text-ink"
            :aria-label="t('tags.cancelDelete')"
            :title="t('tags.cancelDelete')"
            @click="cancelDelete"
          >
            <X :size="17" />
          </button>
        </template>

        <template v-else>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center border border-border text-ink-soft hover:border-blue hover:bg-hover hover:text-blue"
            :aria-label="t('tags.edit')"
            :title="t('tags.edit')"
            @click="startEditing(tag)"
          >
            <Pencil :size="16" />
          </button>
          <button
            type="button"
            class="flex h-9 w-9 items-center justify-center border border-border text-ink-soft hover:border-brick hover:bg-hover hover:text-brick"
            :aria-label="t('tags.delete')"
            :title="t('tags.delete')"
            @click="requestDelete(tag)"
          >
            <Trash2 :size="16" />
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
