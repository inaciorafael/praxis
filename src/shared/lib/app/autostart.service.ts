import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";

export async function isAutostartEnabled() {
  return isEnabled();
}

export async function setAutostartEnabled(enabled: boolean) {
  if (enabled) {
    await enable();
    return true;
  }

  await disable();
  return false;
}
