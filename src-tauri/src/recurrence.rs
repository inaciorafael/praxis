use serde::{Deserialize, Serialize};
use serde_json::Value;
use time::{Date, Month, OffsetDateTime};
use uuid::Uuid;

use crate::tasks::{Task, TaskStatus};

const MAX_GENERATED_OCCURRENCES_PER_RUN: usize = 370;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub enum RecurrenceFrequency {
    Weekly,
    Monthly,
    Yearly,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurrenceRule {
    id: String,
    title: String,
    #[serde(default)]
    notes: Option<String>,
    frequency: RecurrenceFrequency,
    interval: u32,
    starts_on: String,
    ends_on: Option<String>,
    notify: bool,
    reminder_time: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateRecurrenceRuleInput {
    title: String,
    notes: Option<String>,
    frequency: RecurrenceFrequency,
    interval: Option<u32>,
    starts_on: String,
    ends_on: Option<String>,
    notify: bool,
    reminder_time: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRecurrenceRuleInput {
    title: Option<String>,
    #[serde(default)]
    notes: Option<Option<String>>,
    frequency: Option<RecurrenceFrequency>,
    interval: Option<u32>,
    starts_on: Option<String>,
    #[serde(default)]
    ends_on: Option<Option<String>>,
    notify: Option<bool>,
    #[serde(default)]
    reminder_time: Option<Option<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecurrenceCollection {
    recurrence_rules: Vec<RecurrenceRule>,
}

#[tauri::command]
pub fn list_recurrence_rules(
    vault: tauri::State<'_, crate::vault::VaultStore>,
) -> Result<RecurrenceCollection, String> {
    let document = crate::vault::read_active_document(&vault)?;

    Ok(RecurrenceCollection {
        recurrence_rules: read_recurrence_rules_from_document(&document)?,
    })
}

#[tauri::command]
pub fn create_recurrence_rule(
    vault: tauri::State<'_, crate::vault::VaultStore>,
    input: CreateRecurrenceRuleInput,
) -> Result<RecurrenceCollection, String> {
    let mut document = crate::vault::read_active_document(&vault)?;
    let mut rules = read_recurrence_rules_from_document(&document)?;
    let now = now_iso()?;
    let title = normalize_required_text(&input.title, "Informe o titulo da recorrencia.")?;
    let starts_on = normalize_date(&input.starts_on, "Data inicial invalida.")?;
    let ends_on = normalize_optional_date(input.ends_on, "Data final invalida.")?;

    if let Some(ends_on) = ends_on.as_deref() {
        if ends_on < starts_on.as_str() {
            return Err("A data final precisa ser igual ou posterior a data inicial.".into());
        }
    }

    rules.push(RecurrenceRule {
        id: Uuid::new_v4().to_string(),
        title,
        notes: normalize_optional_text(input.notes),
        frequency: input.frequency,
        interval: normalize_interval(input.interval)?,
        starts_on,
        ends_on,
        notify: input.notify,
        reminder_time: normalize_optional_time(input.reminder_time)?,
        created_at: now.clone(),
        updated_at: now,
    });

    write_recurrence_rules_to_document(&mut document, &rules)?;
    crate::vault::write_active_document(&vault, &mut document)?;

    Ok(RecurrenceCollection {
        recurrence_rules: rules,
    })
}

#[tauri::command]
pub fn update_recurrence_rule(
    vault: tauri::State<'_, crate::vault::VaultStore>,
    id: String,
    input: UpdateRecurrenceRuleInput,
) -> Result<RecurrenceCollection, String> {
    let mut document = crate::vault::read_active_document(&vault)?;
    let mut rules = read_recurrence_rules_from_document(&document)?;
    let rule = rules
        .iter_mut()
        .find(|rule| rule.id == id)
        .ok_or_else(|| "Recorrencia nao encontrada.".to_string())?;

    if let Some(title) = input.title {
        rule.title = normalize_required_text(&title, "Informe o titulo da recorrencia.")?;
    }

    if let Some(notes) = input.notes {
        rule.notes = normalize_optional_text(notes);
    }

    if let Some(frequency) = input.frequency {
        rule.frequency = frequency;
    }

    if let Some(interval) = input.interval {
        rule.interval = normalize_interval(Some(interval))?;
    }

    if let Some(starts_on) = input.starts_on {
        rule.starts_on = normalize_date(&starts_on, "Data inicial invalida.")?;
    }

    if let Some(ends_on) = input.ends_on {
        rule.ends_on = normalize_optional_date(ends_on, "Data final invalida.")?;
    }

    if let Some(ends_on) = rule.ends_on.as_deref() {
        if ends_on < rule.starts_on.as_str() {
            return Err("A data final precisa ser igual ou posterior a data inicial.".into());
        }
    }

    if let Some(notify) = input.notify {
        rule.notify = notify;
    }

    if let Some(reminder_time) = input.reminder_time {
        rule.reminder_time = normalize_optional_time(reminder_time)?;
    }

    rule.updated_at = now_iso()?;

    write_recurrence_rules_to_document(&mut document, &rules)?;
    crate::vault::write_active_document(&vault, &mut document)?;

    Ok(RecurrenceCollection {
        recurrence_rules: rules,
    })
}

#[tauri::command]
pub fn delete_recurrence_rule(
    vault: tauri::State<'_, crate::vault::VaultStore>,
    id: String,
) -> Result<RecurrenceCollection, String> {
    let mut document = crate::vault::read_active_document(&vault)?;
    let mut rules = read_recurrence_rules_from_document(&document)?;
    let original_len = rules.len();

    rules.retain(|rule| rule.id != id);

    if rules.len() == original_len {
        return Err("Recorrencia nao encontrada.".into());
    }

    write_recurrence_rules_to_document(&mut document, &rules)?;
    crate::vault::write_active_document(&vault, &mut document)?;

    Ok(RecurrenceCollection {
        recurrence_rules: rules,
    })
}

pub fn generate_due_tasks_in_document(
    document: &mut Value,
    tasks: &mut Vec<Task>,
    today: &str,
) -> Result<usize, String> {
    let rules = read_recurrence_rules_from_document(document)?;
    let today = parse_date(today, "Data atual invalida.")?;
    let now = now_iso()?;
    let mut generated = 0;

    for rule in rules {
        let mut occurrence_date = parse_date(&rule.starts_on, "Data inicial invalida.")?;
        let ends_on = rule
            .ends_on
            .as_deref()
            .map(|value| parse_date(value, "Data final invalida."))
            .transpose()?;

        while occurrence_date <= today && generated < MAX_GENERATED_OCCURRENCES_PER_RUN {
            if ends_on.is_some_and(|ends_on| occurrence_date > ends_on) {
                break;
            }

            let occurrence = occurrence_date.to_string();

            if !tasks.iter().any(|task| {
                task.recurrence_id.as_deref() == Some(rule.id.as_str())
                    && task.occurrence_date.as_deref() == Some(occurrence.as_str())
            }) {
                tasks.push(task_from_rule(&rule, &occurrence, &now));
                generated += 1;
            }

            occurrence_date = next_occurrence_date(occurrence_date, &rule)?;
        }
    }

    Ok(generated)
}

pub fn read_recurrence_rules_from_document(
    document: &Value,
) -> Result<Vec<RecurrenceRule>, String> {
    let rules = document
        .get("recurrenceRules")
        .cloned()
        .unwrap_or_else(|| Value::Array(Vec::new()));

    serde_json::from_value(rules).map_err(|error| error.to_string())
}

fn write_recurrence_rules_to_document(
    document: &mut Value,
    rules: &[RecurrenceRule],
) -> Result<(), String> {
    let Some(object) = document.as_object_mut() else {
        return Err("Documento .praxis invalido.".into());
    };

    object.insert(
        "recurrenceRules".into(),
        serde_json::to_value(rules).map_err(|error| error.to_string())?,
    );

    Ok(())
}

fn task_from_rule(rule: &RecurrenceRule, occurrence_date: &str, now: &str) -> Task {
    Task {
        id: Uuid::new_v4().to_string(),
        title: rule.title.clone(),
        notes: rule.notes.clone(),
        status: TaskStatus::Pending,
        planned_for: Some(occurrence_date.to_string()),
        due_at: None,
        reminder_at: reminder_at_for_occurrence(rule, occurrence_date),
        recurrence_id: Some(rule.id.clone()),
        occurrence_date: Some(occurrence_date.to_string()),
        completed_at: None,
        created_at: now.to_string(),
        updated_at: now.to_string(),
    }
}

fn reminder_at_for_occurrence(rule: &RecurrenceRule, occurrence_date: &str) -> Option<String> {
    if !rule.notify {
        return None;
    }

    rule.reminder_time
        .as_deref()
        .map(|time| format!("{occurrence_date}T{time}:00"))
}

fn next_occurrence_date(current: Date, rule: &RecurrenceRule) -> Result<Date, String> {
    match rule.frequency {
        RecurrenceFrequency::Weekly => current
            .checked_add(time::Duration::weeks(i64::from(rule.interval)))
            .ok_or_else(|| "Nao foi possivel calcular a proxima recorrencia.".into()),
        RecurrenceFrequency::Monthly => add_months(current, rule.interval),
        RecurrenceFrequency::Yearly => add_months(current, rule.interval * 12),
    }
}

fn add_months(current: Date, months: u32) -> Result<Date, String> {
    let total_months = current.year() * 12 + i32::from(current.month() as u8) - 1 + months as i32;
    let year = total_months.div_euclid(12);
    let month_number = total_months.rem_euclid(12) + 1;
    let month = Month::try_from(month_number as u8).map_err(|error| error.to_string())?;
    let day = current.day().min(days_in_month(year, month));

    Date::from_calendar_date(year, month, day).map_err(|error| error.to_string())
}

fn days_in_month(year: i32, month: Month) -> u8 {
    let next_month = if month == Month::December {
        Date::from_calendar_date(year + 1, Month::January, 1)
    } else {
        Date::from_calendar_date(
            year,
            Month::try_from(month as u8 + 1).expect("valid month"),
            1,
        )
    }
    .expect("valid first day");

    (next_month - time::Duration::days(1)).day()
}

fn normalize_required_text(value: &str, error: &str) -> Result<String, String> {
    let value = value.trim();

    if value.is_empty() {
        Err(error.into())
    } else {
        Ok(value.to_string())
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

fn normalize_interval(value: Option<u32>) -> Result<u32, String> {
    let interval = value.unwrap_or(1);

    if interval == 0 {
        Err("O intervalo da recorrencia precisa ser maior que zero.".into())
    } else {
        Ok(interval)
    }
}

fn normalize_date(value: &str, error: &str) -> Result<String, String> {
    parse_date(value, error).map(|date| date.to_string())
}

fn normalize_optional_date(value: Option<String>, error: &str) -> Result<Option<String>, String> {
    value.map(|value| normalize_date(&value, error)).transpose()
}

fn normalize_optional_time(value: Option<String>) -> Result<Option<String>, String> {
    let Some(value) = normalize_optional_text(value) else {
        return Ok(None);
    };

    let mut parts = value.split(':');
    let hour = parts
        .next()
        .and_then(|value| value.parse::<u8>().ok())
        .ok_or_else(|| "Horario de lembrete invalido.".to_string())?;
    let minute = parts
        .next()
        .and_then(|value| value.parse::<u8>().ok())
        .ok_or_else(|| "Horario de lembrete invalido.".to_string())?;

    if parts.next().is_some() || hour > 23 || minute > 59 {
        return Err("Horario de lembrete invalido.".into());
    }

    Ok(Some(format!("{hour:02}:{minute:02}")))
}

fn parse_date(value: &str, error: &str) -> Result<Date, String> {
    let date = value.trim().get(0..10).ok_or_else(|| error.to_string())?;
    let mut parts = date.split('-');
    let year = parts
        .next()
        .and_then(|value| value.parse::<i32>().ok())
        .ok_or_else(|| error.to_string())?;
    let month = parts
        .next()
        .and_then(|value| value.parse::<u8>().ok())
        .and_then(|value| Month::try_from(value).ok())
        .ok_or_else(|| error.to_string())?;
    let day = parts
        .next()
        .and_then(|value| value.parse::<u8>().ok())
        .ok_or_else(|| error.to_string())?;

    if parts.next().is_some() {
        return Err(error.into());
    }

    Date::from_calendar_date(year, month, day).map_err(|_| error.to_string())
}

fn now_iso() -> Result<String, String> {
    OffsetDateTime::now_utc()
        .format(&time::format_description::well_known::Rfc3339)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn generates_due_weekly_occurrences_without_duplicates() {
        let mut document = json!({
            "recurrenceRules": [{
                "id": "rule-weekly",
                "title": "Review metrics",
                "notes": "Weekly ritual",
                "frequency": "weekly",
                "interval": 1,
                "startsOn": "2026-06-01",
                "endsOn": null,
                "notify": false,
                "reminderTime": null,
                "createdAt": "2026-06-01T00:00:00Z",
                "updatedAt": "2026-06-01T00:00:00Z"
            }]
        });
        let mut tasks = Vec::new();

        let generated = generate_due_tasks_in_document(&mut document, &mut tasks, "2026-06-15")
            .expect("weekly recurrence should generate");
        let generated_again =
            generate_due_tasks_in_document(&mut document, &mut tasks, "2026-06-15")
                .expect("weekly recurrence should be idempotent");

        assert_eq!(generated, 3);
        assert_eq!(generated_again, 0);
        assert_eq!(tasks.len(), 3);
        assert_eq!(
            tasks
                .iter()
                .map(|task| task.occurrence_date.as_deref().unwrap())
                .collect::<Vec<_>>(),
            vec!["2026-06-01", "2026-06-08", "2026-06-15"]
        );
    }

    #[test]
    fn clamps_monthly_occurrence_to_valid_month_end() {
        let mut document = json!({
            "recurrenceRules": [{
                "id": "rule-monthly",
                "title": "Close books",
                "notes": null,
                "frequency": "monthly",
                "interval": 1,
                "startsOn": "2026-01-31",
                "endsOn": null,
                "notify": false,
                "reminderTime": null,
                "createdAt": "2026-01-01T00:00:00Z",
                "updatedAt": "2026-01-01T00:00:00Z"
            }]
        });
        let mut tasks = Vec::new();

        generate_due_tasks_in_document(&mut document, &mut tasks, "2026-03-31")
            .expect("monthly recurrence should generate");

        assert_eq!(
            tasks
                .iter()
                .map(|task| task.occurrence_date.as_deref().unwrap())
                .collect::<Vec<_>>(),
            vec!["2026-01-31", "2026-02-28", "2026-03-28"]
        );
    }

    #[test]
    fn generated_occurrence_uses_recurring_reminder_time() {
        let mut document = json!({
            "recurrenceRules": [{
                "id": "rule-notify",
                "title": "Pay invoice",
                "notes": null,
                "frequency": "yearly",
                "interval": 1,
                "startsOn": "2026-06-18",
                "endsOn": null,
                "notify": true,
                "reminderTime": "09:30",
                "createdAt": "2026-01-01T00:00:00Z",
                "updatedAt": "2026-01-01T00:00:00Z"
            }]
        });
        let mut tasks = Vec::new();

        generate_due_tasks_in_document(&mut document, &mut tasks, "2026-06-18")
            .expect("notified recurrence should generate");

        assert_eq!(tasks.len(), 1);
        assert_eq!(tasks[0].reminder_at.as_deref(), Some("2026-06-18T09:30:00"));
        assert_eq!(tasks[0].recurrence_id.as_deref(), Some("rule-notify"));
        assert_eq!(tasks[0].planned_for.as_deref(), Some("2026-06-18"));
    }

    #[test]
    fn rejects_invalid_interval_and_time() {
        assert!(normalize_interval(Some(0)).is_err());
        assert!(normalize_optional_time(Some("25:00".into())).is_err());
        assert_eq!(
            normalize_optional_time(Some("9:5".into())).expect("time should normalize"),
            Some("09:05".into())
        );
    }
}
