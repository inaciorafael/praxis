use serde::{Deserialize, Serialize};
use serde_json::Value;
use tauri::AppHandle;
use uuid::Uuid;

use crate::{
    badge::BadgeStore,
    lifecycle::{self, LifecycleActor, LifecycleEntityType, LifecycleEventInput},
    native_reminders, reminders, tasks,
    vault::{read_active_document, write_active_document, VaultStore},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChecklistItem {
    pub(crate) id: String,
    pub(crate) task_id: String,
    pub(crate) title: String,
    pub(crate) status: ChecklistItemStatus,
    pub(crate) sort_order: i64,
    pub(crate) completed_at: Option<String>,
    pub(crate) created_at: String,
    pub(crate) updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ChecklistItemStatus {
    Pending,
    Completed,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskProgress {
    pub total_items: usize,
    pub completed_items: usize,
    pub percentage: u8,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateChecklistItemInput {
    task_id: String,
    title: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateChecklistItemInput {
    title: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReorderChecklistItemsInput {
    task_id: String,
    ordered_ids: Vec<String>,
}

#[tauri::command]
pub fn create_checklist_item(
    app: AppHandle,
    vault: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
    input: CreateChecklistItemInput,
    today: String,
) -> Result<tasks::TaskCollection, String> {
    let mut document = read_active_document(&vault)?;
    let mut task_records = tasks::read_tasks_from_document(&document)?;

    if !task_records.iter().any(|task| task.id == input.task_id) {
        return Err("Tarefa nao encontrada.".into());
    }

    let mut items = read_checklist_items_from_document(&document)?;
    let title = input.title.trim();

    if title.is_empty() {
        return Err("Informe o titulo do item.".into());
    }

    let now = now_iso()?;
    let next_order = items
        .iter()
        .filter(|item| item.task_id == input.task_id)
        .map(|item| item.sort_order)
        .max()
        .unwrap_or(-1)
        + 1;
    let item = ChecklistItem {
        id: Uuid::new_v4().to_string(),
        task_id: input.task_id.clone(),
        title: title.into(),
        status: ChecklistItemStatus::Pending,
        sort_order: next_order,
        completed_at: None,
        created_at: now.clone(),
        updated_at: now,
    };

    lifecycle::append_event(
        &mut document,
        LifecycleEventInput {
            entity_type: LifecycleEntityType::ChecklistItem,
            entity_id: item.id.clone(),
            task_id: Some(input.task_id.clone()),
            event_type: "checklistItemAdded",
            actor: LifecycleActor::user(),
            summary: "Item de checklist adicionado".into(),
            metadata: serde_json::json!({ "checklistItemId": item.id, "title": item.title }),
        },
    )?;

    items.push(item);
    write_checklist_items_to_document(&mut document, &items)?;
    let status_events = sync_parent_task_status_from_checklist(
        &mut task_records,
        &items,
        &input.task_id,
        LifecycleActor::system(),
    )?;
    lifecycle::append_events(&mut document, status_events)?;
    tasks::write_tasks_to_document(&mut document, &task_records)?;
    let reminder_sync = reminders::sync_task_reminders_in_document(&mut document, &task_records)?;
    write_active_document(&vault, &mut document)?;
    native_reminders::reconcile_native_reminders(&app, &reminder_sync.reminders);
    tasks::finish_task_collection(
        app,
        badge_state,
        task_records,
        reminder_sync.reminders,
        &today,
    )
}

#[tauri::command]
pub fn update_checklist_item(
    app: AppHandle,
    vault: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
    id: String,
    input: UpdateChecklistItemInput,
    today: String,
) -> Result<tasks::TaskCollection, String> {
    let mut document = read_active_document(&vault)?;
    let task_records = tasks::read_tasks_from_document(&document)?;
    let mut items = read_checklist_items_from_document(&document)?;
    let title = input.title.trim();

    if title.is_empty() {
        return Err("Informe o titulo do item.".into());
    }

    let item = items
        .iter_mut()
        .find(|item| item.id == id)
        .ok_or_else(|| "Item nao encontrado.".to_string())?;

    if item.title != title {
        let old_title = item.title.clone();
        item.title = title.into();
        item.updated_at = now_iso()?;
        lifecycle::append_event(
            &mut document,
            LifecycleEventInput {
                entity_type: LifecycleEntityType::ChecklistItem,
                entity_id: item.id.clone(),
                task_id: Some(item.task_id.clone()),
                event_type: "checklistItemRenamed",
                actor: LifecycleActor::user(),
                summary: "Item de checklist renomeado".into(),
                metadata: serde_json::json!({
                    "checklistItemId": item.id,
                    "title": lifecycle::value_change(Some(old_title), Some(item.title.clone()))
                }),
            },
        )?;
    }

    write_checklist_items_to_document(&mut document, &items)?;
    tasks::write_tasks_to_document(&mut document, &task_records)?;
    let reminder_sync = reminders::sync_task_reminders_in_document(&mut document, &task_records)?;
    write_active_document(&vault, &mut document)?;
    native_reminders::reconcile_native_reminders(&app, &reminder_sync.reminders);
    tasks::finish_task_collection(
        app,
        badge_state,
        task_records,
        reminder_sync.reminders,
        &today,
    )
}

#[tauri::command]
pub fn set_checklist_item_completed(
    app: AppHandle,
    vault: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
    id: String,
    completed: bool,
    today: String,
) -> Result<tasks::TaskCollection, String> {
    let mut document = read_active_document(&vault)?;
    let mut task_records = tasks::read_tasks_from_document(&document)?;
    let mut items = read_checklist_items_from_document(&document)?;
    let now = now_iso()?;
    let item = items
        .iter_mut()
        .find(|item| item.id == id)
        .ok_or_else(|| "Item nao encontrado.".to_string())?;

    if (item.status == ChecklistItemStatus::Completed) != completed {
        item.status = if completed {
            ChecklistItemStatus::Completed
        } else {
            ChecklistItemStatus::Pending
        };
        item.completed_at = completed.then_some(now.clone());
        item.updated_at = now;
        lifecycle::append_event(
            &mut document,
            LifecycleEventInput {
                entity_type: LifecycleEntityType::ChecklistItem,
                entity_id: item.id.clone(),
                task_id: Some(item.task_id.clone()),
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
            },
        )?;
    }

    let task_id = item.task_id.clone();
    write_checklist_items_to_document(&mut document, &items)?;
    let status_events = sync_parent_task_status_from_checklist(
        &mut task_records,
        &items,
        &task_id,
        LifecycleActor::system(),
    )?;
    lifecycle::append_events(&mut document, status_events)?;
    tasks::write_tasks_to_document(&mut document, &task_records)?;
    let reminder_sync = reminders::sync_task_reminders_in_document(&mut document, &task_records)?;
    write_active_document(&vault, &mut document)?;
    native_reminders::reconcile_native_reminders(&app, &reminder_sync.reminders);
    tasks::finish_task_collection(
        app,
        badge_state,
        task_records,
        reminder_sync.reminders,
        &today,
    )
}

#[tauri::command]
pub fn delete_checklist_item(
    app: AppHandle,
    vault: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
    id: String,
    today: String,
) -> Result<tasks::TaskCollection, String> {
    let mut document = read_active_document(&vault)?;
    let mut task_records = tasks::read_tasks_from_document(&document)?;
    let mut items = read_checklist_items_from_document(&document)?;
    let removed = items
        .iter()
        .find(|item| item.id == id)
        .cloned()
        .ok_or_else(|| "Item nao encontrado.".to_string())?;

    items.retain(|item| item.id != id);
    lifecycle::append_event(
        &mut document,
        LifecycleEventInput {
            entity_type: LifecycleEntityType::ChecklistItem,
            entity_id: removed.id.clone(),
            task_id: Some(removed.task_id.clone()),
            event_type: "checklistItemRemoved",
            actor: LifecycleActor::user(),
            summary: "Item de checklist removido".into(),
            metadata: serde_json::json!({ "checklistItemId": removed.id, "title": removed.title }),
        },
    )?;

    write_checklist_items_to_document(&mut document, &items)?;
    let status_events = sync_parent_task_status_from_checklist(
        &mut task_records,
        &items,
        &removed.task_id,
        LifecycleActor::system(),
    )?;
    lifecycle::append_events(&mut document, status_events)?;
    tasks::write_tasks_to_document(&mut document, &task_records)?;
    let reminder_sync = reminders::sync_task_reminders_in_document(&mut document, &task_records)?;
    write_active_document(&vault, &mut document)?;
    native_reminders::reconcile_native_reminders(&app, &reminder_sync.reminders);
    tasks::finish_task_collection(
        app,
        badge_state,
        task_records,
        reminder_sync.reminders,
        &today,
    )
}

#[tauri::command]
pub fn reorder_checklist_items(
    app: AppHandle,
    vault: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
    input: ReorderChecklistItemsInput,
    today: String,
) -> Result<tasks::TaskCollection, String> {
    let mut document = read_active_document(&vault)?;
    let task_records = tasks::read_tasks_from_document(&document)?;
    let mut items = read_checklist_items_from_document(&document)?;

    for (index, id) in input.ordered_ids.iter().enumerate() {
        if let Some(item) = items
            .iter_mut()
            .find(|item| item.task_id == input.task_id && item.id == *id)
        {
            item.sort_order = index as i64;
            item.updated_at = now_iso()?;
        }
    }

    write_checklist_items_to_document(&mut document, &items)?;
    tasks::write_tasks_to_document(&mut document, &task_records)?;
    let reminder_sync = reminders::sync_task_reminders_in_document(&mut document, &task_records)?;
    write_active_document(&vault, &mut document)?;
    native_reminders::reconcile_native_reminders(&app, &reminder_sync.reminders);
    tasks::finish_task_collection(
        app,
        badge_state,
        task_records,
        reminder_sync.reminders,
        &today,
    )
}

pub(crate) fn read_checklist_items_from_document(
    document: &Value,
) -> Result<Vec<ChecklistItem>, String> {
    let mut items: Vec<ChecklistItem> = serde_json::from_value(
        document
            .get("checklistItems")
            .cloned()
            .unwrap_or_else(|| Value::Array(Vec::new())),
    )
    .map_err(|error| error.to_string())?;

    items.sort_by(|left, right| {
        left.task_id
            .cmp(&right.task_id)
            .then(left.sort_order.cmp(&right.sort_order))
            .then(left.created_at.cmp(&right.created_at))
    });
    Ok(items)
}

pub(crate) fn write_checklist_items_to_document(
    document: &mut Value,
    items: &[ChecklistItem],
) -> Result<(), String> {
    let Some(object) = document.as_object_mut() else {
        return Err("Documento .praxis invalido.".into());
    };

    object.insert(
        "checklistItems".into(),
        serde_json::to_value(items).map_err(|error| error.to_string())?,
    );

    Ok(())
}

pub(crate) fn remove_task_checklist_items_from_document(
    document: &mut Value,
    task_id: &str,
) -> Result<(), String> {
    let Some(items) = document
        .get_mut("checklistItems")
        .and_then(Value::as_array_mut)
    else {
        return Ok(());
    };

    items.retain(|item| item.get("taskId").and_then(Value::as_str) != Some(task_id));
    Ok(())
}

pub(crate) fn progress_for_task(
    items: &[ChecklistItem],
    task_id: &str,
    completed: bool,
) -> TaskProgress {
    let task_items = items
        .iter()
        .filter(|item| item.task_id == task_id)
        .collect::<Vec<_>>();

    if task_items.is_empty() {
        return TaskProgress {
            total_items: 0,
            completed_items: usize::from(completed),
            percentage: if completed { 100 } else { 0 },
        };
    }

    let completed_items = task_items
        .iter()
        .filter(|item| item.status == ChecklistItemStatus::Completed)
        .count();
    let percentage = ((completed_items as f64 / task_items.len() as f64) * 100.0).round() as u8;

    TaskProgress {
        total_items: task_items.len(),
        completed_items,
        percentage,
    }
}

pub(crate) fn sync_parent_task_status_from_checklist(
    tasks: &mut [tasks::Task],
    items: &[ChecklistItem],
    task_id: &str,
    actor: LifecycleActor,
) -> Result<Vec<LifecycleEventInput>, String> {
    let task_items = items
        .iter()
        .filter(|item| item.task_id == task_id)
        .collect::<Vec<_>>();

    if task_items.is_empty() {
        return Ok(Vec::new());
    }

    let task = tasks
        .iter_mut()
        .find(|task| task.id == task_id)
        .ok_or_else(|| "Tarefa nao encontrada.".to_string())?;
    let all_completed = task_items
        .iter()
        .all(|item| item.status == ChecklistItemStatus::Completed);
    let should_be_completed = all_completed;

    if (task.status == tasks::TaskStatus::Completed) == should_be_completed {
        return Ok(Vec::new());
    }

    let now = now_iso()?;
    task.status = if should_be_completed {
        tasks::TaskStatus::Completed
    } else {
        tasks::TaskStatus::Pending
    };
    task.completed_at = should_be_completed.then_some(now.clone());
    task.retention_exempt = false;
    task.updated_at = now;

    Ok(vec![LifecycleEventInput {
        entity_type: LifecycleEntityType::Task,
        entity_id: task_id.to_string(),
        task_id: Some(task_id.to_string()),
        event_type: if should_be_completed {
            "checklistCompletedTask"
        } else {
            "checklistReopenedTask"
        },
        actor,
        summary: if should_be_completed {
            "Checklist concluiu a tarefa".into()
        } else {
            "Checklist reabriu a tarefa".into()
        },
        metadata: serde_json::json!({
            "completedAt": task.completed_at,
            "progress": progress_for_task(items, task_id, should_be_completed),
        }),
    }])
}

fn now_iso() -> Result<String, String> {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn task(id: &str, status: tasks::TaskStatus) -> tasks::Task {
        tasks::Task {
            id: id.into(),
            title: "Task".into(),
            notes: None,
            status,
            planned_for: Some("2026-06-18".into()),
            due_at: None,
            reminder_at: None,
            recurrence_id: None,
            occurrence_date: None,
            completed_at: None,
            archived_at: None,
            retention_exempt: false,
            created_at: "2026-06-18T00:00:00Z".into(),
            updated_at: "2026-06-18T00:00:00Z".into(),
        }
    }

    fn item(id: &str, task_id: &str, status: ChecklistItemStatus) -> ChecklistItem {
        ChecklistItem {
            id: id.into(),
            task_id: task_id.into(),
            title: "Item".into(),
            status,
            sort_order: 0,
            completed_at: None,
            created_at: "2026-06-18T00:00:00Z".into(),
            updated_at: "2026-06-18T00:00:00Z".into(),
        }
    }

    #[test]
    fn calculates_progress_from_checklist_items() {
        let items = vec![
            item("1", "task-1", ChecklistItemStatus::Completed),
            item("2", "task-1", ChecklistItemStatus::Pending),
            item("3", "task-1", ChecklistItemStatus::Pending),
        ];
        let progress = progress_for_task(&items, "task-1", false);

        assert_eq!(progress.total_items, 3);
        assert_eq!(progress.completed_items, 1);
        assert_eq!(progress.percentage, 33);
    }

    #[test]
    fn completes_parent_when_all_checklist_items_are_completed() {
        let mut tasks = vec![task("task-1", tasks::TaskStatus::Pending)];
        let items = vec![
            item("1", "task-1", ChecklistItemStatus::Completed),
            item("2", "task-1", ChecklistItemStatus::Completed),
        ];
        let events = sync_parent_task_status_from_checklist(
            &mut tasks,
            &items,
            "task-1",
            LifecycleActor::system(),
        )
        .unwrap();

        assert_eq!(tasks[0].status, tasks::TaskStatus::Completed);
        assert_eq!(events[0].event_type, "checklistCompletedTask");
    }

    #[test]
    fn reopens_parent_when_a_checklist_item_is_pending() {
        let mut tasks = vec![task("task-1", tasks::TaskStatus::Completed)];
        let items = vec![
            item("1", "task-1", ChecklistItemStatus::Completed),
            item("2", "task-1", ChecklistItemStatus::Pending),
        ];
        let events = sync_parent_task_status_from_checklist(
            &mut tasks,
            &items,
            "task-1",
            LifecycleActor::system(),
        )
        .unwrap();

        assert_eq!(tasks[0].status, tasks::TaskStatus::Pending);
        assert_eq!(events[0].event_type, "checklistReopenedTask");
    }

    #[test]
    fn checklist_parent_status_controls_reminder_sync() {
        let mut document = serde_json::json!({
            "reminders": [{
                "id": "task:task-1",
                "taskId": "task-1",
                "notificationId": 10,
                "scheduledAt": "2026-06-18T09:00:00Z",
                "status": "scheduled",
                "createdAt": "2026-06-18T00:00:00Z",
                "updatedAt": "2026-06-18T00:00:00Z"
            }]
        });
        let mut tasks = vec![task("task-1", tasks::TaskStatus::Pending)];
        tasks[0].reminder_at = Some("2026-06-18T09:00:00Z".into());
        let completed_items = vec![
            item("1", "task-1", ChecklistItemStatus::Completed),
            item("2", "task-1", ChecklistItemStatus::Completed),
        ];

        sync_parent_task_status_from_checklist(
            &mut tasks,
            &completed_items,
            "task-1",
            LifecycleActor::system(),
        )
        .unwrap();
        let cancelled = reminders::sync_task_reminders_in_document(&mut document, &tasks).unwrap();

        assert_eq!(tasks[0].status, tasks::TaskStatus::Completed);
        assert_eq!(
            cancelled.reminders[0].status,
            reminders::ReminderStatus::Cancelled
        );

        let reopened_items = vec![
            item("1", "task-1", ChecklistItemStatus::Completed),
            item("2", "task-1", ChecklistItemStatus::Pending),
        ];
        sync_parent_task_status_from_checklist(
            &mut tasks,
            &reopened_items,
            "task-1",
            LifecycleActor::system(),
        )
        .unwrap();
        let scheduled = reminders::sync_task_reminders_in_document(&mut document, &tasks).unwrap();

        assert_eq!(tasks[0].status, tasks::TaskStatus::Pending);
        assert_eq!(
            scheduled.reminders[0].status,
            reminders::ReminderStatus::Scheduled
        );
    }
}
