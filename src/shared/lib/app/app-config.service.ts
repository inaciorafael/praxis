import { invoke } from "@tauri-apps/api/core";

import type { AppConfig, AppConfigPatch, AppHealth } from "@/shared/types/app";

export async function getAppConfig() {
  return invoke<AppConfig>("get_app_config");
}

export async function updateAppConfig(patch: AppConfigPatch) {
  return invoke<AppConfig>("update_app_config", { patch });
}

export async function getAppHealth() {
  return invoke<AppHealth>("get_app_health");
}
