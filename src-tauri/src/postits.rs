use crate::vault::{self, VaultStore};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::HashSet, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

pub const PREFIX: &str = "postit-";
pub const CHANGED: &str = "praxis://postits-changed";
#[derive(Default)]
pub struct PostitRuntime {
    gate: Mutex<()>,
    dragged: Mutex<HashSet<String>>,
    moves: Mutex<std::collections::HashMap<String, (f64, f64, std::time::Instant)>>,
}

#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Postit {
    pub id: String,
    pub title: String,
    pub body: String,
    pub revision: u64,
    pub pinned: bool,
    pub collapsed: bool,
    pub archived: bool,
    #[serde(default)]
    pub completed_at: Option<i64>,
    pub color: String,
}
#[derive(Clone, Serialize)]
pub struct PostitView {
    pub record: Postit,
    pub title: String,
}
#[derive(Serialize)]
pub struct PostitList {
    pub notes: Vec<PostitView>,
}
#[derive(Deserialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PostitChange {
    pub id: String,
    pub expected_revision: u64,
    pub title: Option<String>,
    pub body: Option<String>,
    pub pinned: Option<bool>,
    pub collapsed: Option<bool>,
    pub completed: Option<bool>,
    pub color: Option<String>,
    #[serde(default)]
    pub remove: bool,
}
fn valid_color(color: &str) -> bool {
    ["yellow", "pink", "green", "blue"].contains(&color)
}
fn read_records(document: &Value) -> Result<Vec<Postit>, String> {
    // Legacy task-linked records are copied into independent notes on first mutation.
    // Reading never changes the vault or the original task.
    let mut records = Vec::new();
    if let Some(value) = document.get("desktopPostits") {
        let entries = value.as_array().ok_or("Post-its invalidos no cofre.")?;
        for entry in entries {
            if let Some(task_id) = entry.get("taskId").and_then(Value::as_str) {
                let task = document
                    .get("tasks")
                    .and_then(Value::as_array)
                    .and_then(|tasks| tasks.iter().find(|task| task["id"] == task_id));
                records.push(Postit {
                    id: task_id.to_string(),
                    title: task
                        .and_then(|task| task["title"].as_str())
                        .unwrap_or("Post-it")
                        .into(),
                    body: String::new(),
                    revision: entry["revision"].as_u64().unwrap_or(1),
                    pinned: entry["pinned"].as_bool().unwrap_or(false),
                    collapsed: entry["collapsed"].as_bool().unwrap_or(false),
                    archived: false,
                    completed_at: None,
                    color: entry["color"].as_str().unwrap_or("yellow").into(),
                });
            } else {
                records.push(
                    serde_json::from_value(entry.clone())
                        .map_err(|_| "Post-its invalidos no cofre.")?,
                );
            }
        }
    }
    let mut ids = HashSet::new();
    if records.len() > 500
        || records.iter().any(|note| {
            !ids.insert(&note.id)
                || (note.id.is_empty()
                    || note.id.len() > 100
                    || !note
                        .id
                        .chars()
                        .all(|c| c.is_ascii_alphanumeric() || c == '-'))
                || note.revision == 0
                || !valid_color(&note.color)
                || note.title.chars().count() > 200
                || note.body.chars().count() > 10000
        })
    {
        return Err("Post-its invalidos no cofre.".into());
    }
    Ok(records)
}
const RETENTION_MS: i64 = 7 * 24 * 60 * 60 * 1000;
fn now_ms() -> i64 {
    time::OffsetDateTime::now_utc().unix_timestamp() * 1000
}
fn expired(note: &Postit, now: i64) -> bool {
    note.archived
        && note
            .completed_at
            .is_some_and(|at| now.saturating_sub(at) >= RETENTION_MS)
}
fn clean_completed(document: &mut Value, now: i64) -> Result<(), String> {
    let mut records = read_records(document)?;
    let before = serde_json::to_value(&records).map_err(|e| e.to_string())?;
    records.retain(|note| !expired(note, now));
    for note in &mut records {
        if note.archived && note.completed_at.is_none() {
            note.completed_at = Some(now);
        }
    }
    let after = serde_json::to_value(records).map_err(|e| e.to_string())?;
    if before != after {
        document["desktopPostits"] = after;
    }
    Ok(())
}
fn snapshot(document: &Value) -> Result<PostitList, String> {
    Ok(PostitList {
        notes: read_records(document)?
            .into_iter()
            .filter(|note| !expired(note, now_ms()))
            .map(|record| PostitView {
                title: record.title.clone(),
                record,
            })
            .collect(),
    })
}
fn change_document(document: &mut Value, change: PostitChange) -> Result<(), String> {
    let mut records = read_records(document)?;
    records.retain(|note| !expired(note, now_ms()));
    let existing = records.iter().position(|note| note.id == change.id);
    let revision = existing.map(|i| records[i].revision).unwrap_or(0);
    if revision != change.expected_revision {
        return Err("O post-it mudou. Atualize e tente novamente.".into());
    }
    if change.remove {
        records.retain(|note| note.id != change.id);
    } else {
        let index = match existing {
            Some(index) => index,
            None => {
                uuid::Uuid::parse_str(&change.id).map_err(|_| "Identificador invalido.")?;
                if records.len() >= 500 {
                    return Err("Limite de 500 post-its atingido.".into());
                }
                records.push(Postit {
                    id: change.id,
                    title: String::new(),
                    body: String::new(),
                    revision: 0,
                    pinned: false,
                    collapsed: true,
                    archived: false,
                    completed_at: None,
                    color: "yellow".into(),
                });
                records.len() - 1
            }
        };
        let note = &mut records[index];
        if let Some(title) = change.title {
            note.title = title.trim().into();
        }
        if let Some(body) = change.body {
            note.body = body;
        }
        if note.title.is_empty() && note.body.trim().is_empty() {
            return Err("Escreva algo no post-it.".into());
        }
        if note.title.chars().count() > 200 || note.body.chars().count() > 10000 {
            return Err("Texto muito longo.".into());
        }
        if let Some(color) = change.color {
            if !valid_color(&color) {
                return Err("Cor invalida.".into());
            }
            note.color = color;
        }
        if let Some(pinned) = change.pinned {
            note.pinned = pinned;
        }
        if let Some(collapsed) = change.collapsed {
            note.collapsed = collapsed;
        }
        if let Some(completed) = change.completed {
            if completed && !note.archived {
                note.completed_at = Some(now_ms());
            }
            if !completed {
                note.completed_at = None;
            }
            note.archived = completed;
        }
        if note.archived {
            note.pinned = false;
        }
        note.revision += 1;
    }
    document["desktopPostits"] =
        serde_json::to_value(records).map_err(|error| error.to_string())?;
    Ok(())
}
fn label(file_id: &str, task_id: &str) -> String {
    format!("{PREFIX}{file_id}-{task_id}")
}
fn own_note(app: &AppHandle, window: &WebviewWindow) -> Result<PostitView, String> {
    let state = app.state::<VaultStore>();
    let file_id = vault::active_file_id(&state)?;
    let list = snapshot(&vault::read_active_document(&state)?)?;
    if vault::active_file_id(&state)? != file_id {
        return Err("O cofre mudou.".into());
    }
    list.notes
        .into_iter()
        .find(|note| {
            note.record.pinned
                && !note.record.archived
                && window.label() == label(&file_id, &note.record.id)
        })
        .ok_or_else(|| "Post-it indisponivel.".into())
}
fn authorize(app: &AppHandle, window: &WebviewWindow, task_id: &str) -> Result<String, String> {
    let file_id = vault::active_file_id(&app.state::<VaultStore>())?;
    if window.label() == "main" {
        return Ok(file_id);
    }
    if own_note(app, window)?.record.id == task_id {
        Ok(file_id)
    } else {
        Err("Post-it indisponivel.".into())
    }
}
#[tauri::command]
pub fn list_postits(app: AppHandle, window: WebviewWindow) -> Result<PostitList, String> {
    if window.label() != "main" {
        return Err("Operacao disponivel na janela principal.".into());
    }
    snapshot(&vault::read_active_document(&app.state::<VaultStore>())?)
}
#[tauri::command]
pub fn get_postit_window(
    app: AppHandle,
    window: WebviewWindow,
) -> Result<(PostitView, crate::app_config::AppConfig), String> {
    Ok((
        own_note(&app, &window)?,
        crate::app_config::get_app_config(app)?,
    ))
}
#[tauri::command]
pub fn change_postit(
    app: AppHandle,
    window: WebviewWindow,
    change: PostitChange,
) -> Result<(), String> {
    let file_id = authorize(&app, &window, &change.id)?;
    vault::mutate_matching_document(&app.state::<VaultStore>(), &file_id, |document| {
        change_document(document, change)
    })?;
    schedule_sync(&app);
    Ok(())
}
#[tauri::command]
pub fn open_postit(app: AppHandle, window: WebviewWindow, id: String) -> Result<(), String> {
    authorize(&app, &window, &id)?;
    crate::tray::show_main_window(&app);
    app.emit_to("main", "praxis://postit-open", id)
        .map_err(|error| error.to_string())
}
#[tauri::command]
pub fn sync_postits(app: AppHandle, window: WebviewWindow) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Operacao indisponivel.".into());
    }
    schedule_sync(&app);
    Ok(())
}
pub fn schedule_sync(app: &AppHandle) {
    let app = app.clone();
    tauri::async_runtime::spawn_blocking(move || {
        if let Err(error) = sync_native(&app) {
            let _ = app.emit_to("main", "praxis://postits-error", error);
        }
    });
}
pub fn close_all(app: &AppHandle) {
    let runtime = app.state::<PostitRuntime>();
    let Ok(_guard) = runtime.gate.lock() else {
        return;
    };
    for (label, window) in app.webview_windows() {
        if label.starts_with(PREFIX) {
            let _ = window.hide();
            let _ = window.destroy();
        }
    }
}
fn sync_native(app: &AppHandle) -> Result<(), String> {
    let runtime = app.state::<PostitRuntime>();
    let _guard = runtime
        .gate
        .lock()
        .map_err(|_| "Nao foi possivel atualizar os post-its.")?;
    let vault = app.state::<VaultStore>();
    let file_id = match vault::active_file_id(&vault) {
        Ok(id) => id,
        Err(_) => {
            for (name, window) in app.webview_windows() {
                if name.starts_with(PREFIX) {
                    let _ = window.hide();
                    let _ = window.destroy();
                }
            }
            return Ok(());
        }
    };
    vault::mutate_matching_document(&vault, &file_id, |document| {
        clean_completed(document, now_ms())
    })?;
    let list = snapshot(&vault::read_active_document(&vault)?)?;
    if vault::active_file_id(&vault)? != file_id {
        return Ok(());
    }
    let desired = list
        .notes
        .iter()
        .filter(|note| !note.record.archived && note.record.pinned)
        .take(3)
        .collect::<Vec<_>>();
    let labels: HashSet<String> = desired
        .iter()
        .map(|note| label(&file_id, &note.record.id))
        .collect();
    for (name, window) in app.webview_windows() {
        if name.starts_with(PREFIX) && !labels.contains(&name) {
            let _ = window.hide();
            let _ = window.destroy();
        }
    }
    let monitor = app
        .get_webview_window("main")
        .and_then(|window| window.current_monitor().ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten());
    for (index, note) in desired.iter().enumerate() {
        let name = label(&file_id, &note.record.id);
        let width = if note.record.collapsed { 132.0 } else { 248.0 };
        let height = if note.record.collapsed { 48.0 } else { 210.0 };
        if let Some(window) = app.get_webview_window(&name) {
            let _ = window.set_size(tauri::LogicalSize::new(width, height));
            let _ = window.emit(CHANGED, ());
            continue;
        }
        let (x, y) = monitor
            .as_ref()
            .map(|monitor| {
                let scale = monitor.scale_factor();
                let area = monitor.work_area();
                {
                    let rows = ((area.size.height as f64 / scale - 32.0) / 224.0)
                        .floor()
                        .max(1.0) as usize;
                    (
                        area.position.x as f64 / scale + area.size.width as f64 / scale
                            - 264.0
                            - (index / rows) as f64 * 260.0,
                        area.position.y as f64 / scale + 20.0 + (index % rows) as f64 * 224.0,
                    )
                }
            })
            .unwrap_or((80.0, 80.0 + index as f64 * 224.0));
        let saved = crate::app_config::postit_position(app, &name)
            .ok()
            .flatten();
        let (x, y) = saved
            .filter(|(x, y)| {
                monitor.as_ref().is_some_and(|m| {
                    let scale = m.scale_factor();
                    let area = m.work_area();
                    *x >= area.position.x as f64 / scale
                        && *y >= area.position.y as f64 / scale
                        && *x + 248.0 <= (area.position.x as f64 + area.size.width as f64) / scale
                        && *y + height <= (area.position.y as f64 + area.size.height as f64) / scale
                })
            })
            .unwrap_or((x, y));
        WebviewWindowBuilder::new(
            app,
            name.clone(),
            WebviewUrl::App("index.html?postit=1".into()),
        )
        .title("Praxis · Post-it")
        .inner_size(width, height)
        .position(x, y)
        .decorations(false)
        .resizable(false)
        .always_on_top(true)
        .skip_taskbar(true)
        .focused(false)
        .shadow(true)
        .on_navigation(|url| {
            url.scheme() == "tauri"
                || url.host_str() == Some("tauri.localhost")
                || (matches!(url.host_str(), Some("localhost" | "127.0.0.1"))
                    && url.port() == Some(1420))
        })
        .build()
        .map_err(|error| error.to_string())?;
    }
    let _ = app.emit_to("main", CHANGED, ());
    Ok(())
}
pub fn retire_window(app: AppHandle, window: WebviewWindow) {
    tauri::async_runtime::spawn_blocking(move || {
        let result = own_note(&app, &window).and_then(|note| {
            change_postit(
                app.clone(),
                window.clone(),
                PostitChange {
                    id: note.record.id,
                    expected_revision: note.record.revision,
                    pinned: Some(false),
                    collapsed: None,
                    color: None,
                    ..Default::default()
                },
            )
        });
        if let Err(error) = result {
            let _ = window.emit("praxis://postits-error", error);
        }
    });
}

