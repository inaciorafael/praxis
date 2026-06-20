use std::sync::Mutex;

use serde::Serialize;

pub struct NotificationLaunchStore(pub Mutex<Option<NotificationLaunchContext>>);

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NotificationLaunchContext {
    pub source: String,
    pub reminder_id: String,
}

#[tauri::command]
pub fn get_notification_launch_context(
    state: tauri::State<'_, NotificationLaunchStore>,
) -> Option<NotificationLaunchContext> {
    state.0.lock().ok().and_then(|state| state.clone())
}

#[tauri::command]
pub fn clear_notification_launch_context(
    state: tauri::State<'_, NotificationLaunchStore>,
) -> Result<(), String> {
    let mut state = state
        .0
        .lock()
        .map_err(|_| "Nao foi possivel limpar o contexto da notificacao.".to_string())?;

    *state = None;
    Ok(())
}

pub fn parse_notification_launch_context(
    args: impl IntoIterator<Item = String>,
) -> Option<NotificationLaunchContext> {
    let args = args.into_iter().collect::<Vec<_>>();
    let reminder_id = args
        .windows(2)
        .find(|window| window[0] == "--from-native-reminder")
        .map(|window| window[1].clone())?;

    Some(NotificationLaunchContext {
        source: "nativeReminder".into(),
        reminder_id,
    })
}

pub fn store_launch_context(
    state: &NotificationLaunchStore,
    context: NotificationLaunchContext,
) -> Result<(), String> {
    let mut state = state
        .0
        .lock()
        .map_err(|_| "Nao foi possivel salvar o contexto da notificacao.".to_string())?;

    *state = Some(context);
    Ok(())
}
