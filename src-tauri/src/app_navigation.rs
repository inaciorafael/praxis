use serde::Serialize;

const OPEN_VIEW_ARGUMENT: &str = "--open-view";

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppNavigationRequest {
    pub view: String,
}

pub struct AppNavigationStore(pub std::sync::Mutex<Option<AppNavigationRequest>>);

impl AppNavigationStore {
    pub fn new(request: Option<AppNavigationRequest>) -> Self {
        Self(std::sync::Mutex::new(request))
    }
}

pub fn parse_navigation_request(
    arguments: impl IntoIterator<Item = impl AsRef<str>>,
) -> Option<AppNavigationRequest> {
    let arguments = arguments
        .into_iter()
        .map(|argument| argument.as_ref().to_string())
        .collect::<Vec<_>>();

    for (index, argument) in arguments.iter().enumerate() {
        let view = argument
            .strip_prefix(&format!("{OPEN_VIEW_ARGUMENT}="))
            .map(str::to_string)
            .or_else(|| {
                (argument == OPEN_VIEW_ARGUMENT)
                    .then(|| arguments.get(index + 1).cloned())
                    .flatten()
            });

        if let Some(view) = view.and_then(|view| normalize_view(&view)) {
            return Some(AppNavigationRequest { view: view.into() });
        }
    }

    None
}

pub fn store_navigation_request(
    store: &AppNavigationStore,
    request: AppNavigationRequest,
) -> Result<(), String> {
    let mut pending = store.0.lock().map_err(|error| error.to_string())?;
    *pending = Some(request);
    Ok(())
}

#[tauri::command]
pub fn take_app_navigation_request(
    store: tauri::State<'_, AppNavigationStore>,
) -> Result<Option<AppNavigationRequest>, String> {
    let mut pending = store.0.lock().map_err(|error| error.to_string())?;
    Ok(pending.take())
}

fn normalize_view(view: &str) -> Option<&'static str> {
    match view.trim().to_ascii_lowercase().as_str() {
        "today" => Some("today"),
        "my-week" => Some("my-week"),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_navigation_request_in_both_supported_formats() {
        assert_eq!(
            parse_navigation_request(["praxis.exe", "--open-view=my-week"])
                .map(|request| request.view),
            Some("my-week".into())
        );
        assert_eq!(
            parse_navigation_request(["praxis.exe", "--open-view", "today"])
                .map(|request| request.view),
            Some("today".into())
        );
    }

    #[test]
    fn rejects_unknown_navigation_targets() {
        assert!(parse_navigation_request(["praxis.exe", "--open-view=admin"]).is_none());
    }
}
