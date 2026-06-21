use std::{fs, path::PathBuf};

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use tauri_plugin_autostart::ManagerExt;
use time::{format_description::well_known::Rfc3339, OffsetDateTime};

use crate::{
    badge::BadgeStore,
    native_reminders,
    reminders::{read_reminders_from_document, ReminderStatus},
    vault::{self, read_active_document, VaultStore},
};

const APP_CONFIG_FILE: &str = "app-config.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfig {
    pub start_with_windows: bool,
    pub start_minimized: bool,
    pub minimize_to_tray_when_unlocked: bool,
    pub notifications_enabled: bool,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            start_with_windows: false,
            start_minimized: true,
            minimize_to_tray_when_unlocked: true,
            notifications_enabled: true,
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfigPatch {
    start_with_windows: Option<bool>,
    start_minimized: Option<bool>,
    minimize_to_tray_when_unlocked: Option<bool>,
    notifications_enabled: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeSnapshot {
    platform: String,
    process_id: u32,
    app_version: String,
    autostart_enabled: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultHealth {
    active: bool,
    active_data_file_path: Option<String>,
    selected_data_file_path: Option<String>,
    file_id: Option<String>,
    schema_version: Option<u32>,
    data_file_updated_at: Option<String>,
    data_file_modified_at: Option<String>,
    credential_saved: bool,
    auto_unlock_error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReminderHealth {
    total: usize,
    scheduled: usize,
    fired: usize,
    cancelled: usize,
    native_scheduled: usize,
    native_supported: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SafetyCopyHealth {
    count: usize,
    directory: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppHealth {
    checked_at: String,
    config: AppConfig,
    runtime: RuntimeSnapshot,
    vault: VaultHealth,
    badge_count: u32,
    reminders: ReminderHealth,
    safety_copies: SafetyCopyHealth,
}

#[tauri::command]
pub fn get_app_config(app: AppHandle) -> Result<AppConfig, String> {
    load_app_config(&app)
}

#[tauri::command]
pub fn update_app_config(app: AppHandle, patch: AppConfigPatch) -> Result<AppConfig, String> {
    let mut config = load_app_config(&app)?;

    if let Some(value) = patch.start_with_windows {
        config.start_with_windows = value;
    }

    if let Some(value) = patch.start_minimized {
        config.start_minimized = value;
    }

    if let Some(value) = patch.minimize_to_tray_when_unlocked {
        config.minimize_to_tray_when_unlocked = value;
    }

    if let Some(value) = patch.notifications_enabled {
        config.notifications_enabled = value;
    }

    apply_autostart(&app, config.start_with_windows)?;
    save_app_config(&app, &config)?;
    Ok(config)
}

#[tauri::command]
pub fn get_app_health(
    app: AppHandle,
    vault_state: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
) -> Result<AppHealth, String> {
    let config = load_app_config(&app)?;
    let vault_status = vault::vault_status(&app, &vault_state)?;
    let badge_count = badge_state
        .0
        .lock()
        .map(|state| state.count)
        .unwrap_or_default();
    let reminders = reminder_health(&app, &vault_state);
    let safety_copies = vault::list_safety_copies(app.clone())?;
    let safety_copies_dir = vault::get_safety_copies_dir(app.clone())?;

    Ok(AppHealth {
        checked_at: now_iso()?,
        config,
        runtime: RuntimeSnapshot {
            platform: std::env::consts::OS.to_string(),
            process_id: std::process::id(),
            app_version: app.package_info().version.to_string(),
            autostart_enabled: is_autostart_enabled(&app),
        },
        vault: VaultHealth {
            active: vault_status.active,
            active_data_file_path: vault_status.active_data_file_path,
            selected_data_file_path: vault_status.selected_data_file_path,
            file_id: vault_status.file_id,
            schema_version: vault_status.schema_version,
            data_file_updated_at: vault_status.data_file_updated_at,
            data_file_modified_at: vault_status.data_file_modified_at,
            credential_saved: vault_status.credential_saved,
            auto_unlock_error: vault_status.auto_unlock_error,
        },
        badge_count,
        reminders,
        safety_copies: SafetyCopyHealth {
            count: safety_copies.len(),
            directory: safety_copies_dir,
        },
    })
}

fn load_app_config(app: &AppHandle) -> Result<AppConfig, String> {
    let path = app_config_path(app)?;

    if !path.exists() {
        let config = AppConfig::default();
        save_app_config(app, &config)?;
        return Ok(config);
    }

    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let mut config: AppConfig =
        serde_json::from_str(&content).map_err(|error| error.to_string())?;
    config.start_with_windows = is_autostart_enabled(app);
    Ok(config)
}

fn save_app_config(app: &AppHandle, config: &AppConfig) -> Result<(), String> {
    let path = app_config_path(app)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let content = serde_json::to_string_pretty(config).map_err(|error| error.to_string())?;
    fs::write(path, content).map_err(|error| error.to_string())
}

fn apply_autostart(app: &AppHandle, enabled: bool) -> Result<(), String> {
    let autostart = app.autolaunch();

    if enabled {
        autostart.enable().map_err(|error| error.to_string())
    } else {
        autostart.disable().map_err(|error| error.to_string())
    }
}

fn is_autostart_enabled(app: &AppHandle) -> bool {
    app.autolaunch().is_enabled().unwrap_or(false)
}

fn reminder_health(app: &AppHandle, vault_state: &VaultStore) -> ReminderHealth {
    let native_scheduled = native_reminders::native_reminder_count(app);
    let native_supported = cfg!(target_os = "windows");

    let Ok(document) = read_active_document(vault_state) else {
        return ReminderHealth {
            total: 0,
            scheduled: 0,
            fired: 0,
            cancelled: 0,
            native_scheduled,
            native_supported,
        };
    };
    let Ok(reminders) = read_reminders_from_document(&document) else {
        return ReminderHealth {
            total: 0,
            scheduled: 0,
            fired: 0,
            cancelled: 0,
            native_scheduled,
            native_supported,
        };
    };

    ReminderHealth {
        total: reminders.len(),
        scheduled: reminders
            .iter()
            .filter(|reminder| reminder.status == ReminderStatus::Scheduled)
            .count(),
        fired: reminders
            .iter()
            .filter(|reminder| reminder.status == ReminderStatus::Fired)
            .count(),
        cancelled: reminders
            .iter()
            .filter(|reminder| reminder.status == ReminderStatus::Cancelled)
            .count(),
        native_scheduled,
        native_supported,
    }
}

fn app_config_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(APP_CONFIG_FILE))
        .map_err(|error| error.to_string())
}

fn now_iso() -> Result<String, String> {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .map_err(|error| error.to_string())
}