#[tauri::command]
pub fn drag_postit(app: AppHandle, window: WebviewWindow) -> Result<(), String> {
    own_note(&app, &window)?;
    app.state::<PostitRuntime>()
        .dragged
        .lock()
        .map_err(|_| "Posicao indisponivel.")?
        .insert(window.label().to_string());
    window.start_dragging().map_err(|error| error.to_string())
}
pub fn remember_position(app: &AppHandle, name: &str, x: i32, y: i32) {
    let runtime = app.state::<PostitRuntime>();
    if !runtime.dragged.lock().is_ok_and(|set| set.contains(name)) {
        return;
    }
    let Some(window) = app.get_webview_window(name) else {
        return;
    };
    let scale = window.scale_factor().unwrap_or(1.0);
    let Ok(mut moves) = runtime.moves.lock() else {
        return;
    };
    let start = moves
        .insert(
            name.into(),
            (
                x as f64 / scale,
                y as f64 / scale,
                std::time::Instant::now(),
            ),
        )
        .is_none();
    drop(moves);
    if !start {
        return;
    }
    let app = app.clone();
    let name = name.to_string();
    tauri::async_runtime::spawn_blocking(move || loop {
        std::thread::sleep(std::time::Duration::from_millis(450));
        let runtime = app.state::<PostitRuntime>();
        let Ok(mut moves) = runtime.moves.lock() else {
            return;
        };
        let Some(position) = moves.get(&name).copied() else {
            return;
        };
        if position.2.elapsed().as_millis() < 400 {
            continue;
        }
        moves.remove(&name);
        drop(moves);
        let _ = crate::app_config::save_postit_position(&app, &name, position.0, position.1);
        break;
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn input(revision: u64) -> PostitChange {
        PostitChange {
            id: "c904c973-5060-42c6-8915-89f947d6b143".into(),
            expected_revision: revision,
            title: Some("Nota".into()),
            ..Default::default()
        }
    }
    #[test]
    fn independent_note_without_tasks() {
        let mut doc = json!({});
        change_document(&mut doc, input(0)).unwrap();
        assert_eq!(snapshot(&doc).unwrap().notes.len(), 1);
        assert!(doc.get("tasks").is_none());
        assert!(change_document(&mut doc, input(0)).is_err());
    }
    #[test]
    fn archive_unpins_without_touching_tasks() {
        let mut doc = json!({"tasks":[{"id":"x","title":"Original"}]});
        let tasks = doc["tasks"].clone();
        let mut change = input(0);
        change.pinned = Some(true);
        change_document(&mut doc, change).unwrap();
        let mut change = input(1);
        change.completed = Some(true);
        change_document(&mut doc, change).unwrap();
        assert!(!snapshot(&doc).unwrap().notes[0].record.pinned);
        assert_eq!(tasks, doc["tasks"]);
    }
    #[test]
    fn legacy_read_is_non_mutating_and_first_edit_detaches() {
        let mut doc = json!({"tasks":[{"id":"old","title":"Original"}],"desktopPostits":[{"taskId":"old","revision":1,"pinned":true,"collapsed":false,"color":"yellow"}]});
        let before = doc.clone();
        assert_eq!(snapshot(&doc).unwrap().notes[0].title, "Original");
        assert_eq!(doc, before);
        change_document(
            &mut doc,
            PostitChange {
                id: "old".into(),
                expected_revision: 1,
                body: Some("Livre".into()),
                ..Default::default()
            },
        )
        .unwrap();
        doc["tasks"] = json!([]);
        assert_eq!(snapshot(&doc).unwrap().notes[0].record.body, "Livre");
    }

    #[test]
    fn completed_notes_expire_at_exactly_seven_days_and_preserve_tasks() {
        let mut doc = json!({"tasks":[{"id":"t","title":"Untouched"}]});
        change_document(&mut doc, input(0)).unwrap();
        doc["desktopPostits"][0]["archived"] = json!(true);
        doc["desktopPostits"][0]["completedAt"] = json!(1000);
        let before = doc.clone();
        clean_completed(&mut doc, 1000 + RETENTION_MS - 1).unwrap();
        assert_eq!(doc, before);
        clean_completed(&mut doc, 1000 + RETENTION_MS).unwrap();
        assert!(read_records(&doc).unwrap().is_empty());
        assert_eq!(doc["tasks"], before["tasks"]);
    }
    #[test]
    fn reopening_clears_deadline_and_old_archives_get_one_week() {
        let mut doc = json!({});
        change_document(&mut doc, input(0)).unwrap();
        doc["desktopPostits"][0]["archived"] = json!(true);
        let now = now_ms();
        clean_completed(&mut doc, now).unwrap();
        assert_eq!(read_records(&doc).unwrap()[0].completed_at, Some(now));
        let mut change = input(1);
        change.completed = Some(false);
        change_document(&mut doc, change).unwrap();
        assert_eq!(read_records(&doc).unwrap()[0].completed_at, None);
        clean_completed(&mut doc, i64::MAX).unwrap();
        assert_eq!(read_records(&doc).unwrap().len(), 1);
    }
}
