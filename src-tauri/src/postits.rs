use crate::vault::{self, VaultStore};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{collections::HashSet, sync::Mutex};
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

#[path = "postit_groups.rs"]
mod groups;
#[path = "postit_layout.rs"]
mod layout;
use groups::{PostitGroup, PostitGroupChange};
use layout::{FrameSize, PostitMode};

pub const PREFIX: &str = "postit-";
pub const CHANGED: &str = "praxis://postits-changed";
#[derive(Default)]
pub struct PostitRuntime {
    gate: Mutex<()>,
    dragged: Mutex<HashSet<String>>,
    frames: Mutex<std::collections::HashMap<String, layout::DesktopFrame>>,
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
    #[serde(default)]
    pub preferred_mode: Option<PostitMode>,
    #[serde(default)]
    pub mode_locked: bool,
    #[serde(default)]
    pub expanded_size: Option<FrameSize>,
    #[serde(default)]
    pub group_id: Option<String>,
}
#[derive(Clone, Serialize)]
pub struct PostitView {
    pub record: Postit,
    pub title: String,
}
#[derive(Serialize)]
pub struct PostitList {
    pub notes: Vec<PostitView>,
    pub groups: Vec<PostitGroup>,
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
    pub preferred_mode: Option<PostitMode>,
    pub mode_locked: Option<bool>,
    pub expanded_size: Option<FrameSize>,
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
                    preferred_mode: None,
                    mode_locked: false,
                    expanded_size: None,
                    group_id: None,
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
                || note.expanded_size.is_some_and(|size| !size.valid())
        })
    {
        return Err("Post-its invalidos no cofre.".into());
    }
    for note in &mut records {
        if note.preferred_mode.is_none() {
            note.preferred_mode = Some(if note.collapsed {
                PostitMode::Micro
            } else {
                PostitMode::Expanded
            });
        }
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
        groups: groups::read_groups(document)?,
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
                    preferred_mode: Some(PostitMode::Compact),
                    mode_locked: false,
                    expanded_size: None,
                    group_id: None,
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
            note.preferred_mode = Some(if collapsed {
                PostitMode::Micro
            } else {
                PostitMode::Expanded
            });
        }
        if let Some(mode) = change.preferred_mode {
            note.preferred_mode = Some(mode);
            note.collapsed = mode == PostitMode::Micro;
        }
        if let Some(locked) = change.mode_locked {
            note.mode_locked = locked;
        }
        if let Some(size) = change.expanded_size {
            if !size.valid() {
                return Err("Invalid expanded size.".into());
            }
            note.expanded_size = Some(size);
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
#[derive(Clone, Serialize)]
pub struct DesktopPostit {
    pub notes: Vec<PostitView>,
    pub group: Option<PostitGroup>,
}
fn desktop_entries(list: &PostitList) -> Vec<DesktopPostit> {
    let mut seen = HashSet::new();
    let mut entries = Vec::new();
    for note in list
        .notes
        .iter()
        .filter(|n| n.record.pinned && !n.record.archived)
    {
        let group = note
            .record
            .group_id
            .as_ref()
            .and_then(|id| list.groups.iter().find(|g| &g.id == id));
        if let Some(group) = group {
            if seen.insert(group.id.clone()) {
                entries.push(DesktopPostit {
                    notes: groups::members(&list.notes, &group.id)
                        .into_iter()
                        .cloned()
                        .collect(),
                    group: Some(group.clone()),
                });
            }
        } else {
            entries.push(DesktopPostit {
                notes: vec![note.clone()],
                group: None,
            });
        }
    }
    entries
}
fn entry_label(file: &str, entry: &DesktopPostit) -> String {
    label(
        file,
        &entry
            .group
            .as_ref()
            .map(|g| format!("group-{}", g.id))
            .unwrap_or_else(|| entry.notes[0].record.id.clone()),
    )
}
fn own_entry(app: &AppHandle, window: &WebviewWindow) -> Result<DesktopPostit, String> {
    let state = app.state::<VaultStore>();
    let file_id = vault::active_file_id(&state)?;
    let list = snapshot(&vault::read_active_document(&state)?)?;
    if vault::active_file_id(&state)? != file_id {
        return Err("O cofre mudou.".into());
    }
    desktop_entries(&list)
        .into_iter()
        .find(|e| window.label() == entry_label(&file_id, e))
        .ok_or_else(|| "Post-it indisponivel.".into())
}
fn authorize(app: &AppHandle, window: &WebviewWindow, task_id: &str) -> Result<String, String> {
    let file_id = vault::active_file_id(&app.state::<VaultStore>())?;
    if window.label() == "main" {
        return Ok(file_id);
    }
    if own_entry(app, window)?
        .notes
        .iter()
        .any(|n| n.record.id == task_id)
    {
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
) -> Result<(DesktopPostit, crate::app_config::AppConfig), String> {
    Ok((
        own_entry(&app, &window)?,
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
pub fn change_postit_group(
    app: AppHandle,
    window: WebviewWindow,
    change: PostitGroupChange,
) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Operacao disponivel na janela principal.".into());
    }
    let file_id = vault::active_file_id(&app.state::<VaultStore>())?;
    vault::mutate_matching_document(&app.state::<VaultStore>(), &file_id, |document| {
        groups::change_group(document, change)
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
    let preferences = crate::app_config::get_app_config(app.clone())?.postit_preferences;
    let desired = if preferences.desktop_enabled {
        desktop_entries(&list)
    } else {
        Vec::new()
    };
    let desired = desired
        .into_iter()
        .take(preferences.desktop_limit.clamp(1, 3))
        .collect::<Vec<_>>();
    let labels: HashSet<String> = desired
        .iter()
        .map(|entry| entry_label(&file_id, entry))
        .collect();
    for (name, window) in app.webview_windows() {
        if name.starts_with(PREFIX) && !labels.contains(&name) {
            let _ = window.hide();
            let _ = window.destroy();
        }
    }
    runtime
        .frames
        .lock()
        .map_err(|_| "Layout indisponivel.")?
        .retain(|name, _| labels.contains(name));
    let monitor = app
        .get_webview_window("main")
        .and_then(|w| w.current_monitor().ok().flatten())
        .or_else(|| app.primary_monitor().ok().flatten());
    for (index, entry) in desired.iter().enumerate() {
        let name = entry_label(&file_id, entry);
        let (mode, expanded) = entry_mode(entry);
        let size = layout::size(mode, expanded, entry.group.is_some());
        if let Some(window) = app.get_webview_window(&name) {
            apply_frame(app, &window, entry)?;
            let _ = window.emit(CHANGED, ());
            continue;
        }
        let area = monitor
            .as_ref()
            .map(monitor_area)
            .unwrap_or((0.0, 0.0, 1280.0, 800.0));
        let rows = ((area.3 - 32.0) / 160.0).floor().max(1.0) as usize;
        let initial = (
            area.0 + area.2 - 264.0 - (index / rows) as f64 * 260.0,
            area.1 + 20.0 + (index % rows) as f64 * 160.0,
        );
        // Keep each member's old key untouched while it belongs to a pile.
        let saved = crate::app_config::postit_position(app, &name)?;
        let anchor = saved.unwrap_or(initial);
        if saved.is_none() {
            crate::app_config::save_postit_position(app, &name, anchor.0, anchor.1)?;
        }
        let drawn = layout::anchored(anchor, size, area);
        runtime
            .frames
            .lock()
            .map_err(|_| "Layout indisponivel.")?
            .insert(
                name.clone(),
                layout::DesktopFrame {
                    anchor,
                    drawn,
                    size,
                    transient: None,
                    editing: false,
                    resizing: false,
                    active_note: None,
                },
            );
        let window =
            WebviewWindowBuilder::new(app, name, WebviewUrl::App("index.html?postit=1".into()))
                .title("Praxis · Post-it")
                .inner_size(size.width, size.height)
                .position(drawn.0, drawn.1)
                .min_inner_size(140.0, 32.0)
                .max_inner_size(600.0, 700.0)
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
                .map_err(|e| e.to_string())?;
        apply_frame(app, &window, entry)?;
    }
    let _ = app.emit_to("main", CHANGED, ());
    Ok(())
}
fn entry_mode(entry: &DesktopPostit) -> (PostitMode, Option<FrameSize>) {
    if entry.group.is_some() {
        (PostitMode::Micro, None)
    } else {
        let n = &entry.notes[0].record;
        (
            n.preferred_mode.unwrap_or(PostitMode::Compact),
            n.expanded_size,
        )
    }
}
fn monitor_area(m: &tauri::Monitor) -> (f64, f64, f64, f64) {
    monitor_area_at_scale(m, m.scale_factor())
}
fn monitor_area_at_scale(m: &tauri::Monitor, scale: f64) -> (f64, f64, f64, f64) {
    let a = m.work_area();
    (
        a.position.x as f64 / scale,
        a.position.y as f64 / scale,
        a.size.width as f64 / scale,
        a.size.height as f64 / scale,
    )
}
fn visible_position(
    app: &AppHandle,
    window: &WebviewWindow,
    position: (f64, f64),
) -> Option<(f64, f64)> {
    let monitor = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten())?;
    let outer = window.outer_size().ok()?;
    let area = monitor.work_area();
    Some(layout::anchored(
        position,
        FrameSize {
            width: outer.width as f64,
            height: outer.height as f64,
        },
        (
            area.position.x as f64,
            area.position.y as f64,
            area.size.width as f64,
            area.size.height as f64,
        ),
    ))
}
fn place_visible(
    app: &AppHandle,
    window: &WebviewWindow,
    logical: (f64, f64),
) -> Result<(), String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let physical = visible_position(app, window, (logical.0 * scale, logical.1 * scale))
        .ok_or("Area de trabalho indisponivel.")?;
    if let Ok(mut frames) = app.state::<PostitRuntime>().frames.lock() {
        if let Some(frame) = frames.get_mut(window.label()) {
            frame.drawn = (physical.0 / scale, physical.1 / scale);
        }
    }
    window
        .set_position(tauri::PhysicalPosition::new(
            physical.0.round() as i32,
            physical.1.round() as i32,
        ))
        .map_err(|e| e.to_string())
}
fn apply_frame(
    app: &AppHandle,
    window: &WebviewWindow,
    entry: &DesktopPostit,
) -> Result<(), String> {
    let area = window
        .current_monitor()
        .ok()
        .flatten()
        .or_else(|| app.primary_monitor().ok().flatten())
        .as_ref()
        .map(|monitor| monitor_area_at_scale(monitor, window.scale_factor().unwrap_or(1.0)))
        .unwrap_or((0.0, 0.0, 1280.0, 800.0));
    let runtime = app.state::<PostitRuntime>();
    let mut frames = runtime.frames.lock().map_err(|_| "Layout indisponivel.")?;
    let frame = frames
        .get_mut(window.label())
        .ok_or("Layout indisponivel.")?;
    if frame.resizing {
        return Ok(());
    }
    let (mut base, mut expanded) = entry_mode(entry);
    if let Some(note) = entry
        .notes
        .iter()
        .find(|n| Some(&n.record.id) == frame.active_note.as_ref())
    {
        expanded = note.record.expanded_size;
        base = note.record.preferred_mode.unwrap_or(PostitMode::Compact);
    }
    let mode = if frame.editing {
        PostitMode::Expanded
    } else {
        frame.transient.unwrap_or(base)
    };
    let size = layout::size(
        mode,
        expanded,
        entry.group.is_some() && frame.active_note.is_none(),
    );
    let size = FrameSize {
        width: size.width.min(area.2),
        height: size.height.min(area.3),
    };
    let drawn = layout::anchored(frame.anchor, size, area);
    frame.drawn = drawn;
    frame.size = size;
    // Release before native calls: window events can synchronously re-enter.
    drop(frames);
    window
        .set_size(tauri::LogicalSize::new(size.width, size.height))
        .map_err(|e| e.to_string())?;
    place_visible(app, window, drawn)?;
    Ok(())
}
#[tauri::command]
pub fn present_postit(
    app: AppHandle,
    window: WebviewWindow,
    mode: Option<PostitMode>,
    editing: bool,
    id: Option<String>,
) -> Result<(), String> {
    let entry = own_entry(&app, &window)?;
    {
        let runtime = app.state::<PostitRuntime>();
        let mut frames = runtime.frames.lock().map_err(|_| "Layout indisponivel.")?;
        let frame = frames
            .get_mut(window.label())
            .ok_or("Layout indisponivel.")?;
        if id
            .as_ref()
            .is_some_and(|id| !entry.notes.iter().any(|n| &n.record.id == id))
        {
            return Err("Nota indisponivel.".into());
        }
        frame.active_note = id.clone();
        frame.transient = mode;
        frame.editing = editing;
        frame.resizing = false;
    }
    apply_frame(&app, &window, &entry)?;
    // WebviewWindow::set_focus only focuses the native host. Explicit reading/editing
    // also needs WebView focus; hover previews must leave the other app focused.
    if editing
        || mode == Some(PostitMode::Expanded)
        || (entry.group.is_some() && mode == Some(PostitMode::Compact) && id.is_none())
    {
        window.set_focus().map_err(|e| e.to_string())?;
        let webview: &tauri::Webview = window.as_ref();
        webview.set_focus().map_err(|e| e.to_string())?;
    }
    Ok(())
}
pub fn retire_window(app: AppHandle, window: WebviewWindow) {
    if app
        .state::<PostitRuntime>()
        .frames
        .lock()
        .is_ok_and(|frames| frames.get(window.label()).is_some_and(|f| f.editing))
    {
        let _ = window.emit("praxis://postit-finish", ());
        return;
    }
    tauri::async_runtime::spawn_blocking(move || {
        let result = own_entry(&app, &window).and_then(|entry| {
            let file = vault::active_file_id(&app.state::<VaultStore>())?;
            vault::mutate_matching_document(&app.state::<VaultStore>(), &file, |document| {
                for note in entry.notes {
                    change_document(
                        document,
                        PostitChange {
                            id: note.record.id,
                            expected_revision: note.record.revision,
                            pinned: Some(false),
                            ..Default::default()
                        },
                    )?;
                }
                Ok(())
            })?;
            schedule_sync(&app);
            Ok(())
        });
        if let Err(error) = result {
            let _ = window.emit("praxis://postits-error", error);
        }
    });
}
#[tauri::command]
pub fn drag_postit(app: AppHandle, window: WebviewWindow) -> Result<(), String> {
    own_entry(&app, &window)?;
    let runtime = app.state::<PostitRuntime>();
    // Dragging is explicit. A temporary preview never persists an accidental offset.
    if runtime.frames.lock().is_ok_and(|frames| {
        frames
            .get(window.label())
            .is_some_and(|f| f.transient.is_some() || f.editing)
    }) {
        return Err("Feche a previa antes de mover.".into());
    }
    runtime
        .dragged
        .lock()
        .map_err(|_| "Posicao indisponivel.")?
        .insert(window.label().into());
    window.start_dragging().map_err(|e| e.to_string())
}
#[tauri::command]
pub fn preview_postit_size(
    app: AppHandle,
    window: WebviewWindow,
    width: f64,
    height: f64,
) -> Result<(), String> {
    own_entry(&app, &window)?;
    let size = FrameSize { width, height };
    if !size.valid() {
        return Err("Tamanho invalido.".into());
    }
    let runtime = app.state::<PostitRuntime>();
    let area = window
        .current_monitor()
        .ok()
        .flatten()
        .as_ref()
        .map(|monitor| monitor_area_at_scale(monitor, window.scale_factor().unwrap_or(1.0)))
        .unwrap_or((0.0, 0.0, 1280.0, 800.0));
    let size = FrameSize {
        width: size.width.min(area.2),
        height: size.height.min(area.3),
    };
    let drawn;
    {
        let mut frames = runtime.frames.lock().map_err(|_| "Layout indisponivel.")?;
        let frame = frames
            .get_mut(window.label())
            .ok_or("Layout indisponivel.")?;
        frame.resizing = true;
        frame.size = size;
        drawn = layout::anchored(frame.anchor, size, area);
        frame.drawn = drawn;
    }
    window
        .set_size(tauri::LogicalSize::new(size.width, size.height))
        .map_err(|e| e.to_string())?;
    place_visible(&app, &window, drawn)
}
#[tauri::command]
pub fn resize_postit(
    app: AppHandle,
    window: WebviewWindow,
    id: String,
    width: f64,
    height: f64,
) -> Result<(), String> {
    let entry = own_entry(&app, &window)?;
    let note = entry
        .notes
        .iter()
        .find(|n| n.record.id == id)
        .ok_or("Nota indisponivel.")?;
    let size = FrameSize { width, height };
    if !size.valid() {
        return Err("Tamanho invalido.".into());
    }
    change_postit(
        app.clone(),
        window.clone(),
        PostitChange {
            id,
            expected_revision: note.record.revision,
            expanded_size: Some(size),
            ..Default::default()
        },
    )?;
    {
        let runtime = app.state::<PostitRuntime>();
        if let Ok(mut frames) = runtime.frames.lock() {
            if let Some(frame) = frames.get_mut(window.label()) {
                frame.resizing = false;
            }
        };
    }
    apply_frame(&app, &window, &own_entry(&app, &window)?)?;
    Ok(())
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
    let raw = (x as f64, y as f64);
    let Some(bounded) = visible_position(app, &window, raw) else {
        return;
    };
    let position = (bounded.0 / scale, bounded.1 / scale);
    if let Ok(mut frames) = runtime.frames.lock() {
        let Some(frame) = frames.get_mut(name) else {
            return;
        };
        if frame.transient.is_some() || frame.editing || frame.resizing {
            return;
        }
        if ((raw.0 / scale - frame.drawn.0).abs() < 0.5)
            && ((raw.1 / scale - frame.drawn.1).abs() < 0.5)
        {
            return;
        }
        frame.anchor = position;
        frame.drawn = position;
    }
    // Release locks before setting position: Moved can re-enter this handler.
    if bounded != raw {
        let _ = window.set_position(tauri::PhysicalPosition::new(
            bounded.0.round() as i32,
            bounded.1.round() as i32,
        ));
    }
    let Ok(mut moves) = runtime.moves.lock() else {
        return;
    };
    let start = moves
        .insert(
            name.into(),
            (position.0, position.1, std::time::Instant::now()),
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
    #[test]
    fn adaptive_preferences_roundtrip_and_legacy_reads_do_not_write() {
        let legacy = json!({"desktopPostits":[{"id":"old","title":"Keep","body":"Body","revision":8,"pinned":true,"collapsed":true,"archived":false,"color":"pink"}]});
        let before = legacy.clone();
        assert_eq!(
            read_records(&legacy).unwrap()[0].preferred_mode,
            Some(PostitMode::Micro)
        );
        assert_eq!(legacy, before);
        let mut doc = legacy;
        change_document(
            &mut doc,
            PostitChange {
                id: "old".into(),
                expected_revision: 8,
                preferred_mode: Some(PostitMode::Expanded),
                mode_locked: Some(true),
                expanded_size: Some(FrameSize {
                    width: 410.0,
                    height: 450.0,
                }),
                ..Default::default()
            },
        )
        .unwrap();
        let reread = snapshot(&doc).unwrap().notes.remove(0).record;
        assert_eq!(reread.preferred_mode, Some(PostitMode::Expanded));
        assert!(reread.mode_locked);
        assert_eq!(reread.expanded_size.unwrap().width, 410.0);
        assert_eq!(reread.body, "Body");
        assert_eq!(reread.color, "pink");
    }
    #[test]
    fn piles_use_one_desktop_entry_and_restore_member_keys() {
        let doc = json!({"postitGroups":[{"id":"6f58601a-0e76-449a-8aa3-fcb11356edd1","name":"Ideas","revision":1}],
          "desktopPostits":[
          {"id":"one","title":"One","body":"A","revision":1,"pinned":true,"collapsed":true,"archived":false,"color":"yellow","groupId":"6f58601a-0e76-449a-8aa3-fcb11356edd1"},
          {"id":"two","title":"Two","body":"B","revision":1,"pinned":false,"collapsed":false,"archived":false,"color":"pink","groupId":"6f58601a-0e76-449a-8aa3-fcb11356edd1"}]});
        let list = snapshot(&doc).unwrap();
        let entries = desktop_entries(&list);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].notes.len(), 2);
        assert_eq!(
            entry_label("vault", &entries[0]),
            "postit-vault-group-6f58601a-0e76-449a-8aa3-fcb11356edd1"
        );
        assert_eq!(label("vault", "one"), "postit-vault-one");
    }
}
