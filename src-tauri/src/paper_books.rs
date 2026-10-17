use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;
use uuid::Uuid;

use crate::vault::{mutate_active_document, read_active_document, VaultStore};

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PaperBook {
    pub id: String,
    pub name: String,
    pub revision: u64,
    pub paper_ids: Vec<String>,
}

#[derive(Deserialize)]
#[serde(tag = "type", rename_all = "camelCase", deny_unknown_fields)]
pub enum BookChange {
    Create {
        name: String,
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
    Move {
        #[serde(rename = "paperId")]
        paper_id: String,
        #[serde(rename = "bookId")]
        book_id: Option<String>,
        #[serde(rename = "expectedBookId")]
        expected_book_id: Option<String>,
    },
}

fn read_books(document: &Value) -> Result<Vec<PaperBook>, String> {
    let mut books: Vec<PaperBook> = match document.get("paperBooks") {
        None => Vec::new(),
        Some(value) => serde_json::from_value(value.clone())
            .map_err(|_| "Cadernos invalidos no cofre.".to_string())?,
    };
    let papers: HashSet<&str> = document
        .get("boards")
        .and_then(Value::as_array)
        .into_iter()
        .flatten()
        .filter_map(|paper| paper["id"].as_str())
        .collect();
    for book in &mut books {
        book.paper_ids.retain(|id| papers.contains(id.as_str()));
    }
    Ok(books)
}

fn valid_name(name: &str, books: &[PaperBook], except: Option<&str>) -> Result<String, String> {
    let name = name.trim();
    if name.is_empty() || name.chars().count() > 80 || name.chars().any(char::is_control) {
        return Err("Use um nome de 1 a 80 caracteres.".into());
    }
    if books.iter().any(|book| {
        Some(book.id.as_str()) != except && book.name.to_lowercase() == name.to_lowercase()
    }) {
        return Err("Ja existe um caderno com esse nome.".into());
    }
    Ok(name.to_string())
}

fn change_books(document: &mut Value, change: BookChange) -> Result<Vec<PaperBook>, String> {
    let mut books = read_books(document)?;
    match change {
        BookChange::Create { name } => {
            let name = valid_name(&name, &books, None)?;
            books.push(PaperBook {
                id: Uuid::new_v4().to_string(),
                name,
                revision: 1,
                paper_ids: Vec::new(),
            });
        }
        BookChange::Rename { id, revision, name } => {
            let name = valid_name(&name, &books, Some(&id))?;
            let book = books
                .iter_mut()
                .find(|book| book.id == id)
                .ok_or("Caderno nao encontrado.")?;
            if book.revision != revision {
                return Err("O caderno mudou. Atualize a biblioteca.".into());
            }
            book.name = name;
            book.revision += 1;
        }
        BookChange::Remove { id, revision } => {
            let book = books
                .iter()
                .find(|book| book.id == id)
                .ok_or("Caderno nao encontrado.")?;
            if book.revision != revision {
                return Err("O caderno mudou. Atualize a biblioteca.".into());
            }
            books.retain(|book| book.id != id);
        }
        BookChange::Move {
            paper_id,
            book_id,
            expected_book_id,
        } => {
            if !document
                .get("boards")
                .and_then(Value::as_array)
                .is_some_and(|items| {
                    items
                        .iter()
                        .any(|paper| paper["id"].as_str() == Some(paper_id.as_str()))
                })
            {
                return Err("Paper nao encontrado.".into());
            }
            if book_id
                .as_ref()
                .is_some_and(|id| !books.iter().any(|book| &book.id == id))
            {
                return Err("Caderno nao encontrado.".into());
            }
            let current = books
                .iter()
                .find(|book| book.paper_ids.contains(&paper_id))
                .map(|book| book.id.clone());
            if current != expected_book_id {
                return Err("O Paper foi movido. Atualize a biblioteca.".into());
            }
            if current == book_id {
                return Ok(books);
            }
            for book in &mut books {
                if Some(&book.id) == current.as_ref() {
                    book.paper_ids.retain(|id| id != &paper_id);
                    book.revision += 1;
                }
                if Some(&book.id) == book_id.as_ref() {
                    book.paper_ids.push(paper_id.clone());
                    book.revision += 1;
                }
            }
        }
    }
    document["paperBooks"] = serde_json::to_value(&books).map_err(|error| error.to_string())?;
    Ok(books)
}

#[tauri::command]
pub fn list_paper_books(vault: tauri::State<'_, VaultStore>) -> Result<Vec<PaperBook>, String> {
    read_books(&read_active_document(&vault)?)
}

#[tauri::command]
pub fn change_paper_books(
    vault: tauri::State<'_, VaultStore>,
    change: BookChange,
) -> Result<Vec<PaperBook>, String> {
    mutate_active_document(&vault, |document| change_books(document, change))
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn old_vaults_need_no_migration_or_write() {
        let document = json!({"boards": []});
        assert!(read_books(&document).unwrap().is_empty());
        assert!(document.get("paperBooks").is_none());
    }

    #[test]
    fn move_and_remove_preserve_paper_content() {
        let mut document = json!({"boards": [{"id":"p", "elements":[{"text":"idea"}]}]});
        let original = document["boards"].clone();
        let books = change_books(
            &mut document,
            BookChange::Create {
                name: "Projeto".into(),
            },
        )
        .unwrap();
        let id = books[0].id.clone();
        let books = change_books(
            &mut document,
            BookChange::Move {
                paper_id: "p".into(),
                book_id: Some(id.clone()),
                expected_book_id: None,
            },
        )
        .unwrap();
        assert_eq!(books[0].paper_ids, vec!["p"]);
        assert!(change_books(
            &mut document,
            BookChange::Move {
                paper_id: "p".into(),
                book_id: None,
                expected_book_id: None
            }
        )
        .is_err());
        assert!(change_books(
            &mut document,
            BookChange::Remove {
                id: id.clone(),
                revision: 1
            }
        )
        .is_err());
        assert!(change_books(
            &mut document,
            BookChange::Remove {
                id,
                revision: books[0].revision
            }
        )
        .unwrap()
        .is_empty());
        assert_eq!(document["boards"], original);
    }

    #[test]
    fn names_and_destinations_are_validated_atomically() {
        let mut document = json!({"boards": [{"id":"p"}]});
        change_books(
            &mut document,
            BookChange::Create {
                name: "  Estudos  ".into(),
            },
        )
        .unwrap();
        let original = document.clone();
        for name in ["", "ESTUDOS", "a\nb"] {
            assert!(change_books(&mut document, BookChange::Create { name: name.into() }).is_err());
            assert_eq!(document, original);
        }
        assert!(change_books(
            &mut document,
            BookChange::Move {
                paper_id: "p".into(),
                book_id: Some("missing".into()),
                expected_book_id: None
            }
        )
        .is_err());
        assert_eq!(document, original);
    }
}
