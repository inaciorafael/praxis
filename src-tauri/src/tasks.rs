use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::{AppHandle, Manager};
use time::{Date, Month, OffsetDateTime};
use uuid::Uuid;

use crate::{
    badge::{self, BadgeSnapshot, BadgeStore},
    checklist::{self, ChecklistItem, TaskProgress},
    lifecycle::{self, LifecycleActor, LifecycleEntityType, LifecycleEventInput},
    native_reminders, recurrence,
    reminders::{self, Reminder},
    vault::{read_active_document, write_active_document, VaultStore},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    pub id: String,
    pub title: String,
    #[serde(default)]
    pub notes: Option<String>,
    pub status: TaskStatus,
    pub planned_for: Option<String>,
    pub due_at: Option<String>,
    pub reminder_at: Option<String>,
    #[serde(default)]
    pub recurrence_id: Option<String>,
    #[serde(default)]
    pub occurrence_date: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum TaskStatus {
    Pending,
    Completed,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskView {
    id: String,
    title: String,
    notes: Option<String>,
    status: TaskStatus,
    planned_for: Option<String>,
    due_at: Option<String>,
    reminder_at: Option<String>,
    recurrence_id: Option<String>,
    occurrence_date: Option<String>,
    completed_at: Option<String>,
    created_at: String,
    updated_at: String,
    is_overdue: bool,
    progress: TaskProgress,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTaskInput {
    title: String,
    notes: Option<String>,
    planned_for: Option<String>,
    due_at: Option<String>,
    reminder_at: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTaskInput {
    title: Option<String>,
    #[serde(default)]
    notes: Option<Option<String>>,
    #[serde(default)]
    planned_for: Option<Option<String>>,
    #[serde(default)]
    due_at: Option<Option<String>>,
    #[serde(default)]
    reminder_at: Option<Option<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskCollection {
    tasks: Vec<TaskView>,
    my_day: Vec<TaskView>,
    my_week: Vec<TaskView>,
    pending: Vec<TaskView>,
    overdue: Vec<TaskView>,
    upcoming: Vec<TaskView>,
    with_reminders: Vec<TaskView>,
    completed: Vec<TaskView>,
    checklist_items: Vec<ChecklistItem>,
    reminders: Vec<Reminder>,
    badge: BadgeSnapshot,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskListResult {
    tasks: Vec<TaskView>,
    checklist_items: Vec<ChecklistItem>,
    reminders: Vec<Reminder>,
    badge: BadgeSnapshot,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskViewCounts {
    today: usize,
    week: usize,
    pending: usize,
    overdue: usize,
    upcoming: usize,
    reminders: usize,
    completed: usize,
    badge: BadgeSnapshot,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskListOptions {
    limit: Option<usize>,
    offset: Option<usize>,
}

#[tauri::command]
pub fn list_tasks(
    app: AppHandle,
    vault: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
    today: String,
) -> Result<TaskCollection, String> {
    generate_due_recurring_tasks(app, vault, badge_state, today)
}

#[tauri::command]
pub fn generate_due_recurring_tasks(
    app: AppHandle,
    vault: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
    today: String,
) -> Result<TaskCollection, String> {
    let mut document = read_active_document(&vault)?;
    let mut tasks = read_tasks_from_document(&document)?;
    let generated = recurrence::generate_due_tasks_in_document(&mut document, &mut tasks, &today)?;

    if generated > 0 {
        write_tasks_to_document(&mut document, &tasks)?;
    }

    let reminder_sync = reminders::sync_task_reminders_in_document(&mut document, &tasks)?;

    if generated > 0 || reminder_sync.changed {
        write_active_document(&vault, &mut document)?;
    }

    native_reminders::reconcile_native_reminders(&app, &reminder_sync.reminders);
    finish_task_collection(app, badge_state, tasks, reminder_sync.reminders, &today)
}

#[tauri::command]
pub fn list_today_tasks(
    app: AppHandle,
    vault: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
    today: String,
    options: Option<TaskListOptions>,
) -> Result<TaskListResult, String> {
    list_task_result(
        app,
        vault,
        badge_state,
        today,
        options,
        is_task_in_today_view,
    )
}

#[tauri::command]
pub fn list_week_tasks(
    app: AppHandle,
    vault: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
    today: String,
    options: Option<TaskListOptions>,
) -> Result<TaskListResult, String> {
    list_task_result(
        app,
        vault,
        badge_state,
        today,
        options,
        is_task_in_week_view,
    )
}

#[tauri::command]
pub fn list_pending_tasks(
    app: AppHandle,
    vault: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
    today: String,
    options: Option<TaskListOptions>,
) -> Result<TaskListResult, String> {
    list_task_result(app, vault, badge_state, today, options, |task, _| {
        task.status == TaskStatus::Pending
    })
}

#[tauri::command]
pub fn list_overdue_tasks(
    app: AppHandle,
    vault: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
    today: String,
    options: Option<TaskListOptions>,
) -> Result<TaskListResult, String> {
    list_task_result(app, vault, badge_state, today, options, is_task_overdue)
}

#[tauri::command]
pub fn list_upcoming_tasks(
    app: AppHandle,
    vault: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
    today: String,
    options: Option<TaskListOptions>,
) -> Result<TaskListResult, String> {
    list_task_result(app, vault, badge_state, today, options, is_task_upcoming)
}

#[tauri::command]
pub fn list_reminder_tasks(
    app: AppHandle,
    vault: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
    today: String,
    options: Option<TaskListOptions>,
) -> Result<TaskListResult, String> {
    list_task_result(app, vault, badge_state, today, options, |task, _| {
        task.status == TaskStatus::Pending && task.reminder_at.is_some()
    })
}

#[tauri::command]
pub fn list_completed_tasks(
    app: AppHandle,
    vault: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
    today: String,
    options: Option<TaskListOptions>,
) -> Result<TaskListResult, String> {
    list_task_result(app, vault, badge_state, today, options, |task, _| {
        task.status == TaskStatus::Completed
    })
}

#[tauri::command]
pub fn get_task_view_counts(
    app: AppHandle,
    vault: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
    today: String,
) -> Result<TaskViewCounts, String> {
    let mut document = read_active_document(&vault)?;
    let mut tasks = read_tasks_from_document(&document)?;
    let generated = recurrence::generate_due_tasks_in_document(&mut document, &mut tasks, &today)?;

    if generated > 0 {
        write_tasks_to_document(&mut document, &tasks)?;
    }

    let reminder_sync = reminders::sync_task_reminders_in_document(&mut document, &tasks)?;

    if generated > 0 || reminder_sync.changed {
        write_active_document(&vault, &mut document)?;
    }

    native_reminders::reconcile_native_reminders(&app, &reminder_sync.reminders);

    let today_count = tasks
        .iter()
        .filter(|task| is_task_in_my_day(task, &today))
        .count();
    let badge = badge::set_badge_count(app, badge_state, today_count as u32)?;

    Ok(TaskViewCounts {
        today: today_count,
        week: tasks
            .iter()
            .filter(|task| is_task_in_my_week(task, &today))
            .count(),
        pending: tasks
            .iter()
            .filter(|task| task.status == TaskStatus::Pending)
            .count(),
        overdue: tasks
            .iter()
            .filter(|task| is_task_overdue(task, &today))
            .count(),
        upcoming: tasks
            .iter()
            .filter(|task| is_task_upcoming(task, &today))
            .count(),
        reminders: tasks
            .iter()
            .filter(|task| task.status == TaskStatus::Pending && task.reminder_at.is_some())
            .count(),
        completed: tasks
            .iter()
            .filter(|task| task.status == TaskStatus::Completed)
            .count(),
        badge,
    })
}

#[tauri::command]
pub fn create_task(
    app: AppHandle,
    vault: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
    input: CreateTaskInput,
    today: String,
) -> Result<TaskCollection, String> {
    let mut document = read_active_document(&vault)?;
    let mut tasks = read_tasks_from_document(&document)?;
    let now = now_iso()?;
    let title = input.title.trim();

    if title.is_empty() {
        return Err("Informe o titulo da tarefa.".into());
    }

    let task = Task {
        id: Uuid::new_v4().to_string(),
        title: title.into(),
        notes: input.notes.filter(|value| !value.trim().is_empty()),
        status: TaskStatus::Pending,
        planned_for: input.planned_for.filter(|value| !value.trim().is_empty()),
        due_at: input.due_at.filter(|value| !value.trim().is_empty()),
        reminder_at: input.reminder_at.filter(|value| !value.trim().is_empty()),
        recurrence_id: None,
        occurrence_date: None,
        completed_at: None,
        created_at: now.clone(),
        updated_at: now,
    };
    let task_id = task.id.clone();
    let task_title = task.title.clone();
    let task_planned_for = task.planned_for.clone();
    let task_due_at = task.due_at.clone();
    let task_reminder_at = task.reminder_at.clone();
    tasks.push(task);

    lifecycle::append_events(
        &mut document,
        initial_task_events(
            &task_id,
            &task_title,
            task_planned_for,
            task_due_at,
            task_reminder_at,
        ),
    )?;

    write_tasks_to_document(&mut document, &tasks)?;
    let reminder_sync = reminders::sync_task_reminders_in_document(&mut document, &tasks)?;
    write_active_document(&vault, &mut document)?;
    native_reminders::reconcile_native_reminders(&app, &reminder_sync.reminders);
    finish_task_collection(app, badge_state, tasks, reminder_sync.reminders, &today)
}

#[tauri::command]
pub fn update_task(
    app: AppHandle,
    vault: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
    id: String,
    input: UpdateTaskInput,
    today: String,
) -> Result<TaskCollection, String> {
    let mut document = read_active_document(&vault)?;
    let mut tasks = read_tasks_from_document(&document)?;
    let now = now_iso()?;
    let task = tasks
        .iter_mut()
        .find(|task| task.id == id)
        .ok_or_else(|| "Tarefa nao encontrada.".to_string())?;
    let before = task.clone();
    let mut events = Vec::new();

    if let Some(title) = input.title {
        let title = title.trim();

        if title.is_empty() {
            return Err("Informe o titulo da tarefa.".into());
        }

        if task.title != title {
            events.push(field_change_event(
                &id,
                "taskTitleUpdated",
                "Titulo alterado",
                "title",
                Some(task.title.clone()),
                Some(title.to_string()),
            ));
            task.title = title.into();
        }
    }

    if let Some(notes) = input.notes {
        let notes = normalize_optional_text(notes);
        if task.notes != notes {
            events.push(LifecycleEventInput {
                entity_type: LifecycleEntityType::Task,
                entity_id: id.clone(),
                task_id: Some(id.clone()),
                event_type: "taskNotesUpdated",
                actor: LifecycleActor::user(),
                summary: "Nota atualizada".into(),
                metadata: serde_json::json!({ "notesChanged": true }),
            });
            task.notes = notes;
        }
    }

    if let Some(planned_for) = input.planned_for {
        let planned_for = normalize_optional_text(planned_for);
        if task.planned_for != planned_for {
            events.push(field_change_event(
                &id,
                "taskPlannedForUpdated",
                "Planejamento alterado",
                "plannedFor",
                task.planned_for.clone(),
                planned_for.clone(),
            ));
            task.planned_for = planned_for;
        }
    }

    if let Some(due_at) = input.due_at {
        let due_at = normalize_optional_text(due_at);
        if task.due_at != due_at {
            events.push(field_change_event(
                &id,
                "taskDueAtUpdated",
                due_summary(before.due_at.as_ref(), due_at.as_ref()),
                "dueAt",
                task.due_at.clone(),
                due_at.clone(),
            ));
            task.due_at = due_at;
        }
    }

    if let Some(reminder_at) = input.reminder_at {
        let reminder_at = normalize_optional_text(reminder_at);
        if task.reminder_at != reminder_at {
            events.push(reminder_change_event(
                &id,
                task.reminder_at.clone(),
                reminder_at.clone(),
            ));
            task.reminder_at = reminder_at;
        }
    }

    if !events.is_empty() {
        task.updated_at = now;
        lifecycle::append_events(&mut document, events)?;
    }

    write_tasks_to_document(&mut document, &tasks)?;
    let reminder_sync = reminders::sync_task_reminders_in_document(&mut document, &tasks)?;
    write_active_document(&vault, &mut document)?;
    native_reminders::reconcile_native_reminders(&app, &reminder_sync.reminders);
    finish_task_collection(app, badge_state, tasks, reminder_sync.reminders, &today)
}

#[tauri::command]
pub fn set_task_completed(
    app: AppHandle,
    vault: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
    id: String,
    completed: bool,
    today: String,
) -> Result<TaskCollection, String> {
    let mut document = read_active_document(&vault)?;
    let mut tasks = read_tasks_from_document(&document)?;
    let mut checklist_items = checklist::read_checklist_items_from_document(&document)?;
    let now = now_iso()?;
    let task_has_checklist = checklist_items.iter().any(|item| item.task_id == id);

    if task_has_checklist {
        let mut events = Vec::new();

        for item in checklist_items.iter_mut().filter(|item| item.task_id == id) {
            if (item.status == checklist::ChecklistItemStatus::Completed) == completed {
                continue;
            }

            item.status = if completed {
                checklist::ChecklistItemStatus::Completed
            } else {
                checklist::ChecklistItemStatus::Pending
            };
            item.completed_at = completed.then_some(now.clone());
            item.updated_at = now.clone();
            events.push(LifecycleEventInput {
                entity_type: LifecycleEntityType::ChecklistItem,
                entity_id: item.id.clone(),
                task_id: Some(id.clone()),
                event_type: if completed {
                    "checklistItemCompleted"
                } else {
                    "checklistItemReopened"
                },
                actor: LifecycleActor::user(),
                summary: if completed {
                    "Item de checklist concluido".into()
                } else {
                    "Item de checklist reaberto".into()
                },
                metadata: serde_json::json!({
                    "checklistItemId": item.id,
                    "completedAt": item.completed_at
                }),
            });
        }

        checklist::write_checklist_items_to_document(&mut document, &checklist_items)?;
        events.extend(checklist::sync_parent_task_status_from_checklist(
            &mut tasks,
            &checklist_items,
            &id,
            LifecycleActor::system(),
        )?);
        lifecycle::append_events(&mut document, events)?;
        write_tasks_to_document(&mut document, &tasks)?;
        let reminder_sync = reminders::sync_task_reminders_in_document(&mut document, &tasks)?;
        write_active_document(&vault, &mut document)?;
        native_reminders::reconcile_native_reminders(&app, &reminder_sync.reminders);
        return finish_task_collection(app, badge_state, tasks, reminder_sync.reminders, &today);
    }

    let mut found = false;
    let mut event = None;

    for task in &mut tasks {
        if task.id == id {
            if (task.status == TaskStatus::Completed) == completed {
                found = true;
                break;
            }

            task.status = if completed {
                TaskStatus::Completed
            } else {
                TaskStatus::Pending
            };
            task.completed_at = completed.then_some(now.clone());
            task.updated_at = now.clone();
            found = true;
            event = Some(LifecycleEventInput {
                entity_type: LifecycleEntityType::Task,
                entity_id: id.clone(),
                task_id: Some(id.clone()),
                event_type: if completed {
                    "taskCompleted"
                } else {
                    "taskReopened"
                },
                actor: LifecycleActor::user(),
                summary: if completed {
                    "Tarefa concluida".into()
                } else {
                    "Tarefa reaberta".into()
                },
                metadata: serde_json::json!({ "completedAt": task.completed_at }),
            });
            break;
        }
    }

    if !found {
        return Err("Tarefa nao encontrada.".into());
    }

    if let Some(event) = event {
        lifecycle::append_event(&mut document, event)?;
    }

    write_tasks_to_document(&mut document, &tasks)?;
    let reminder_sync = reminders::sync_task_reminders_in_document(&mut document, &tasks)?;
    write_active_document(&vault, &mut document)?;
    native_reminders::reconcile_native_reminders(&app, &reminder_sync.reminders);
    finish_task_collection(app, badge_state, tasks, reminder_sync.reminders, &today)
}

#[tauri::command]
pub fn delete_task(
    app: AppHandle,
    vault: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
    id: String,
    today: String,
) -> Result<TaskCollection, String> {
    let mut document = read_active_document(&vault)?;
    let mut tasks = read_tasks_from_document(&document)?;
    let original_len = tasks.len();
    let removed_task = tasks.iter().find(|task| task.id == id).cloned();
    tasks.retain(|task| task.id != id);

    if tasks.len() == original_len {
        return Err("Tarefa nao encontrada.".into());
    }

    write_tasks_to_document(&mut document, &tasks)?;
    checklist::remove_task_checklist_items_from_document(&mut document, &id)?;
    remove_task_tag_relations_from_document(&mut document, &id)?;
    if let Some(task) = removed_task {
        lifecycle::append_event(
            &mut document,
            LifecycleEventInput {
                entity_type: LifecycleEntityType::Task,
                entity_id: id.clone(),
                task_id: Some(id.clone()),
                event_type: "taskDeleted",
                actor: LifecycleActor::user(),
                summary: "Tarefa removida".into(),
                metadata: serde_json::json!({ "title": task.title }),
            },
        )?;
    }
    let reminder_sync = reminders::sync_task_reminders_in_document(&mut document, &tasks)?;
    write_active_document(&vault, &mut document)?;
    native_reminders::reconcile_native_reminders(&app, &reminder_sync.reminders);
    finish_task_collection(app, badge_state, tasks, reminder_sync.reminders, &today)
}

pub(crate) fn read_tasks_from_document(document: &Value) -> Result<Vec<Task>, String> {
    let tasks = document
        .get("tasks")
        .cloned()
        .unwrap_or_else(|| Value::Array(Vec::new()));

    serde_json::from_value(tasks).map_err(|error| error.to_string())
}

pub(crate) fn write_tasks_to_document(document: &mut Value, tasks: &[Task]) -> Result<(), String> {
    let Some(object) = document.as_object_mut() else {
        return Err("Documento .praxis invalido.".into());
    };

    object.insert(
        "tasks".into(),
        serde_json::to_value(tasks).map_err(|error| error.to_string())?,
    );

    Ok(())
}

fn remove_task_tag_relations_from_document(
    document: &mut Value,
    task_id: &str,
) -> Result<(), String> {
    let Some(relations) = document.get_mut("taskTags").and_then(Value::as_array_mut) else {
        return Ok(());
    };

    relations.retain(|relation| relation.get("taskId").and_then(Value::as_str) != Some(task_id));
    Ok(())
}

pub(crate) fn finish_task_collection(
    app: AppHandle,
    badge_state: tauri::State<'_, BadgeStore>,
    tasks: Vec<Task>,
    reminders: Vec<Reminder>,
    today: &str,
) -> Result<TaskCollection, String> {
    let document = read_active_document(&app.state::<VaultStore>())?;
    let checklist_items = checklist::read_checklist_items_from_document(&document)?;
    let sorted_tasks = sorted_tasks_by_action_time(&tasks);
    let my_day = sorted_tasks
        .iter()
        .filter(|task| is_task_in_today_view(task, today))
        .map(|task| task_view(task, &checklist_items, today))
        .collect::<Vec<_>>();
    let badge_count = sorted_tasks
        .iter()
        .filter(|task| is_task_in_my_day(task, today))
        .count();
    let my_week = sorted_tasks
        .iter()
        .filter(|task| is_task_in_my_week(task, today))
        .map(|task| task_view(task, &checklist_items, today))
        .collect::<Vec<_>>();
    let pending = sorted_tasks
        .iter()
        .filter(|task| task.status == TaskStatus::Pending)
        .map(|task| task_view(task, &checklist_items, today))
        .collect::<Vec<_>>();
    let overdue = sorted_tasks
        .iter()
        .filter(|task| is_task_overdue(task, today))
        .map(|task| task_view(task, &checklist_items, today))
        .collect::<Vec<_>>();
    let upcoming = sorted_tasks
        .iter()
        .filter(|task| is_task_upcoming(task, today))
        .map(|task| task_view(task, &checklist_items, today))
        .collect::<Vec<_>>();
    let with_reminders = sorted_tasks
        .iter()
        .filter(|task| task.status == TaskStatus::Pending && task.reminder_at.is_some())
        .map(|task| task_view(task, &checklist_items, today))
        .collect::<Vec<_>>();
    let completed = sorted_tasks
        .iter()
        .filter(|task| task.status == TaskStatus::Completed)
        .map(|task| task_view(task, &checklist_items, today))
        .collect::<Vec<_>>();
    let badge = badge::set_badge_count(app, badge_state, badge_count as u32)?;
    let task_views = sorted_tasks
        .iter()
        .map(|task| task_view(task, &checklist_items, today))
        .collect::<Vec<_>>();

    Ok(TaskCollection {
        tasks: task_views,
        my_day,
        my_week,
        pending,
        overdue,
        upcoming,
        with_reminders,
        completed,
        checklist_items,
        reminders,
        badge,
    })
}

fn list_task_result(
    app: AppHandle,
    vault: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
    today: String,
    options: Option<TaskListOptions>,
    predicate: impl Fn(&Task, &str) -> bool,
) -> Result<TaskListResult, String> {
    let mut document = read_active_document(&vault)?;
    let mut tasks = read_tasks_from_document(&document)?;
    let generated = recurrence::generate_due_tasks_in_document(&mut document, &mut tasks, &today)?;

    if generated > 0 {
        write_tasks_to_document(&mut document, &tasks)?;
    }

    let reminder_sync = reminders::sync_task_reminders_in_document(&mut document, &tasks)?;

    if generated > 0 || reminder_sync.changed {
        write_active_document(&vault, &mut document)?;
    }

    native_reminders::reconcile_native_reminders(&app, &reminder_sync.reminders);

    let document = read_active_document(&vault)?;
    let checklist_items = checklist::read_checklist_items_from_document(&document)?;
    let sorted_tasks = sorted_tasks_by_action_time(&tasks);
    let selected_tasks = paginate_tasks(
        sorted_tasks
            .iter()
            .filter(|task| predicate(task, &today))
            .cloned()
            .collect(),
        options.as_ref(),
    );
    let selected_ids = selected_tasks
        .iter()
        .map(|task| task.id.as_str())
        .collect::<std::collections::BTreeSet<_>>();
    let selected_checklist_items = checklist_items
        .iter()
        .filter(|item| selected_ids.contains(item.task_id.as_str()))
        .cloned()
        .collect::<Vec<_>>();
    let selected_reminders = reminder_sync
        .reminders
        .iter()
        .filter(|reminder| selected_ids.contains(reminder.task_id()))
        .cloned()
        .collect::<Vec<_>>();
    let task_views = selected_tasks
        .iter()
        .map(|task| task_view(task, &selected_checklist_items, &today))
        .collect::<Vec<_>>();
    let badge_count = sorted_tasks
        .iter()
        .filter(|task| is_task_in_my_day(task, &today))
        .count();
    let badge = badge::set_badge_count(app, badge_state, badge_count as u32)?;

    Ok(TaskListResult {
        tasks: task_views,
        checklist_items: selected_checklist_items,
        reminders: selected_reminders,
        badge,
    })
}

fn paginate_tasks(tasks: Vec<Task>, options: Option<&TaskListOptions>) -> Vec<Task> {
    let offset = options.and_then(|options| options.offset).unwrap_or(0);
    let limit = options.and_then(|options| options.limit);
    let iter = tasks.into_iter().skip(offset);

    match limit {
        Some(limit) => iter.take(limit).collect(),
        None => iter.collect(),
    }
}

fn task_view(task: &Task, checklist_items: &[ChecklistItem], today: &str) -> TaskView {
    TaskView {
        id: task.id.clone(),
        title: task.title.clone(),
        notes: task.notes.clone(),
        status: task.status.clone(),
        planned_for: task.planned_for.clone(),
        due_at: task.due_at.clone(),
        reminder_at: task.reminder_at.clone(),
        recurrence_id: task.recurrence_id.clone(),
        occurrence_date: task.occurrence_date.clone(),
        completed_at: task.completed_at.clone(),
        created_at: task.created_at.clone(),
        updated_at: task.updated_at.clone(),
        is_overdue: is_task_overdue(task, today),
        progress: checklist::progress_for_task(
            checklist_items,
            &task.id,
            task.status == TaskStatus::Completed,
        ),
    }
}

fn sorted_tasks_by_action_time(tasks: &[Task]) -> Vec<Task> {
    sorted_tasks_by_action_time_at(tasks, now_timestamp())
}

fn sorted_tasks_by_action_time_at(tasks: &[Task], now: i128) -> Vec<Task> {
    let mut sorted = tasks.to_vec();

    sorted.sort_by(|left, right| compare_tasks_by_action_time_at(left, right, now));
    sorted
}

fn compare_tasks_by_action_time_at(left: &Task, right: &Task, now: i128) -> std::cmp::Ordering {
    let left_bucket = task_sort_bucket(left, now);
    let right_bucket = task_sort_bucket(right, now);

    if left_bucket != right_bucket {
        return left_bucket.cmp(&right_bucket);
    }

    if left.status == TaskStatus::Completed && right.status == TaskStatus::Completed {
        return task_completed_timestamp(right)
            .cmp(&task_completed_timestamp(left))
            .then(right.updated_at.cmp(&left.updated_at))
            .then(left.title.cmp(&right.title))
            .then(left.id.cmp(&right.id));
    }

    task_due_timestamp(left)
        .cmp(&task_due_timestamp(right))
        .then(task_created_timestamp(left).cmp(&task_created_timestamp(right)))
        .then(left.title.cmp(&right.title))
        .then(left.id.cmp(&right.id))
}

fn task_sort_bucket(task: &Task, now: i128) -> u8 {
    if task.status == TaskStatus::Completed {
        return 3;
    }

    match task_due_timestamp(task) {
        Some(due_at) if due_at < now => 0,
        Some(_) => 1,
        None => 2,
    }
}

fn task_due_timestamp(task: &Task) -> Option<i128> {
    task.due_at.as_deref().and_then(parse_instant_timestamp)
}

fn task_created_timestamp(task: &Task) -> i128 {
    parse_instant_timestamp(&task.created_at).unwrap_or(i128::MAX)
}

fn task_completed_timestamp(task: &Task) -> i128 {
    task.completed_at
        .as_deref()
        .and_then(parse_instant_timestamp)
        .or_else(|| parse_instant_timestamp(&task.updated_at))
        .unwrap_or(i128::MIN)
}

fn is_task_in_my_day(task: &Task, today: &str) -> bool {
    if task.status == TaskStatus::Completed {
        return false;
    }

    task.planned_for.as_deref() == Some(today)
        || task
            .due_at
            .as_deref()
            .and_then(date_part)
            .is_some_and(|due_date| due_date <= today)
}

fn is_task_in_today_view(task: &Task, today: &str) -> bool {
    let planned_today = task.planned_for.as_deref() == Some(today);
    let due_date = task.due_at.as_deref().and_then(date_part);
    let due_today = due_date == Some(today);
    let completed_today = task.completed_at.as_deref().and_then(date_part) == Some(today);
    let pending_overdue =
        task.status == TaskStatus::Pending && due_date.is_some_and(|date| date < today);

    planned_today || due_today || completed_today || pending_overdue
}

fn is_task_in_my_week(task: &Task, today: &str) -> bool {
    if task.status == TaskStatus::Completed {
        return false;
    }

    let Some(today) = parse_local_date(today) else {
        return false;
    };
    let Some(week_end) = today.checked_add(time::Duration::days(6)) else {
        return false;
    };

    is_task_overdue(task, &today.to_string())
        || task
            .planned_for
            .as_deref()
            .and_then(parse_local_date)
            .is_some_and(|date| date >= today && date <= week_end)
        || task
            .due_at
            .as_deref()
            .and_then(date_part)
            .and_then(parse_local_date)
            .is_some_and(|date| date >= today && date <= week_end)
}

fn is_task_in_week_view(task: &Task, today: &str) -> bool {
    let Some(today) = parse_local_date(today) else {
        return false;
    };
    let Some(week_end) = today.checked_add(time::Duration::days(6)) else {
        return false;
    };

    let planned_in_range = task
        .planned_for
        .as_deref()
        .and_then(parse_local_date)
        .is_some_and(|date| date >= today && date <= week_end);
    let due_date = task.due_at.as_deref().and_then(date_part);
    let due_in_range = due_date
        .and_then(parse_local_date)
        .is_some_and(|date| date >= today && date <= week_end);
    let completed_in_range = task
        .completed_at
        .as_deref()
        .and_then(date_part)
        .and_then(parse_local_date)
        .is_some_and(|date| date >= today && date <= week_end);
    let pending_overdue = task.status == TaskStatus::Pending
        && due_date
            .and_then(parse_local_date)
            .is_some_and(|date| date < today);

    planned_in_range || due_in_range || completed_in_range || pending_overdue
}

fn is_task_overdue(task: &Task, today: &str) -> bool {
    is_task_overdue_at(task, today, now_timestamp())
}

fn is_task_overdue_at(task: &Task, today: &str, now: i128) -> bool {
    if task.status != TaskStatus::Pending {
        return false;
    }

    if let Some(due_at) = task_due_timestamp(task) {
        return due_at < now;
    }

    task.status == TaskStatus::Pending
        && task
            .due_at
            .as_deref()
            .and_then(date_part)
            .is_some_and(|due_date| due_date < today)
}

fn is_task_upcoming(task: &Task, today: &str) -> bool {
    if task.status == TaskStatus::Completed {
        return false;
    }

    let planned_future = task.planned_for.as_deref().is_some_and(|date| date > today);
    let due_future = task
        .due_at
        .as_deref()
        .and_then(date_part)
        .is_some_and(|due_date| due_date > today);

    planned_future || due_future
}

fn date_part(value: &str) -> Option<&str> {
    value.get(0..10)
}

fn parse_local_date(value: &str) -> Option<Date> {
    let date = value.trim().get(0..10)?;
    let mut parts = date.split('-');
    let year = parts.next()?.parse::<i32>().ok()?;
    let month = Month::try_from(parts.next()?.parse::<u8>().ok()?).ok()?;
    let day = parts.next()?.parse::<u8>().ok()?;

    if parts.next().is_some() {
        return None;
    }

    Date::from_calendar_date(year, month, day).ok()
}

fn parse_instant_timestamp(value: &str) -> Option<i128> {
    OffsetDateTime::parse(value, &time::format_description::well_known::Rfc3339)
        .ok()
        .map(|value| value.unix_timestamp_nanos())
}

fn now_timestamp() -> i128 {
    OffsetDateTime::now_utc().unix_timestamp_nanos()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn task(id: &str, status: TaskStatus) -> Task {
        Task {
            id: id.into(),
            title: "Task".into(),
            notes: None,
            status,
            planned_for: None,
            due_at: None,
            reminder_at: None,
            recurrence_id: None,
            occurrence_date: None,
            completed_at: None,
            created_at: "2026-06-18T00:00:00Z".into(),
            updated_at: "2026-06-18T00:00:00Z".into(),
        }
    }

    #[test]
    fn classifies_daily_action_views() {
        let mut planned_today = task("today", TaskStatus::Pending);
        planned_today.planned_for = Some("2026-06-18".into());

        let mut overdue = task("overdue", TaskStatus::Pending);
        overdue.due_at = Some("2026-06-17T09:00:00Z".into());

        let mut upcoming = task("upcoming", TaskStatus::Pending);
        upcoming.planned_for = Some("2026-06-20".into());

        let mut next_week = task("next-week", TaskStatus::Pending);
        next_week.planned_for = Some("2026-06-25".into());

        let mut with_reminder = task("reminder", TaskStatus::Pending);
        with_reminder.reminder_at = Some("2026-06-18T10:00:00Z".into());

        let mut completed = task("completed", TaskStatus::Completed);
        completed.planned_for = Some("2026-06-18".into());

        assert!(is_task_in_my_day(&planned_today, "2026-06-18"));
        assert!(is_task_in_my_day(&overdue, "2026-06-18"));
        assert!(!is_task_in_my_day(&completed, "2026-06-18"));
        assert!(is_task_overdue(&overdue, "2026-06-18"));
        assert!(is_task_upcoming(&upcoming, "2026-06-18"));
        assert!(!is_task_upcoming(&with_reminder, "2026-06-18"));
        assert!(is_task_in_my_week(&planned_today, "2026-06-18"));
        assert!(is_task_in_my_week(&overdue, "2026-06-18"));
        assert!(is_task_in_my_week(&upcoming, "2026-06-18"));
        assert!(!is_task_in_my_week(&next_week, "2026-06-18"));
        assert!(!is_task_in_my_week(&completed, "2026-06-18"));
    }

    #[test]
    fn today_view_includes_all_statuses_without_changing_badge_scope() {
        let mut planned_today = task("planned-today", TaskStatus::Pending);
        planned_today.planned_for = Some("2026-06-18".into());

        let mut overdue = task("overdue", TaskStatus::Pending);
        overdue.due_at = Some("2026-06-17T09:00:00Z".into());

        let mut completed_planned_today = task("completed-planned-today", TaskStatus::Completed);
        completed_planned_today.planned_for = Some("2026-06-18".into());
        completed_planned_today.completed_at = Some("2026-06-18T12:00:00Z".into());

        let mut completed_today = task("completed-today", TaskStatus::Completed);
        completed_today.completed_at = Some("2026-06-18T18:00:00Z".into());

        let mut completed_old_overdue = task("completed-old-overdue", TaskStatus::Completed);
        completed_old_overdue.due_at = Some("2026-06-15T09:00:00Z".into());
        completed_old_overdue.completed_at = Some("2026-06-16T18:00:00Z".into());

        assert!(is_task_in_today_view(&planned_today, "2026-06-18"));
        assert!(is_task_in_today_view(&overdue, "2026-06-18"));
        assert!(is_task_in_today_view(
            &completed_planned_today,
            "2026-06-18"
        ));
        assert!(is_task_in_today_view(&completed_today, "2026-06-18"));
        assert!(!is_task_in_today_view(&completed_old_overdue, "2026-06-18"));
        assert!(!is_task_in_my_day(&completed_planned_today, "2026-06-18"));
    }

    #[test]
    fn week_view_includes_all_statuses_in_range() {
        let mut pending_this_week = task("pending-this-week", TaskStatus::Pending);
        pending_this_week.planned_for = Some("2026-06-20".into());

        let mut pending_overdue = task("pending-overdue", TaskStatus::Pending);
        pending_overdue.due_at = Some("2026-06-17T09:00:00Z".into());

        let mut completed_this_week = task("completed-this-week", TaskStatus::Completed);
        completed_this_week.completed_at = Some("2026-06-21T18:00:00Z".into());

        let mut completed_next_week = task("completed-next-week", TaskStatus::Completed);
        completed_next_week.completed_at = Some("2026-06-25T18:00:00Z".into());

        assert!(is_task_in_week_view(&pending_this_week, "2026-06-18"));
        assert!(is_task_in_week_view(&pending_overdue, "2026-06-18"));
        assert!(is_task_in_week_view(&completed_this_week, "2026-06-18"));
        assert!(!is_task_in_week_view(&completed_next_week, "2026-06-18"));
        assert!(!is_task_in_my_week(&completed_this_week, "2026-06-18"));
    }

    #[test]
    fn badge_scope_counts_pending_tasks_for_today_or_due_today() {
        let mut planned_today = task("planned-today", TaskStatus::Pending);
        planned_today.planned_for = Some("2026-06-18".into());

        let mut due_today = task("due-today", TaskStatus::Pending);
        due_today.due_at = Some("2026-06-18T23:00:00Z".into());

        let mut completed_today = task("completed-today", TaskStatus::Completed);
        completed_today.planned_for = Some("2026-06-18".into());

        let mut future = task("future", TaskStatus::Pending);
        future.due_at = Some("2026-06-19T10:00:00Z".into());

        let tasks = vec![planned_today, due_today, completed_today, future];
        let badge_count = tasks
            .iter()
            .filter(|task| is_task_in_my_day(task, "2026-06-18"))
            .count();

        assert_eq!(badge_count, 2);
    }

    #[test]
    fn task_view_derives_overdue_state() {
        let mut overdue = task("overdue", TaskStatus::Pending);
        overdue.due_at = Some("2026-06-17T09:00:00Z".into());

        let mut completed_overdue = task("completed-overdue", TaskStatus::Completed);
        completed_overdue.due_at = Some("2026-06-17T09:00:00Z".into());

        assert!(task_view(&overdue, &[], "2026-06-18").is_overdue);
        assert!(!task_view(&completed_overdue, &[], "2026-06-18").is_overdue);
    }

    #[test]
    fn overdue_state_respects_due_time_on_current_day() {
        let now = parse_instant_timestamp("2026-06-18T12:00:00Z").unwrap();

        let mut earlier_today = task("earlier-today", TaskStatus::Pending);
        earlier_today.due_at = Some("2026-06-18T09:00:00Z".into());

        let mut later_today = task("later-today", TaskStatus::Pending);
        later_today.due_at = Some("2026-06-18T18:00:00Z".into());

        assert!(is_task_overdue_at(&earlier_today, "2026-06-18", now));
        assert!(!is_task_overdue_at(&later_today, "2026-06-18", now));
    }

    #[test]
    fn sorts_tasks_by_nearest_action_date_and_time() {
        let now = parse_instant_timestamp("2026-06-18T12:00:00Z").unwrap();

        let mut overdue_old = task("overdue-old", TaskStatus::Pending);
        overdue_old.title = "A".into();
        overdue_old.due_at = Some("2026-06-16T09:00:00Z".into());
        overdue_old.created_at = "2026-06-18T00:01:00Z".into();

        let mut overdue_recent = task("overdue-recent", TaskStatus::Pending);
        overdue_recent.title = "B".into();
        overdue_recent.due_at = Some("2026-06-18T08:00:00Z".into());
        overdue_recent.created_at = "2026-06-18T00:02:00Z".into();

        let mut due_soon = task("due-soon", TaskStatus::Pending);
        due_soon.title = "C".into();
        due_soon.due_at = Some("2026-06-18T13:00:00Z".into());
        due_soon.created_at = "2026-06-18T00:03:00Z".into();

        let mut due_later = task("due-later", TaskStatus::Pending);
        due_later.title = "D".into();
        due_later.due_at = Some("2026-06-19T09:00:00Z".into());
        due_later.created_at = "2026-06-18T00:04:00Z".into();

        let mut no_due_old = task("no-due-old", TaskStatus::Pending);
        no_due_old.title = "E".into();
        no_due_old.reminder_at = Some("2026-06-18T07:30:00Z".into());
        no_due_old.created_at = "2026-06-10T00:00:00Z".into();

        let mut no_due_new = task("no-due-new", TaskStatus::Pending);
        no_due_new.title = "F".into();
        no_due_new.planned_for = Some("2026-06-18".into());
        no_due_new.created_at = "2026-06-17T00:00:00Z".into();

        let mut completed = task("completed", TaskStatus::Completed);
        completed.completed_at = Some("2026-06-18T20:00:00Z".into());

        let sorted = sorted_tasks_by_action_time_at(
            &vec![
                no_due_new,
                due_later,
                completed,
                overdue_recent,
                no_due_old,
                due_soon,
                overdue_old,
            ],
            now,
        )
        .into_iter()
        .map(|task| task.id)
        .collect::<Vec<_>>();

        assert_eq!(
            sorted,
            vec![
                "overdue-old",
                "overdue-recent",
                "due-soon",
                "due-later",
                "no-due-old",
                "no-due-new",
                "completed"
            ]
        );
    }

    #[test]
    fn completed_tasks_stay_last_and_use_recent_completion_first() {
        let now = parse_instant_timestamp("2026-06-18T12:00:00Z").unwrap();

        let mut pending = task("pending", TaskStatus::Pending);
        pending.created_at = "2026-06-10T00:00:00Z".into();

        let mut completed_old = task("completed-old", TaskStatus::Completed);
        completed_old.completed_at = Some("2026-06-17T20:00:00Z".into());

        let mut completed_recent = task("completed-recent", TaskStatus::Completed);
        completed_recent.completed_at = Some("2026-06-18T20:00:00Z".into());

        let sorted =
            sorted_tasks_by_action_time_at(&vec![completed_old, pending, completed_recent], now)
                .into_iter()
                .map(|task| task.id)
                .collect::<Vec<_>>();

        assert_eq!(sorted, vec!["pending", "completed-recent", "completed-old"]);
    }

    #[test]
    fn creates_initial_lifecycle_events_for_task_context() {
        let events = initial_task_events(
            "task-1",
            "Enviar proposta",
            Some("2026-06-18".into()),
            Some("2026-06-19T12:00:00Z".into()),
            Some("2026-06-18T15:00:00Z".into()),
        );
        let event_types = events
            .iter()
            .map(|event| event.event_type)
            .collect::<Vec<_>>();

        assert_eq!(
            event_types,
            vec![
                "taskCreated",
                "taskPlannedForUpdated",
                "taskDueAtUpdated",
                "reminderCreated"
            ]
        );
        assert_eq!(events[0].summary, "Tarefa criada");
        assert_eq!(events[1].metadata["plannedFor"]["to"], "2026-06-18");
        assert_eq!(events[2].metadata["dueAt"]["to"], "2026-06-19T12:00:00Z");
        assert_eq!(
            events[3].metadata["scheduledAt"]["to"],
            "2026-06-18T15:00:00Z"
        );
    }
}

fn normalize_optional_text(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let value = value.trim();

        if value.is_empty() {
            None
        } else {
            Some(value.to_string())
        }
    })
}

fn initial_task_events(
    task_id: &str,
    title: &str,
    planned_for: Option<String>,
    due_at: Option<String>,
    reminder_at: Option<String>,
) -> Vec<LifecycleEventInput> {
    let mut events = vec![LifecycleEventInput {
        entity_type: LifecycleEntityType::Task,
        entity_id: task_id.to_string(),
        task_id: Some(task_id.to_string()),
        event_type: "taskCreated",
        actor: LifecycleActor::user(),
        summary: "Tarefa criada".into(),
        metadata: serde_json::json!({ "title": title }),
    }];

    if planned_for.is_some() {
        events.push(field_change_event(
            task_id,
            "taskPlannedForUpdated",
            "Planejamento definido",
            "plannedFor",
            None,
            planned_for,
        ));
    }

    if due_at.is_some() {
        events.push(field_change_event(
            task_id,
            "taskDueAtUpdated",
            "Vencimento definido",
            "dueAt",
            None,
            due_at,
        ));
    }

    if reminder_at.is_some() {
        events.push(reminder_change_event(task_id, None, reminder_at));
    }

    events
}

fn field_change_event(
    task_id: &str,
    event_type: &'static str,
    summary: impl Into<String>,
    field: &str,
    from: Option<String>,
    to: Option<String>,
) -> LifecycleEventInput {
    LifecycleEventInput {
        entity_type: LifecycleEntityType::Task,
        entity_id: task_id.to_string(),
        task_id: Some(task_id.to_string()),
        event_type,
        actor: LifecycleActor::user(),
        summary: summary.into(),
        metadata: serde_json::json!({
            field: lifecycle::value_change(from, to)
        }),
    }
}

fn reminder_change_event(
    task_id: &str,
    from: Option<String>,
    to: Option<String>,
) -> LifecycleEventInput {
    let event_type = match (from.as_ref(), to.as_ref()) {
        (None, Some(_)) => "reminderCreated",
        (Some(_), None) => "reminderRemoved",
        _ => "reminderUpdated",
    };
    let summary = match event_type {
        "reminderCreated" => "Lembrete criado",
        "reminderRemoved" => "Lembrete removido",
        _ => "Lembrete alterado",
    };

    LifecycleEventInput {
        entity_type: LifecycleEntityType::Reminder,
        entity_id: format!("task:{task_id}"),
        task_id: Some(task_id.to_string()),
        event_type,
        actor: LifecycleActor::user(),
        summary: summary.into(),
        metadata: serde_json::json!({
            "scheduledAt": lifecycle::value_change(from, to)
        }),
    }
}

fn due_summary(from: Option<&String>, to: Option<&String>) -> &'static str {
    match (from, to) {
        (None, Some(_)) => "Vencimento definido",
        (Some(_), None) => "Vencimento removido",
        _ => "Vencimento alterado",
    }
}

fn now_iso() -> Result<String, String> {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .map_err(|error| error.to_string())
}
