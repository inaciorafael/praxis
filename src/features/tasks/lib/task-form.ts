import { pickTagColorByName } from '@/shared/lib/tags/tag-color'
import { normalizeTagName } from '@/shared/lib/tags/inline-tag'
import type { Tag, TaskTag } from '@/shared/types/tag'

export type TaskFormDraft = {
  title: string
  notes: string
  plannedFor: string
  dueAt: string
  reminderAt: string
}

type TaskTagStore = {
  tags: Tag[]
  taskTags: TaskTag[]
  create(input: { name: string; color: string }): Promise<boolean>
  assignToTask(taskId: string, tagId: string): Promise<void>
  removeFromTask(taskId: string, tagId: string): Promise<void>
}

export function createTaskFormDraft(values: Partial<TaskFormDraft> = {}): TaskFormDraft {
  return {
    title: values.title ?? '',
    notes: values.notes ?? '',
    plannedFor: values.plannedFor ?? '',
    dueAt: values.dueAt ?? '',
    reminderAt: values.reminderAt ?? '',
  }
}

export function toDatetimeLocal(value: string | null) {
  if (!value) {
    return ''
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const timezoneOffset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - timezoneOffset).toISOString().slice(0, 16)
}

export function toIsoDateTime(value: string) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export function checklistItemsFromText(value: string) {
  return value
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function tagNamesForTask(
  tagStore: Pick<TaskTagStore, 'tags' | 'taskTags'>,
  taskId: string
) {
  const tagIds = new Set(
    tagStore.taskTags
      .filter((relation) => relation.taskId === taskId)
      .map((relation) => relation.tagId)
  )

  return tagStore.tags.filter((tag) => tagIds.has(tag.id)).map((tag) => tag.name)
}

export async function syncTaskTags(
  tagStore: TaskTagStore,
  taskId: string,
  tagNames: string[]
) {
  const resolvedTags = await resolveTaskTags(tagStore, tagNames)
  const desiredTagIds = new Set(resolvedTags.map((tag) => tag.id))
  const currentTagIds = new Set(
    tagStore.taskTags
      .filter((relation) => relation.taskId === taskId)
      .map((relation) => relation.tagId)
  )

  for (const tagId of desiredTagIds) {
    if (!currentTagIds.has(tagId)) {
      await tagStore.assignToTask(taskId, tagId)
    }
  }

  for (const tagId of currentTagIds) {
    if (!desiredTagIds.has(tagId)) {
      await tagStore.removeFromTask(taskId, tagId)
    }
  }
}

async function resolveTaskTags(tagStore: TaskTagStore, tagNames: string[]) {
  const resolvedTags: Tag[] = []

  for (const tagName of tagNames) {
    const normalizedName = normalizeTagName(tagName)
    let tag = tagStore.tags.find(
      (candidate) => normalizeTagName(candidate.name) === normalizedName
    )

    if (!tag) {
      const color = pickTagColorByName(tagName)
      const created = await tagStore.create({
        name: tagName.trim(),
        color: color.text,
      })

      if (!created) {
        continue
      }

      tag = tagStore.tags.find(
        (candidate) => normalizeTagName(candidate.name) === normalizedName
      )
    }

    if (tag) {
      resolvedTags.push(tag)
    }
  }

  return resolvedTags
}
