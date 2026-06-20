use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::Uuid;

use crate::{
    lifecycle::{self, LifecycleActor, LifecycleEntityType, LifecycleEventInput},
    vault::{read_active_document, write_active_document, VaultStore},
};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Tag {
    id: String,
    name: String,
    slug: String,
    color: String,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TaskTag {
    task_id: String,
    tag_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateTagInput {
    name: String,
    color: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTagInput {
    name: Option<String>,
    color: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TagCollection {
    tags: Vec<Tag>,
    task_tags: Vec<TaskTag>,
}

#[tauri::command]
pub fn list_tags(vault: tauri::State<'_, VaultStore>) -> Result<TagCollection, String> {
    let document = read_active_document(&vault)?;
    read_tag_collection_from_document(&document)
}

#[tauri::command]
pub fn create_tag(
    vault: tauri::State<'_, VaultStore>,
    input: CreateTagInput,
) -> Result<TagCollection, String> {
    let mut document = read_active_document(&vault)?;
    let mut collection = read_tag_collection_from_document(&document)?;
    let now = now_iso()?;
    let name = normalize_name(&input.name)?;
    let slug = unique_slug(&collection.tags, &name, None);
    let color = normalize_color(&input.color)?;

    let tag = Tag {
        id: Uuid::new_v4().to_string(),
        name,
        slug,
        color,
        created_at: now.clone(),
        updated_at: now,
    };
    lifecycle::append_event(
        &mut document,
        LifecycleEventInput {
            entity_type: LifecycleEntityType::Tag,
            entity_id: tag.id.clone(),
            task_id: None,
            event_type: "tagCreated",
            actor: LifecycleActor::user(),
            summary: format!("Tag +{} criada", tag.name),
            metadata: serde_json::json!({ "tagId": tag.id.clone(), "name": { "to": tag.name.clone() }, "color": { "to": tag.color.clone() } }),
        },
    )?;
    collection.tags.push(tag);

    write_tag_collection_to_document(&mut document, &collection)?;
    write_active_document(&vault, &mut document)?;
    Ok(collection)
}

#[tauri::command]
pub fn update_tag(
    vault: tauri::State<'_, VaultStore>,
    id: String,
    input: UpdateTagInput,
) -> Result<TagCollection, String> {
    let mut document = read_active_document(&vault)?;
    let mut collection = read_tag_collection_from_document(&document)?;
    let now = now_iso()?;
    let position = collection
        .tags
        .iter()
        .position(|tag| tag.id == id)
        .ok_or_else(|| "Tag nao encontrada.".to_string())?;
    let before = collection.tags[position].clone();
    let mut events = Vec::new();

    if let Some(name) = input.name {
        let name = normalize_name(&name)?;
        if collection.tags[position].name != name {
            events.push(LifecycleEventInput {
                entity_type: LifecycleEntityType::Tag,
                entity_id: id.clone(),
                task_id: None,
                event_type: "tagRenamed",
                actor: LifecycleActor::user(),
                summary: format!("Tag +{} renomeada para +{}", before.name, name),
                metadata: serde_json::json!({ "tagId": id, "name": lifecycle::value_change(Some(before.name.clone()), Some(name.clone())) }),
            });
            collection.tags[position].slug = unique_slug(&collection.tags, &name, Some(&id));
            collection.tags[position].name = name;
        }
    }

    if let Some(color) = input.color {
        let color = normalize_color(&color)?;
        if collection.tags[position].color != color {
            events.push(LifecycleEventInput {
                entity_type: LifecycleEntityType::Tag,
                entity_id: id.clone(),
                task_id: None,
                event_type: "tagColorUpdated",
                actor: LifecycleActor::user(),
                summary: format!("Cor da tag +{} alterada", collection.tags[position].name),
                metadata: serde_json::json!({ "tagId": id, "color": lifecycle::value_change(Some(collection.tags[position].color.clone()), Some(color.clone())) }),
            });
            collection.tags[position].color = color;
        }
    }

    if !events.is_empty() {
        collection.tags[position].updated_at = now;
        lifecycle::append_events(&mut document, events)?;
    }
    write_tag_collection_to_document(&mut document, &collection)?;
    write_active_document(&vault, &mut document)?;
    Ok(collection)
}

#[tauri::command]
pub fn delete_tag(
    vault: tauri::State<'_, VaultStore>,
    id: String,
) -> Result<TagCollection, String> {
    let mut document = read_active_document(&vault)?;
    let mut collection = read_tag_collection_from_document(&document)?;
    let original_len = collection.tags.len();
    let removed_tag = collection.tags.iter().find(|tag| tag.id == id).cloned();

    collection.tags.retain(|tag| tag.id != id);

    if collection.tags.len() == original_len {
        return Err("Tag nao encontrada.".into());
    }

    collection
        .task_tags
        .retain(|relation| relation.tag_id != id);
    if let Some(tag) = removed_tag {
        lifecycle::append_event(
            &mut document,
            LifecycleEventInput {
                entity_type: LifecycleEntityType::Tag,
                entity_id: id.clone(),
                task_id: None,
                event_type: "tagDeleted",
                actor: LifecycleActor::user(),
                summary: format!("Tag +{} removida", tag.name),
                metadata: serde_json::json!({ "tagId": id, "name": tag.name }),
            },
        )?;
    }
    write_tag_collection_to_document(&mut document, &collection)?;
    write_active_document(&vault, &mut document)?;
    Ok(collection)
}

#[tauri::command]
pub fn assign_tag_to_task(
    vault: tauri::State<'_, VaultStore>,
    task_id: String,
    tag_id: String,
) -> Result<TagCollection, String> {
    let mut document = read_active_document(&vault)?;
    ensure_task_exists(&document, &task_id)?;
    let mut collection = read_tag_collection_from_document(&document)?;

    if !collection.tags.iter().any(|tag| tag.id == tag_id) {
        return Err("Tag nao encontrada.".into());
    }

    let tag_name = collection
        .tags
        .iter()
        .find(|tag| tag.id == tag_id)
        .map(|tag| tag.name.clone())
        .unwrap_or_else(|| "tag".into());
    let was_assigned = collection
        .task_tags
        .iter()
        .any(|relation| relation.task_id == task_id && relation.tag_id == tag_id);

    if !was_assigned {
        collection.task_tags.push(TaskTag {
            task_id: task_id.clone(),
            tag_id: tag_id.clone(),
        });
        lifecycle::append_event(
            &mut document,
            LifecycleEventInput {
                entity_type: LifecycleEntityType::Tag,
                entity_id: tag_id.clone(),
                task_id: Some(task_id.clone()),
                event_type: "tagAddedToTask",
                actor: LifecycleActor::user(),
                summary: format!("Tag +{} adicionada", tag_name),
                metadata: serde_json::json!({ "tagId": tag_id, "taskId": task_id }),
            },
        )?;
    }

    write_tag_collection_to_document(&mut document, &collection)?;
    write_active_document(&vault, &mut document)?;
    Ok(collection)
}

#[tauri::command]
pub fn remove_tag_from_task(
    vault: tauri::State<'_, VaultStore>,
    task_id: String,
    tag_id: String,
) -> Result<TagCollection, String> {
    let mut document = read_active_document(&vault)?;
    let mut collection = read_tag_collection_from_document(&document)?;
    let tag_name = collection
        .tags
        .iter()
        .find(|tag| tag.id == tag_id)
        .map(|tag| tag.name.clone())
        .unwrap_or_else(|| "tag".into());
    let had_relation = collection
        .task_tags
        .iter()
        .any(|relation| relation.task_id == task_id && relation.tag_id == tag_id);

    collection
        .task_tags
        .retain(|relation| !(relation.task_id == task_id && relation.tag_id == tag_id));

    if had_relation {
        lifecycle::append_event(
            &mut document,
            LifecycleEventInput {
                entity_type: LifecycleEntityType::Tag,
                entity_id: tag_id.clone(),
                task_id: Some(task_id.clone()),
                event_type: "tagRemovedFromTask",
                actor: LifecycleActor::user(),
                summary: format!("Tag +{} removida", tag_name),
                metadata: serde_json::json!({ "tagId": tag_id, "taskId": task_id }),
            },
        )?;
    }

    write_tag_collection_to_document(&mut document, &collection)?;
    write_active_document(&vault, &mut document)?;
    Ok(collection)
}

fn read_tag_collection_from_document(document: &Value) -> Result<TagCollection, String> {
    let tags = document
        .get("tags")
        .cloned()
        .unwrap_or_else(|| Value::Array(Vec::new()));
    let task_tags = document
        .get("taskTags")
        .cloned()
        .unwrap_or_else(|| Value::Array(Vec::new()));

    Ok(TagCollection {
        tags: serde_json::from_value(tags).map_err(|error| error.to_string())?,
        task_tags: serde_json::from_value(task_tags).map_err(|error| error.to_string())?,
    })
}

fn write_tag_collection_to_document(
    document: &mut Value,
    collection: &TagCollection,
) -> Result<(), String> {
    let Some(object) = document.as_object_mut() else {
        return Err("Documento .praxis invalido.".into());
    };

    object.insert(
        "tags".into(),
        serde_json::to_value(&collection.tags).map_err(|error| error.to_string())?,
    );
    object.insert(
        "taskTags".into(),
        serde_json::to_value(&collection.task_tags).map_err(|error| error.to_string())?,
    );

    Ok(())
}

fn ensure_task_exists(document: &Value, task_id: &str) -> Result<(), String> {
    let Some(tasks) = document.get("tasks").and_then(Value::as_array) else {
        return Err("Tarefa nao encontrada.".into());
    };

    if tasks
        .iter()
        .any(|task| task.get("id").and_then(Value::as_str) == Some(task_id))
    {
        Ok(())
    } else {
        Err("Tarefa nao encontrada.".into())
    }
}

fn normalize_name(value: &str) -> Result<String, String> {
    let name = value.trim().trim_start_matches('+').trim();

    if name.is_empty() {
        return Err("Informe o nome da tag.".into());
    }

    Ok(name.to_string())
}

fn normalize_color(value: &str) -> Result<String, String> {
    let color = value.trim();

    if color.len() == 7
        && color.starts_with('#')
        && color.chars().skip(1).all(|char| char.is_ascii_hexdigit())
    {
        Ok(color.to_ascii_lowercase())
    } else {
        Err("Informe uma cor hexadecimal valida.".into())
    }
}

fn unique_slug(tags: &[Tag], name: &str, current_id: Option<&str>) -> String {
    let base = slugify(name);
    let mut slug = base.clone();
    let mut index = 2;

    while tags
        .iter()
        .any(|tag| tag.slug == slug && Some(tag.id.as_str()) != current_id)
    {
        slug = format!("{base}-{index}");
        index += 1;
    }

    slug
}

fn slugify(value: &str) -> String {
    let mut slug = String::new();
    let mut last_was_dash = false;

    for char in value.chars().flat_map(char::to_lowercase) {
        if char.is_ascii_alphanumeric() {
            slug.push(char);
            last_was_dash = false;
        } else if !last_was_dash && !slug.is_empty() {
            slug.push('-');
            last_was_dash = true;
        }
    }

    let slug = slug.trim_matches('-').to_string();

    if slug.is_empty() {
        "tag".into()
    } else {
        slug
    }
}

fn now_iso() -> Result<String, String> {
    time::OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tag(id: &str, slug: &str) -> Tag {
        Tag {
            id: id.into(),
            name: slug.into(),
            slug: slug.into(),
            color: "#ffffff".into(),
            created_at: "2026-06-18T00:00:00Z".into(),
            updated_at: "2026-06-18T00:00:00Z".into(),
        }
    }

    #[test]
    fn normalizes_names_and_colors() {
        assert_eq!(normalize_name("  +Work  ").expect("valid name"), "Work");
        assert_eq!(normalize_color("#EF4444").expect("valid color"), "#ef4444");
        assert!(normalize_name(" + ").is_err());
        assert!(normalize_color("red").is_err());
    }

    #[test]
    fn creates_unique_slugs() {
        let tags = vec![tag("1", "work"), tag("2", "work-2")];

        assert_eq!(unique_slug(&tags, "Work", None), "work-3");
        assert_eq!(unique_slug(&tags, "Work", Some("1")), "work");
    }

    #[test]
    fn slugifies_non_ascii_fallback() {
        assert_eq!(slugify("Client Work!"), "client-work");
        assert_eq!(slugify("🔥"), "tag");
    }
}
