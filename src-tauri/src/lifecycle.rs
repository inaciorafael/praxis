use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use uuid::Uuid;

use crate::vault::{read_active_document, VaultStore};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LifecycleEntityType {
    Task,
    Tag,
    Reminder,
    ChecklistItem,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum LifecycleActorType {
    User,
    System,
    Recurrence,
    Scheduler,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LifecycleActor {
    #[serde(rename = "type")]
    actor_type: LifecycleActorType,
    label: Option<String>,
}

impl LifecycleActor {
    pub fn user() -> Self {
        Self {
            actor_type: LifecycleActorType::User,
            label: None,
        }
    }

    pub fn scheduler() -> Self {
        Self {
            actor_type: LifecycleActorType::Scheduler,
            label: None,
        }
    }

    pub fn system() -> Self {
        Self {
            actor_type: LifecycleActorType::System,
            label: None,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LifecycleEvent {
    id: String,
    entity_type: LifecycleEntityType,
    entity_id: String,
    task_id: Option<String>,
    #[serde(rename = "type")]
    event_type: String,
    occurred_at: String,
    actor: LifecycleActor,
    summary: String,
    metadata: Value,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskTimeline {
    task_id: String,
    events: Vec<LifecycleEvent>,
}

#[derive(Debug, Clone)]
pub struct LifecycleEventInput {
    pub entity_type: LifecycleEntityType,
    pub entity_id: String,
    pub task_id: Option<String>,
    pub event_type: &'static str,
    pub actor: LifecycleActor,
    pub summary: String,
    pub metadata: Value,
}

#[tauri::command]
pub fn list_task_timeline(
    vault: tauri::State<'_, VaultStore>,
    task_id: String,
) -> Result<TaskTimeline, String> {
    let document = read_active_document(&vault)?;
    let mut events = read_lifecycle_events_from_document(&document)?
        .into_iter()
        .filter(|event| event.task_id.as_deref() == Some(task_id.as_str()))
        .collect::<Vec<_>>();

    events.sort_by(|current, next| current.occurred_at.cmp(&next.occurred_at));

    Ok(TaskTimeline { task_id, events })
}

pub fn append_event(document: &mut Value, input: LifecycleEventInput) -> Result<(), String> {
    append_events(document, vec![input])
}

pub fn append_events(document: &mut Value, inputs: Vec<LifecycleEventInput>) -> Result<(), String> {
    if inputs.is_empty() {
        return Ok(());
    }

    let mut events = read_lifecycle_events_from_document(document)?;
    let now = now_iso()?;

    for input in inputs {
        events.push(LifecycleEvent {
            id: Uuid::new_v4().to_string(),
            entity_type: input.entity_type,
            entity_id: input.entity_id,
            task_id: input.task_id,
            event_type: input.event_type.to_string(),
            occurred_at: now.clone(),
            actor: input.actor,
            summary: input.summary,
            metadata: input.metadata,
        });
    }

    write_lifecycle_events_to_document(document, &events)
}

pub fn read_lifecycle_events_from_document(
    document: &Value,
) -> Result<Vec<LifecycleEvent>, String> {
    let events = document
        .get("lifecycleEvents")
        .cloned()
        .unwrap_or_else(|| Value::Array(Vec::new()));

    serde_json::from_value(events).map_err(|error| error.to_string())
}

fn write_lifecycle_events_to_document(
    document: &mut Value,
    events: &[LifecycleEvent],
) -> Result<(), String> {
    let Some(object) = document.as_object_mut() else {
        return Err("Documento .praxis invalido.".into());
    };

    object.insert(
        "lifecycleEvents".into(),
        serde_json::to_value(events).map_err(|error| error.to_string())?,
    );

    Ok(())
}

pub fn value_change(from: Option<String>, to: Option<String>) -> Value {
    json!({ "from": from, "to": to })
}

fn now_iso() -> Result<String, String> {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn appends_and_reads_lifecycle_events() {
        let mut document = json!({ "schemaVersion": 1 });

        append_event(
            &mut document,
            LifecycleEventInput {
                entity_type: LifecycleEntityType::Task,
                entity_id: "task-1".into(),
                task_id: Some("task-1".into()),
                event_type: "taskCreated",
                actor: LifecycleActor::user(),
                summary: "Tarefa criada".into(),
                metadata: json!({ "title": "Enviar proposta" }),
            },
        )
        .expect("append should succeed");

        let events = read_lifecycle_events_from_document(&document).expect("events should parse");

        assert_eq!(events.len(), 1);
        assert_eq!(events[0].entity_id, "task-1");
        assert_eq!(events[0].task_id.as_deref(), Some("task-1"));
        assert_eq!(events[0].event_type, "taskCreated");
        assert_eq!(events[0].summary, "Tarefa criada");
        assert_eq!(events[0].metadata["title"], "Enviar proposta");
    }

    #[test]
    fn serializes_api_shape_expected_by_frontend() {
        let mut document = json!({ "schemaVersion": 1 });

        append_event(
            &mut document,
            LifecycleEventInput {
                entity_type: LifecycleEntityType::Reminder,
                entity_id: "task:task-1".into(),
                task_id: Some("task-1".into()),
                event_type: "reminderCreated",
                actor: LifecycleActor::scheduler(),
                summary: "Lembrete criado".into(),
                metadata: json!({
                    "scheduledAt": value_change(None, Some("2026-06-18T15:00:00Z".into()))
                }),
            },
        )
        .expect("append should succeed");

        let serialized = document["lifecycleEvents"][0].clone();

        assert_eq!(serialized["entityType"], "reminder");
        assert_eq!(serialized["entityId"], "task:task-1");
        assert_eq!(serialized["taskId"], "task-1");
        assert_eq!(serialized["type"], "reminderCreated");
        assert_eq!(serialized["actor"]["type"], "scheduler");
        assert_eq!(
            serialized["metadata"]["scheduledAt"]["to"],
            "2026-06-18T15:00:00Z"
        );
        assert!(serialized.get("eventType").is_none());
        assert!(serialized["actor"].get("actorType").is_none());
    }
}
