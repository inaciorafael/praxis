import { invoke } from "@tauri-apps/api/core";

import type { CreateTagInput, TagCollection, UpdateTagInput } from "@/shared/types/tag";

export async function listTags() {
  return invoke<TagCollection>("list_tags");
}

export async function createTag(input: CreateTagInput) {
  return invoke<TagCollection>("create_tag", { input });
}

export async function updateTag(id: string, input: UpdateTagInput) {
  return invoke<TagCollection>("update_tag", { id, input });
}

export async function deleteTag(id: string) {
  return invoke<TagCollection>("delete_tag", { id });
}

export async function assignTagToTask(taskId: string, tagId: string) {
  return invoke<TagCollection>("assign_tag_to_task", { taskId, tagId });
}

export async function removeTagFromTask(taskId: string, tagId: string) {
  return invoke<TagCollection>("remove_tag_from_task", { taskId, tagId });
}
