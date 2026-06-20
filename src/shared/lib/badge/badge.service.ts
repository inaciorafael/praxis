import { invoke } from "@tauri-apps/api/core";

import type { BadgeSnapshot } from "@/shared/types/badge";

type NativeBadgeSnapshot = {
  count: number;
  visible: boolean;
  platform: string;
  native_badge_supported: boolean;
  persists_when_closed: boolean;
};

function normalizeBadgeSnapshot(snapshot: NativeBadgeSnapshot): BadgeSnapshot {
  return {
    count: snapshot.count,
    visible: snapshot.visible,
    platform: snapshot.platform,
    nativeBadgeSupported: snapshot.native_badge_supported,
    persistsWhenClosed: snapshot.persists_when_closed,
  };
}

export async function getBadgeCount() {
  const snapshot = await invoke<NativeBadgeSnapshot>("get_badge_count");
  return normalizeBadgeSnapshot(snapshot);
}

export async function setBadgeCount(count: number) {
  const snapshot = await invoke<NativeBadgeSnapshot>("set_badge_count", {
    count: Math.max(0, Math.floor(count)),
  });

  return normalizeBadgeSnapshot(snapshot);
}

export async function clearBadgeCount() {
  const snapshot = await invoke<NativeBadgeSnapshot>("clear_badge_count");
  return normalizeBadgeSnapshot(snapshot);
}
