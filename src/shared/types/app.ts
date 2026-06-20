export type AppConfig = {
  startWithWindows: boolean;
  startMinimized: boolean;
  minimizeToTrayWhenUnlocked: boolean;
  notificationsEnabled: boolean;
};

export type AppConfigPatch = Partial<AppConfig>;

export type RuntimeSnapshot = {
  platform: string;
  processId: number;
  appVersion: string;
  autostartEnabled: boolean;
};

export type VaultHealth = {
  active: boolean;
  activeDataFilePath: string | null;
  selectedDataFilePath: string | null;
  fileId: string | null;
  schemaVersion: number | null;
  credentialSaved: boolean;
  autoUnlockError: string | null;
};

export type ReminderHealth = {
  total: number;
  scheduled: number;
  fired: number;
  cancelled: number;
  nativeScheduled: number;
  nativeSupported: boolean;
};

export type SafetyCopyHealth = {
  count: number;
  directory: string;
};

export type AppHealth = {
  checkedAt: string;
  config: AppConfig;
  runtime: RuntimeSnapshot;
  vault: VaultHealth;
  badgeCount: number;
  reminders: ReminderHealth;
  safetyCopies: SafetyCopyHealth;
};
