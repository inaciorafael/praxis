mod app_config;
mod badge;
mod checklist;
mod lifecycle;
mod native_reminders;
mod notification_launch;
mod recurrence;
mod reminders;
mod tags;
mod tasks;
mod tray;
mod vault;

use badge::{apply_badge_count, load_badge_count, BadgeState, BadgeStore};
use notification_launch::NotificationLaunchStore;
use tauri::{Emitter, Manager};
use tray::{setup_tray, AppLifecycle};
use vault::{VaultState, VaultStore};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(context) =
                notification_launch::parse_notification_launch_context(_argv.into_iter())
            {
                let state = app.state::<NotificationLaunchStore>();
                let _ = notification_launch::store_launch_context(&state, context.clone());
                let _ = app.emit("praxis://notification-launch", context);
            }

            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--minimized"]),
        ))
        .setup(|app| {
            let start_minimized =
                std::env::args().any(|arg| arg == "--minimized" || arg == "--background");
            let count = load_badge_count(app.handle());
            app.manage(AppLifecycle::new());
            app.manage(BadgeStore(std::sync::Mutex::new(BadgeState { count })));
            app.manage(VaultStore(std::sync::Mutex::new(VaultState::default())));
            app.manage(NotificationLaunchStore(std::sync::Mutex::new(
                notification_launch::parse_notification_launch_context(std::env::args()),
            )));
            setup_tray(app)?;
            vault::auto_unlock_data_file(app.handle())?;
            apply_badge_count(app.handle(), count)?;

            if start_minimized {
                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.minimize();
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let app = window.app_handle();
                let lifecycle = app.state::<AppLifecycle>();

                if lifecycle.is_quitting() {
                    return;
                }

                let vault_is_active = app
                    .state::<VaultStore>()
                    .0
                    .lock()
                    .map(|state| state.active.is_some())
                    .unwrap_or(false);

                if vault_is_active {
                    api.prevent_close();
                    let _ = window.minimize();
                } else {
                    lifecycle.request_quit();
                    app.exit(0);
                }
            }
        })
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            app_config::get_app_config,
            app_config::update_app_config,
            app_config::get_app_health,
            lifecycle::list_task_timeline,
            badge::get_badge_count,
            badge::set_badge_count,
            badge::clear_badge_count,
            notification_launch::get_notification_launch_context,
            notification_launch::clear_notification_launch_context,
            vault::suggest_data_file_path,
            vault::get_vault_status,
            vault::validate_data_file,
            vault::list_safety_copies,
            vault::get_safety_copies_dir,
            vault::reload_active_data_file,
            vault::create_data_file,
            vault::open_data_file,
            vault::close_data_file,
            recurrence::list_recurrence_rules,
            recurrence::create_recurrence_rule,
            recurrence::update_recurrence_rule,
            recurrence::delete_recurrence_rule,
            tasks::list_tasks,
            tasks::list_today_tasks,
            tasks::list_week_tasks,
            tasks::list_pending_tasks,
            tasks::list_overdue_tasks,
            tasks::list_upcoming_tasks,
            tasks::list_reminder_tasks,
            tasks::list_completed_tasks,
            tasks::get_task_view_counts,
            tasks::generate_due_recurring_tasks,
            tasks::create_task,
            tasks::update_task,
            tasks::set_task_completed,
            tasks::delete_task,
            checklist::create_checklist_item,
            checklist::update_checklist_item,
            checklist::set_checklist_item_completed,
            checklist::delete_checklist_item,
            checklist::reorder_checklist_items,
            reminders::list_reminders,
            reminders::mark_reminder_fired,
            tags::list_tags,
            tags::create_tag,
            tags::update_tag,
            tags::delete_tag,
            tags::assign_tag_to_task,
            tags::remove_tag_from_task
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
