use crate::{
    boards::{validate_board, Board, BoardElement},
    vault::{mutate_active_document, read_active_document, VaultStore},
};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

#[derive(Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct LibraryItem {
    pub id: String,
    pub name: String,
    pub revision: u64,
    pub elements: Vec<BoardElement>,
}
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LibrarySummary {
    id: String,
    name: String,
    revision: u64,
    element_count: usize,
}
impl LibraryItem {
    fn summary(&self) -> LibrarySummary {
        LibrarySummary {
            id: self.id.clone(),
            name: self.name.clone(),
            revision: self.revision,
            element_count: self.elements.len(),
        }
    }
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", deny_unknown_fields)]
pub enum LibraryChange {
    Add {
        id: String,
        name: String,
        elements: Vec<BoardElement>,
    },
    Rename {
        id: String,
        revision: u64,
        name: String,
    },
    Remove {
        id: String,
        revision: u64,
    },
}
fn name(value: &str) -> Result<String, String> {
    let value = value.trim();
    if value.is_empty() || value.chars().count() > 80 || value.chars().any(char::is_control) {
        return Err("Use um nome de 1 a 80 caracteres.".into());
    }
    Ok(value.into())
}
fn read(document: &Value) -> Result<Vec<LibraryItem>, String> {
    match document.get("paperLibrary") {
        None => Ok(vec![]),
        Some(value) => serde_json::from_value(value.clone())
            .map_err(|_| "Biblioteca invalida no cofre.".into()),
    }
}
fn validate(item: &LibraryItem) -> Result<(), String> {
    name(&item.name)?;
    if item.elements.is_empty() || item.elements.len() > 500 {
        return Err("Salve de 1 a 500 elementos por componente.".into());
    }
    if item.elements.iter().any(|e| {
        e.task_id.is_some()
            || e.kind == "iframe"
            || e.layer_id.as_deref().is_some_and(|id| id != "base")
    }) {
        return Err("O componente deve ser uma copia independente, sem vinculos externos.".into());
    }
    let board:Board=serde_json::from_value(json!({"id":item.id,"title":item.name,"revision":item.revision,"formatVersion":1,"createdAt":"","updatedAt":"","elements":item.elements}))
        .map_err(|e|e.to_string())?;
    validate_board(&board)?;
    if serde_json::to_vec(item).map_err(|e| e.to_string())?.len() > 2 * 1024 * 1024 {
        return Err("Componente excede 2 MiB.".into());
    }
    Ok(())
}
fn change(document: &mut Value, change: LibraryChange) -> Result<Vec<LibrarySummary>, String> {
    let mut items = read(document)?;
    match change {
        LibraryChange::Add {
            id,
            name: label,
            elements,
        } => {
            let item = LibraryItem {
                id,
                name: name(&label)?,
                revision: 1,
                elements,
            };
            validate(&item)?;
            if let Some(old) = items.iter().find(|e| e.id == item.id) {
                if old == &item {
                    return Ok(items.iter().map(LibraryItem::summary).collect());
                }
                return Err("Identificador de componente ja utilizado.".into());
            }
            if items.len() >= 100 {
                return Err("Limite de 100 componentes na biblioteca.".into());
            }
            items.push(item);
        }
        LibraryChange::Rename {
            id,
            revision,
            name: label,
        } => {
            let item = items
                .iter_mut()
                .find(|e| e.id == id)
                .ok_or("Componente nao encontrado.")?;
            if item.revision != revision {
                return Err("O componente mudou. Atualize a biblioteca.".into());
            }
            let label = name(&label)?;
            if item.name == label {
                return Ok(items.iter().map(LibraryItem::summary).collect());
            }
            item.name = label;
            item.revision += 1;
        }
        LibraryChange::Remove { id, revision } => {
            let item = items
                .iter()
                .find(|e| e.id == id)
                .ok_or("Componente nao encontrado.")?;
            if item.revision != revision {
                return Err("O componente mudou. Atualize a biblioteca.".into());
            }
            items.retain(|e| e.id != id);
        }
    }
    let value = serde_json::to_value(&items).map_err(|e| e.to_string())?;
    if serde_json::to_vec(&value).map_err(|e| e.to_string())?.len() > 20 * 1024 * 1024 {
        return Err("Biblioteca excede 20 MiB.".into());
    }
    document["paperLibrary"] = value;
    Ok(items.iter().map(LibraryItem::summary).collect())
}
#[tauri::command]
pub fn list_paper_library(
    vault: tauri::State<'_, VaultStore>,
) -> Result<Vec<LibrarySummary>, String> {
    Ok(read(&read_active_document(&vault)?)?
        .iter()
        .map(LibraryItem::summary)
        .collect())
}
#[tauri::command]
pub fn get_paper_library_item(
    vault: tauri::State<'_, VaultStore>,
    id: String,
) -> Result<LibraryItem, String> {
    let item = read(&read_active_document(&vault)?)?
        .into_iter()
        .find(|e| e.id == id)
        .ok_or("Componente nao encontrado.")?;
    validate(&item)?;
    Ok(item)
}
#[tauri::command]
pub fn change_paper_library(
    vault: tauri::State<'_, VaultStore>,
    change: LibraryChange,
) -> Result<Vec<LibrarySummary>, String> {
    mutate_active_document(&vault, |document| self::change(document, change))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn elements() -> Vec<BoardElement> {
        serde_json::from_value(json!([{"id":"shape","kind":"rectangle","x":0,"y":0,"width":100,"height":80,"text":"Idea","color":"neutral","resolved":false,"points":[],"startId":null,"endId":null,"taskId":null,"imageData":null}])).unwrap()
    }
    #[test]
    fn old_vaults_are_read_only_and_changes_are_independent() {
        let mut doc = json!({"boards":[{"id":"paper"}],"tasks":[]});
        let original = doc.clone();
        assert!(read(&doc).unwrap().is_empty());
        assert_eq!(doc, original);
        let add = || LibraryChange::Add {
            id: "component".into(),
            name: "Card".into(),
            elements: elements(),
        };
        change(&mut doc, add()).unwrap();
        let saved = doc.clone();
        change(&mut doc, add()).unwrap();
        assert_eq!(doc, saved);
        assert!(change(
            &mut doc,
            LibraryChange::Remove {
                id: "component".into(),
                revision: 8
            }
        )
        .is_err());
        assert_eq!(doc, saved);
        change(
            &mut doc,
            LibraryChange::Rename {
                id: "component".into(),
                revision: 1,
                name: "Wireframe".into(),
            },
        )
        .unwrap();
        change(
            &mut doc,
            LibraryChange::Remove {
                id: "component".into(),
                revision: 2,
            },
        )
        .unwrap();
        assert_eq!(doc["boards"], original["boards"]);
        assert_eq!(doc["tasks"], original["tasks"]);
    }
    #[test]
    fn invalid_payloads_never_mutate_the_document() {
        for mode in 0..4 {
            let mut doc = json!({});
            let mut es = elements();
            match mode {
                0 => es.clear(),
                1 => es[0].task_id = Some("task".into()),
                2 => es[0].start_id = Some("missing".into()),
                _ => es[0].width = -5.0,
            };
            assert!(change(
                &mut doc,
                LibraryChange::Add {
                    id: "component".into(),
                    name: "Card".into(),
                    elements: es
                }
            )
            .is_err());
            assert_eq!(doc, json!({}));
        }
    }
}
