use super::read_records;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashSet;

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PostitGroup {
    pub id: String,
    pub name: String,
    pub revision: u64,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct MemberRevision {
    pub id: String,
    pub revision: u64,
}
#[derive(Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct PostitGroupChange {
    pub id: String,
    pub expected_revision: u64,
    pub name: Option<String>,
    #[serde(default)]
    pub members: Vec<MemberRevision>,
    #[serde(default)]
    pub ungroup: bool,
}
pub fn read_groups(document: &Value) -> Result<Vec<PostitGroup>, String> {
    let groups: Vec<PostitGroup> = match document.get("postitGroups") {
        None => Vec::new(),
        Some(value) => {
            serde_json::from_value(value.clone()).map_err(|_| "Invalid Post-it groups.")?
        }
    };
    let mut ids = HashSet::new();
    if groups.len() > 250
        || groups.iter().any(|g| {
            uuid::Uuid::parse_str(&g.id).is_err()
                || !ids.insert(&g.id)
                || g.name.trim().is_empty()
                || g.name.chars().count() > 100
                || g.revision == 0
        })
    {
        return Err("Invalid Post-it groups.".into());
    }
    Ok(groups)
}
pub fn members<'a>(notes: &'a [super::PostitView], group: &str) -> Vec<&'a super::PostitView> {
    notes
        .iter()
        .filter(|n| n.record.group_id.as_deref() == Some(group) && !n.record.archived)
        .collect()
}
pub fn change_group(document: &mut Value, change: PostitGroupChange) -> Result<(), String> {
    let mut groups = read_groups(document)?;
    let mut notes = read_records(document)?;
    let index = groups.iter().position(|g| g.id == change.id);
    if index.map(|i| groups[i].revision).unwrap_or(0) != change.expected_revision {
        return Err("A pilha mudou. Atualize e tente novamente.".into());
    }
    if change.ungroup {
        if index.is_none() {
            return Err("Pilha indisponivel.".into());
        }
        for note in &mut notes {
            if note.group_id.as_deref() == Some(&change.id) {
                note.group_id = None;
                note.revision += 1;
            }
        }
        groups.retain(|g| g.id != change.id);
    } else {
        uuid::Uuid::parse_str(&change.id).map_err(|_| "Invalid group id.")?;
        let name = change
            .name
            .ok_or("Informe o nome da pilha.")?
            .trim()
            .to_string();
        if name.is_empty() || name.chars().count() > 100 {
            return Err("Nome de pilha invalido.".into());
        }
        let mut ids = HashSet::new();
        if index.is_none() && change.members.len() < 2 {
            return Err("Selecione ao menos duas notas.".into());
        }
        for member in &change.members {
            if !ids.insert(&member.id) {
                return Err("Nota duplicada.".into());
            }
            let note = notes
                .iter()
                .find(|n| n.id == member.id && !n.archived)
                .ok_or("Nota indisponivel.")?;
            if note.revision != member.revision {
                return Err("Uma nota mudou. Atualize e tente novamente.".into());
            }
            if note.group_id.as_ref().is_some_and(|id| id != &change.id) {
                return Err("Desagrupe a nota antes de move-la.".into());
            }
        }
        if let Some(i) = index {
            groups[i].name = name;
            groups[i].revision += 1;
        } else {
            if groups.len() >= 250 {
                return Err("Limite de pilhas atingido.".into());
            }
            groups.push(PostitGroup {
                id: change.id.clone(),
                name,
                revision: 1,
            });
        }
        for note in &mut notes {
            if ids.contains(&note.id) {
                note.group_id = Some(change.id.clone());
                note.revision += 1;
            }
        }
    }
    document["desktopPostits"] = serde_json::to_value(notes).map_err(|e| e.to_string())?;
    document["postitGroups"] = serde_json::to_value(groups).map_err(|e| e.to_string())?;
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    #[test]
    fn grouping_is_atomic_and_ungroup_preserves_content_and_preferences() {
        let id = "6f58601a-0e76-449a-8aa3-fcb11356edd1";
        let mut doc = json!({"desktopPostits":[
          {"id":"one","title":"One","body":"Body","revision":1,"pinned":true,"collapsed":true,"archived":false,"color":"pink"},
          {"id":"two","title":"Two","body":"Text","revision":4,"pinned":false,"collapsed":false,"archived":false,"color":"blue"}]});
        let before = doc.clone();
        let input = |revision| PostitGroupChange {
            id: id.into(),
            expected_revision: 0,
            name: Some("Ideas".into()),
            members: vec![
                MemberRevision {
                    id: "one".into(),
                    revision,
                },
                MemberRevision {
                    id: "two".into(),
                    revision: 4,
                },
            ],
            ungroup: false,
        };
        assert!(change_group(&mut doc, input(0)).is_err());
        assert_eq!(doc, before);
        change_group(&mut doc, input(1)).unwrap();
        assert_eq!(read_records(&doc).unwrap()[0].group_id.as_deref(), Some(id));
        change_group(
            &mut doc,
            PostitGroupChange {
                id: id.into(),
                expected_revision: 1,
                name: None,
                members: vec![],
                ungroup: true,
            },
        )
        .unwrap();
        let notes = read_records(&doc).unwrap();
        assert!(notes.iter().all(|n| n.group_id.is_none()));
        assert_eq!(notes[0].body, "Body");
        assert_eq!(notes[0].color, "pink");
        assert!(!notes[1].pinned);
    }
}
