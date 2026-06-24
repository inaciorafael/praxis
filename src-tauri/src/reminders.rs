use std::collections::{BTreeSet, HashMap};

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    lifecycle::{self, LifecycleActor, LifecycleEntityType, LifecycleEventInput},
    native_reminders,
    tasks::{Task, TaskStatus},
    vault::{read_active_document, write_active_document, VaultStore},
};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum ReminderStatus {
    Scheduled,
    Fired,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Reminder {
    pub(crate) id: String,
    task_id: String,
    notification_id: u32,
    pub(crate) scheduled_at: String,
    pub(crate) status: ReminderStatus,
    created_at: String,
    updated_at: String,
}

pub struct ReminderSyncResult {
    pub reminders: Vec<Reminder>,
    pub changed: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReminderLaunchPayload {
    reminder_id: String,
    notification_id: u32,
    task_id: String,
    title: String,
    body: String,
    scheduled_at: String,
}

impl Reminder {
    pub(crate) fn task_id(&self) -> &str {
        &self.task_id
    }
}

#[tauri::command]
pub fn list_reminders(vault: tauri::State<'_, VaultStore>) -> Result<Vec<Reminder>, String> {
    let document = read_active_document(&vault)?;
    read_reminders_from_document(&document)
}

#[tauri::command]
pub fn get_reminder_launch_payload(
    vault: tauri::State<'_, VaultStore>,
    id: String,
) -> Result<Option<ReminderLaunchPayload>, String> {
    let document = read_active_document(&vault)?;
    let reminders = read_reminders_from_document(&document)?;
    let tasks = crate::tasks::read_tasks_from_document(&document)?;

    Ok(find_reminder_launch_payload(&reminders, &tasks, &id))
}

#[tauri::command]
pub fn mark_reminder_fired(
    app: tauri::AppHandle,
    vault: tauri::State<'_, VaultStore>,
    id: String,
) -> Result<Vec<Reminder>, String> {
    let mut document = read_active_document(&vault)?;
    let mut reminders = read_reminders_from_document(&document)?;
    let now = now_iso()?;
    let mut found = false;
    let mut fired_event = None;

    for reminder in &mut reminders {
        if reminder.id == id {
            reminder.status = ReminderStatus::Fired;
            reminder.updated_at = now.clone();
            fired_event = Some(LifecycleEventInput {
                entity_type: LifecycleEntityType::Reminder,
                entity_id: reminder.id.clone(),
                task_id: Some(reminder.task_id.clone()),
                event_type: "reminderFired",
                actor: LifecycleActor::scheduler(),
                summary: "Lembrete disparado".into(),
                metadata: serde_json::json!({
                    "reminderId": reminder.id.clone(),
                    "taskId": reminder.task_id.clone(),
                    "scheduledAt": reminder.scheduled_at.clone(),
                    "firedAt": now.clone(),
                    "notificationId": reminder.notification_id
                }),
            });
            found = true;
            break;
        }
    }

    if !found {
        return Err("Lembrete nao encontrado.".into());
    }

    if let Some(event) = fired_event {
        lifecycle::append_event(&mut document, event)?;
    }

    write_reminders_to_document(&mut document, &reminders)?;
    write_active_document(&vault, &mut document)?;
    native_reminders::reconcile_native_reminders(&app, &reminders);
    Ok(reminders)
}

pub fn sync_task_reminders_in_document(
    document: &mut Value,
    tasks: &[Task],
) -> Result<ReminderSyncResult, String> {
    let mut reminders = read_reminders_from_document(document)?;
    let now = now_iso()?;
    let mut changed = false;
    let task_ids = tasks
        .iter()
        .map(|task| task.id.as_str())
        .collect::<BTreeSet<_>>();

    reminders.retain(|reminder| {
        let exists = task_ids.contains(reminder.task_id.as_str());
        changed |= !exists;
        exists
    });
    let mut reminder_positions = reminders
        .iter()
        .enumerate()
        .map(|(index, reminder)| (reminder.id.clone(), index))
        .collect::<HashMap<_, _>>();

    for task in tasks {
        let reminder_id = task_reminder_id(&task.id);
        let existing_index = reminder_positions.get(&reminder_id).copied();
        let should_schedule = task.status == TaskStatus::Pending && task.reminder_at.is_some();

        if !should_schedule {
            if let Some(reminder) = existing_index.map(|index| &mut reminders[index]) {
                if reminder.status == ReminderStatus::Scheduled {
                    reminder.status = ReminderStatus::Cancelled;
                    reminder.updated_at = now.clone();
                    changed = true;
                }
            }

            continue;
        }

        let scheduled_at = task.reminder_at.as_ref().expect("checked above").clone();

        match existing_index.map(|index| &mut reminders[index]) {
            Some(reminder)
                if reminder.scheduled_at == scheduled_at
                    && reminder.status == ReminderStatus::Scheduled => {}
            Some(reminder) => {
                reminder.scheduled_at = scheduled_at;
                reminder.status = ReminderStatus::Scheduled;
                reminder.notification_id = notification_id_for_task(&task.id);
                reminder.updated_at = now.clone();
                changed = true;
            }
            None => {
                reminders.push(Reminder {
                    id: reminder_id.clone(),
                    task_id: task.id.clone(),
                    notification_id: notification_id_for_task(&task.id),
                    scheduled_at,
                    status: ReminderStatus::Scheduled,
                    created_at: now.clone(),
                    updated_at: now.clone(),
                });
                reminder_positions.insert(reminder_id, reminders.len() - 1);
                changed = true;
            }
        }
    }

    if changed {
        write_reminders_to_document(document, &reminders)?;
    }

    Ok(ReminderSyncResult { reminders, changed })
}

pub fn read_reminders_from_document(document: &Value) -> Result<Vec<Reminder>, String> {
    let reminders = document
        .get("reminders")
        .cloned()
        .unwrap_or_else(|| Value::Array(Vec::new()));

    serde_json::from_value(reminders).map_err(|error| error.to_string())
}

fn write_reminders_to_document(document: &mut Value, reminders: &[Reminder]) -> Result<(), String> {
    let Some(object) = document.as_object_mut() else {
        return Err("Documento .praxis invalido.".into());
    };

    object.insert(
        "reminders".into(),
        serde_json::to_value(reminders).map_err(|error| error.to_string())?,
    );

    Ok(())
}

fn task_reminder_id(task_id: &str) -> String {
    format!("task:{task_id}")
}

fn notification_id_for_task(task_id: &str) -> u32 {
    const MAX_INT_32: u32 = 2_147_483_647;
    let mut hash = 2_166_136_261_u32;

    for byte in task_id.as_bytes() {
        hash ^= u32::from(*byte);
        hash = hash.wrapping_mul(16_777_619);
    }

    hash % MAX_INT_32
}

fn find_reminder_launch_payload(
    reminders: &[Reminder],
    tasks: &[Task],
    id: &str,
) -> Option<ReminderLaunchPayload> {
    let reminder = reminders
        .iter()
        .find(|reminder| reminder.id == id && reminder.status == ReminderStatus::Scheduled)?;
    let task = tasks.iter().find(|task| {
        task.id == reminder.task_id
            && task.status == TaskStatus::Pending
            && task.archived_at.is_none()
    })?;

    Some(ReminderLaunchPayload {
        reminder_id: reminder.id.clone(),
        notification_id: reminder.notification_id,
        task_id: task.id.clone(),
        title: task.title.clone(),
        body: task.notes.clone().unwrap_or_default(),
        scheduled_at: reminder.scheduled_at.clone(),
    })
}

fn now_iso() -> Result<String, String> {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    fn task(id: &str, status: TaskStatus, reminder_at: Option<&str>) -> Task {
        Task {
            id: id.into(),
            title: "Task".into(),
            notes: None,
            status,
            planned_for: Some("2026-06-18".into()),
            due_at: None,
            reminder_at: reminder_at.map(str::to_string),
            recurrence_id: None,
            occurrence_date: None,
            completed_at: None,
            archived_at: None,
            retention_exempt: false,
            created_at: "2026-06-18T00:00:00Z".into(),
            updated_at: "2026-06-18T00:00:00Z".into(),
        }
    }

    #[test]
    fn schedules_pending_task_reminder() {
        let mut document = json!({ "reminders": [] });
        let tasks = vec![task(
            "task-1",
            TaskStatus::Pending,
            Some("2026-06-18T09:00:00Z"),
        )];

        let sync = sync_task_reminders_in_document(&mut document, &tasks)
            .expect("reminder sync should succeed");

        assert!(sync.changed);
        assert_eq!(sync.reminders.len(), 1);
        assert_eq!(sync.reminders[0].id, "task:task-1");
        assert_eq!(sync.reminders[0].task_id, "task-1");
        assert_eq!(sync.reminders[0].scheduled_at, "2026-06-18T09:00:00Z");
        assert_eq!(sync.reminders[0].status, ReminderStatus::Scheduled);
    }

    #[test]
    fn completing_task_cancels_scheduled_reminder() {
        let mut document = json!({
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
        let tasks = vec![task(
            "task-1",
            TaskStatus::Completed,
            Some("2026-06-18T09:00:00Z"),
        )];

        let sync = sync_task_reminders_in_document(&mut document, &tasks)
            .expect("reminder sync should succeed");

        assert!(sync.changed);
        assert_eq!(sync.reminders.len(), 1);
        assert_eq!(sync.reminders[0].status, ReminderStatus::Cancelled);
    }

    #[test]
    fn reopening_task_reschedules_cancelled_reminder_with_same_time() {
        let mut document = json!({
            "reminders": [{
                "id": "task:task-1",
                "taskId": "task-1",
                "notificationId": 10,
                "scheduledAt": "2026-06-18T09:00:00Z",
                "status": "cancelled",
                "createdAt": "2026-06-18T00:00:00Z",
                "updatedAt": "2026-06-18T00:00:00Z"
            }]
        });
        let tasks = vec![task(
            "task-1",
            TaskStatus::Pending,
            Some("2026-06-18T09:00:00Z"),
        )];

        let sync = sync_task_reminders_in_document(&mut document, &tasks)
            .expect("reminder sync should succeed");

        assert!(sync.changed);
        assert_eq!(sync.reminders[0].status, ReminderStatus::Scheduled);
    }

    #[test]
    fn removes_reminders_for_deleted_tasks() {
        let mut document = json!({
            "reminders": [{
                "id": "task:missing",
                "taskId": "missing",
                "notificationId": 10,
                "scheduledAt": "2026-06-18T09:00:00Z",
                "status": "scheduled",
                "createdAt": "2026-06-18T00:00:00Z",
                "updatedAt": "2026-06-18T00:00:00Z"
            }]
        });

        let sync = sync_task_reminders_in_document(&mut document, &[])
            .expect("reminder sync should succeed");

        assert!(sync.changed);
        assert!(sync.reminders.is_empty());
    }

    #[test]
    fn resolves_native_launch_payload_independently_from_task_views() {
        let reminders = vec![Reminder {
            id: "task:task-1".into(),
            task_id: "task-1".into(),
            notification_id: 42,
            scheduled_at: "2026-06-24T09:00:00Z".into(),
            status: ReminderStatus::Scheduled,
            created_at: "2026-06-24T08:00:00Z".into(),
            updated_at: "2026-06-24T08:00:00Z".into(),
        }];
        let tasks = vec![task(
            "task-1",
            TaskStatus::Pending,
            Some("2026-06-24T09:00:00Z"),
        )];

        let payload = find_reminder_launch_payload(&reminders, &tasks, "task:task-1")
            .expect("native launch payload should exist");

        assert_eq!(payload.task_id, "task-1");
        assert_eq!(payload.notification_id, 42);
        assert_eq!(payload.title, "Task");
    }
}
