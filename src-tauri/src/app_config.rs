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

static CONFIG_MUTEX: std::sync::Mutex<()> = std::sync::Mutex::new(());

const APP_CONFIG_FILE: &str = "app-config.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct AppConfig {
    pub postit_positions: Vec<PostitPosition>,
    pub favorite_paper_pens: Vec<FavoritePaperPen>,
    pub language: AppLanguage,
    pub theme: AppTheme,
    pub start_with_windows: bool,
    pub start_minimized: bool,
    pub minimize_to_tray_when_unlocked: bool,
    pub notifications_enabled: bool,
    pub badge_enabled: bool,
    pub completed_task_retention_days: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FavoritePaperPen {
    instrument: String,
    width: f64,
    opacity: f64,
    color: String,
    custom_color: Option<String>,
}
fn validate_favorite_pens(pens: &[FavoritePaperPen]) -> Result<(), String> {
    if pens.len() > 6 {
        return Err("No more than six favorite pens are allowed.".into());
    }
    for pen in pens {
        let valid_color = pen.custom_color.as_ref().is_none_or(|color| {
            color.len() == 7
                && color.starts_with('#')
                && color[1..].bytes().all(|byte| byte.is_ascii_hexdigit())
        });
        if !["pencil", "pen", "graphite", "fountain", "ink"].contains(&pen.instrument.as_str())
            || !["neutral", "amber", "sage", "blue", "rose", "purple"].contains(&pen.color.as_str())
            || !pen.width.is_finite()
            || !(0.1..=64.0).contains(&pen.width)
            || !pen.opacity.is_finite()
            || !(0.0..=1.0).contains(&pen.opacity)
            || !valid_color
        {
            return Err("Invalid favorite pen.".into());
        }
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum AppTheme {
    Light,
    Dark,
    Sepia,
    Forest,
    Midnight,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AppLanguage {
    #[serde(rename = "en")]
    En,
    #[serde(rename = "pt-BR")]
    PtBr,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            postit_positions: Vec::new(),
            favorite_paper_pens: Vec::new(),
            language: AppLanguage::En,
            theme: AppTheme::Light,
            start_with_windows: false,
            start_minimized: true,
            minimize_to_tray_when_unlocked: true,
            notifications_enabled: true,
            badge_enabled: true,
            completed_task_retention_days: Some(730),
        }
    }
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppConfigPatch {
    favorite_paper_pens: Option<Vec<FavoritePaperPen>>,
    language: Option<AppLanguage>,
    theme: Option<AppTheme>,
    start_with_windows: Option<bool>,
    start_minimized: Option<bool>,
    minimize_to_tray_when_unlocked: Option<bool>,
    notifications_enabled: Option<bool>,
    badge_enabled: Option<bool>,
    completed_task_retention_days: Option<Option<u32>>,
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
    let _guard = CONFIG_MUTEX
        .lock()
        .map_err(|_| "Configuracoes indisponiveis.")?;
    let mut config = load_app_config(&app)?;
    if let Some(pens) = patch.favorite_paper_pens {
        validate_favorite_pens(&pens)?;
        config.favorite_paper_pens = pens;
    }

    if let Some(value) = patch.language {
        config.language = value;
    }

    if let Some(value) = patch.theme {
        config.theme = value;
    }

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

    if let Some(value) = patch.badge_enabled {
        config.badge_enabled = value;
    }

    if let Some(value) = patch.completed_task_retention_days {
        config.completed_task_retention_days = value;
    }

    apply_autostart(&app, config.start_with_windows)?;
    save_app_config(&app, &config)?;
    Ok(config)
}

pub fn is_badge_enabled(app: &AppHandle) -> bool {
    load_app_config(app)
        .map(|config| config.badge_enabled)
        .unwrap_or(true)
}

pub fn completed_task_retention_days(app: &AppHandle) -> Option<u32> {
    load_app_config(app)
        .ok()
        .and_then(|config| config.completed_task_retention_days)
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

#[cfg(test)]
mod tests {
    use super::{AppConfig, AppConfigPatch, AppTheme};

    #[test]
    fn themes_round_trip_through_persisted_config_and_command_patch() {
        for (theme, value) in [
            (AppTheme::Light, "light"),
            (AppTheme::Dark, "dark"),
            (AppTheme::Sepia, "sepia"),
            (AppTheme::Forest, "forest"),
            (AppTheme::Midnight, "midnight"),
        ] {
            let config = AppConfig {
                theme: theme.clone(),
                ..AppConfig::default()
            };
            let serialized = serde_json::to_value(&config).expect("serialize app config");
            assert_eq!(serialized["theme"], value);

            let restored: AppConfig =
                serde_json::from_value(serialized).expect("deserialize app config");
            assert_eq!(restored.theme, theme);

            let patch: AppConfigPatch = serde_json::from_value(serde_json::json!({
                "theme": value,
            }))
            .expect("deserialize theme patch");
            assert_eq!(patch.theme, Some(theme));
        }
    }

    #[test]
    fn legacy_config_without_theme_keeps_light_default_and_existing_preferences() {
        let config: AppConfig = serde_json::from_value(serde_json::json!({
            "notificationsEnabled": false,
            "completedTaskRetentionDays": null,
        }))
        .expect("deserialize legacy config");

        assert_eq!(config.theme, AppTheme::Light);
        assert!(!config.notifications_enabled);
        assert_eq!(config.completed_task_retention_days, None);
    }

    #[test]
    fn unknown_theme_is_rejected_instead_of_silently_overwriting_preferences() {
        let config = serde_json::json!({ "theme": "unknown" });

        assert!(serde_json::from_value::<AppConfig>(config.clone()).is_err());
        assert!(serde_json::from_value::<AppConfigPatch>(config).is_err());
    }
}

#[cfg(test)]
mod favorite_pen_tests {
    use super::*;
    #[test]
    fn favorite_pens_are_bounded_and_backwards_compatible() {
        let pen = FavoritePaperPen {
            instrument: "ink".into(),
            width: 2.0,
            opacity: 0.8,
            color: "neutral".into(),
            custom_color: Some("#202124".into()),
        };
        assert!(validate_favorite_pens(&[pen.clone()]).is_ok());
        assert!(validate_favorite_pens(&vec![pen.clone(); 7]).is_err());
        let mut invalid = pen.clone();
        invalid.width = f64::NAN;
        assert!(validate_favorite_pens(&[invalid]).is_err());
        let mut invalid = pen;
        invalid.custom_color = Some("red".into());
        assert!(validate_favorite_pens(&[invalid]).is_err());
        let old: AppConfig = serde_json::from_str("{}").unwrap();
        assert!(old.favorite_paper_pens.is_empty());
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PostitPosition {
    key: String,
    x: f64,
    y: f64,
}
pub(crate) fn postit_position(app: &AppHandle, key: &str) -> Result<Option<(f64, f64)>, String> {
    let _guard = CONFIG_MUTEX
        .lock()
        .map_err(|_| "Configuracoes indisponiveis.")?;
    Ok(load_app_config(app)?
        .postit_positions
        .iter()
        .find(|p| p.key == key && p.x.is_finite() && p.y.is_finite())
        .map(|p| (p.x, p.y)))
}
pub(crate) fn save_postit_position(
    app: &AppHandle,
    key: &str,
    x: f64,
    y: f64,
) -> Result<(), String> {
    if !x.is_finite() || !y.is_finite() {
        return Err("Posicao invalida.".into());
    }
    let _guard = CONFIG_MUTEX
        .lock()
        .map_err(|_| "Configuracoes indisponiveis.")?;
    let mut config = load_app_config(app)?;
    config.postit_positions.retain(|p| p.key != key);
    if config.postit_positions.len() >= 500 {
        config.postit_positions.remove(0);
    }
    config.postit_positions.push(PostitPosition {
        key: key.into(),
        x,
        y,
    });
    save_app_config(app, &config)
}
