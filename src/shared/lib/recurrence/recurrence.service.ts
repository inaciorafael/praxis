import { invoke } from "@tauri-apps/api/core";

import type {
  CreateRecurrenceRuleInput,
  RecurrenceCollection,
  UpdateRecurrenceRuleInput,
} from "@/shared/types/recurrence";

export async function listRecurrenceRules() {
  return invoke<RecurrenceCollection>("list_recurrence_rules");
}

export async function createRecurrenceRule(input: CreateRecurrenceRuleInput) {
  return invoke<RecurrenceCollection>("create_recurrence_rule", { input });
}

export async function updateRecurrenceRule(id: string, input: UpdateRecurrenceRuleInput) {
  return invoke<RecurrenceCollection>("update_recurrence_rule", { id, input });
}

export async function deleteRecurrenceRule(id: string) {
  return invoke<RecurrenceCollection>("delete_recurrence_rule", { id });
}
