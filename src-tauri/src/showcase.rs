use serde_json::{json, Value};
use tauri::AppHandle;
use time::{Date, Duration, OffsetDateTime, UtcOffset};

use crate::{
    badge::BadgeStore,
    checklist::{ChecklistItem, ChecklistItemStatus},
    native_reminders, reminders,
    tasks::{self, Task, TaskCollection, TaskStatus},
    vault::{read_active_document, write_active_document, VaultStore},
};

#[tauri::command]
pub fn seed_showcase_data(
    app: AppHandle,
    vault: tauri::State<'_, VaultStore>,
    badge_state: tauri::State<'_, BadgeStore>,
    today: String,
) -> Result<TaskCollection, String> {
    let today_date = parse_date(&today)?;
    let now = OffsetDateTime::now_utc();
    let now_iso = format_rfc3339(now)?;
    let offset = UtcOffset::current_local_offset().unwrap_or(UtcOffset::UTC);

    let recurrence_id = "showcase-recurrence-weekly-review";
    let mut tasks = vec![
        task(
            "showcase-today-focus",
            "Finalizar proposta comercial",
            Some("Revisar valores, anexar PDF e enviar antes da reuniao."),
            TaskStatus::Pending,
            Some(date(today_date)),
            Some(at_local(today_date, 10, 0, offset)?),
            Some(at_local(today_date, 9, 45, offset)?),
            None,
            past_iso(now, 2)?,
            now_iso.clone(),
            None,
            None,
        ),
        task(
            "showcase-today-checklist",
            "Preparar demo do Praxis",
            Some("Checklist curto para mostrar progresso visual dentro da task."),
            TaskStatus::Pending,
            Some(date(today_date)),
            Some(at_local(today_date, 16, 0, offset)?),
            Some(at_local(today_date, 15, 30, offset)?),
            None,
            past_iso(now, 1)?,
            now_iso.clone(),
            None,
            None,
        ),
        task(
            "showcase-today-admin",
            "Organizar caixa de entrada",
            Some("Separar o que vira tarefa e arquivar o restante."),
            TaskStatus::Pending,
            Some(date(today_date)),
            None,
            None,
            None,
            past_iso(now, 3)?,
            now_iso.clone(),
            None,
            None,
        ),
        task(
            "showcase-overdue-contract",
            "Assinar contrato do fornecedor",
            Some("Pendente desde ontem. Deve aparecer como vencida e puxar atencao."),
            TaskStatus::Pending,
            None,
            Some(at_local(today_date - Duration::days(1), 17, 30, offset)?),
            Some(at_local(today_date - Duration::days(1), 16, 45, offset)?),
            None,
            past_iso(now, 5)?,
            now_iso.clone(),
            None,
            None,
        ),
        task(
            "showcase-overdue-invoice",
            "Conferir boleto do escritorio",
            Some("Exemplo de vencimento antigo sem checklist."),
            TaskStatus::Pending,
            None,
            Some(at_local(today_date - Duration::days(3), 12, 0, offset)?),
            None,
            None,
            past_iso(now, 7)?,
            now_iso.clone(),
            None,
            None,
        ),
        task(
            "showcase-week-tomorrow",
            "Reuniao de planejamento semanal",
            Some("Primeira task da visao Minha Semana, com vencimento amanha."),
            TaskStatus::Pending,
            None,
            Some(at_local(today_date + Duration::days(1), 9, 0, offset)?),
            Some(at_local(today_date + Duration::days(1), 8, 30, offset)?),
            None,
            past_iso(now, 1)?,
            now_iso.clone(),
            None,
            None,
        ),
        task(
            "showcase-week-design",
            "Revisar interface do cofre",
            Some("Validar contraste e sensacao e-ink antes dos prints."),
            TaskStatus::Pending,
            Some(date(today_date + Duration::days(1))),
            Some(at_local(today_date + Duration::days(1), 11, 0, offset)?),
            None,
            None,
            past_iso(now, 2)?,
            now_iso.clone(),
            None,
            None,
        ),
        task(
            "showcase-week-release",
            "Gerar instalador assinado",
            Some("Fluxo tecnico para mostrar que o app tambem cuida do produto."),
            TaskStatus::Pending,
            None,
            Some(at_local(today_date + Duration::days(2), 15, 0, offset)?),
            Some(at_local(today_date + Duration::days(2), 14, 30, offset)?),
            None,
            past_iso(now, 2)?,
            now_iso.clone(),
            None,
            None,
        ),
        task(
            "showcase-week-report",
            "Enviar resumo da semana",
            Some("Task sem lembrete, apenas vencimento."),
            TaskStatus::Pending,
            None,
            Some(at_local(today_date + Duration::days(4), 18, 0, offset)?),
            None,
            None,
            past_iso(now, 4)?,
            now_iso.clone(),
            None,
            None,
        ),
        task(
            "showcase-week-health",
            "Marcar exame anual",
            Some("Exemplo pessoal simples dentro da mesma semana."),
            TaskStatus::Pending,
            Some(date(today_date + Duration::days(5))),
            None,
            None,
            None,
            past_iso(now, 6)?,
            now_iso.clone(),
            None,
            None,
        ),
        task(
            "showcase-recurring-weekly",
            "Revisao semanal do backlog",
            Some("Ocorrencia gerada por uma recorrencia semanal."),
            TaskStatus::Pending,
            None,
            Some(at_local(today_date + Duration::days(6), 10, 0, offset)?),
            Some(at_local(today_date + Duration::days(6), 9, 30, offset)?),
            None,
            past_iso(now, 1)?,
            now_iso.clone(),
            Some(recurrence_id.into()),
            Some(date(today_date + Duration::days(6))),
        ),
        task(
            "showcase-pending-capture",
            "Capturar ideias soltas",
            Some("Sem data e sem lembrete. Deve ficar em pendentes, abaixo das urgentes."),
            TaskStatus::Pending,
            None,
            None,
            None,
            None,
            past_iso(now, 9)?,
            now_iso.clone(),
            None,
            None,
        ),
        task(
            "showcase-pending-reading",
            "Ler notas antigas do projeto",
            Some("Outro exemplo sem vencimento para demonstrar ordenacao por criacao."),
            TaskStatus::Pending,
            None,
            None,
            None,
            None,
            past_iso(now, 10)?,
            now_iso.clone(),
            None,
            None,
        ),
        task(
            "showcase-completed-today",
            "Fechar rotina da manha",
            Some("Concluida hoje para aparecer em Meu Dia sem contar badge."),
            TaskStatus::Completed,
            Some(date(today_date)),
            Some(at_local(today_date, 8, 30, offset)?),
            None,
            Some(past_iso(now, 1)?),
            past_iso(now, 3)?,
            now_iso.clone(),
            None,
            None,
        ),
        task(
            "showcase-completed-week",
            "Enviar comprovante ao financeiro",
            Some("Concluida dentro da semana para validar historico."),
            TaskStatus::Completed,
            None,
            Some(at_local(today_date + Duration::days(1), 13, 0, offset)?),
            None,
            Some(past_iso(now, 2)?),
            past_iso(now, 8)?,
            now_iso.clone(),
            None,
            None,
        ),
        task(
            "showcase-later-roadmap",
            "Refinar roadmap do trimestre",
            Some("Fora da semana visivel, para testar proximas tarefas."),
            TaskStatus::Pending,
            None,
            Some(at_local(today_date + Duration::days(10), 10, 0, offset)?),
            None,
            None,
            past_iso(now, 11)?,
            now_iso.clone(),
            None,
            None,
        ),
        task(
            "showcase-archived-launch",
            "Publicar primeira versão interna",
            Some("Marco concluído e preservado como parte da história do Praxis."),
            TaskStatus::Completed,
            None,
            Some(at_local(today_date - Duration::days(120), 17, 0, offset)?),
            None,
            Some(past_iso(now, 120)?),
            past_iso(now, 145)?,
            past_iso(now, 12)?,
            None,
            None,
        ),
        task(
            "showcase-archived-finance",
            "Encerrar planejamento financeiro anual",
            Some("Exemplo de registro antigo arquivado sem perder notas e classificacao."),
            TaskStatus::Completed,
            None,
            Some(at_local(today_date - Duration::days(400), 12, 0, offset)?),
            None,
            Some(past_iso(now, 398)?),
            past_iso(now, 430)?,
            past_iso(now, 45)?,
            None,
            None,
        ),
        task(
            "showcase-archived-migration",
            "Migrar anotacoes para o cofre privado",
            Some("Checklist historico completo para demonstrar que o arquivo preserva contexto."),
            TaskStatus::Completed,
            None,
            Some(at_local(today_date - Duration::days(800), 18, 0, offset)?),
            None,
            Some(past_iso(now, 798)?),
            past_iso(now, 825)?,
            past_iso(now, 90)?,
            None,
            None,
        ),
    ];

    set_archived_at(&mut tasks, "showcase-archived-launch", past_iso(now, 12)?)?;
    set_archived_at(&mut tasks, "showcase-archived-finance", past_iso(now, 45)?)?;
    set_archived_at(
        &mut tasks,
        "showcase-archived-migration",
        past_iso(now, 90)?,
    )?;

    let checklist_items = showcase_checklist_items(now, &now_iso)?;
    let tags = showcase_tags(&now_iso);
    let task_tags = showcase_task_tags();
    let recurrence_rules = json!([
        {
            "id": recurrence_id,
            "title": "Revisao semanal do backlog",
            "notes": "Exemplo de tarefa recorrente semanal.",
            "frequency": "weekly",
            "interval": 1,
            "startsOn": date(today_date),
            "endsOn": null,
            "notify": true,
            "reminderTime": "09:30",
            "createdAt": past_iso(now, 12)?,
            "updatedAt": now_iso
        }
    ]);

    let mut document = read_active_document(&vault)?;
    let object = document
        .as_object_mut()
        .ok_or_else(|| "Documento .praxis invalido.".to_string())?;

    object.insert(
        "tasks".into(),
        serde_json::to_value(&tasks).map_err(|error| error.to_string())?,
    );
    object.insert("tags".into(), tags);
    object.insert("taskTags".into(), task_tags);
    object.insert(
        "checklistItems".into(),
        serde_json::to_value(&checklist_items).map_err(|error| error.to_string())?,
    );
    object.insert("recurrenceRules".into(), recurrence_rules);
    object.insert(
        "lifecycleEvents".into(),
        showcase_lifecycle_events(&now_iso),
    );
    object.insert("reminders".into(), Value::Array(Vec::new()));

    let reminder_sync = reminders::sync_task_reminders_in_document(&mut document, &tasks)?;
    write_active_document(&vault, &mut document)?;
    native_reminders::reconcile_native_reminders(&app, &reminder_sync.reminders);

    tasks::finish_task_collection(app, badge_state, tasks, reminder_sync.reminders, &today)
}

fn task(
    id: &str,
    title: &str,
    notes: Option<&str>,
    status: TaskStatus,
    planned_for: Option<String>,
    due_at: Option<String>,
    reminder_at: Option<String>,
    completed_at: Option<String>,
    created_at: String,
    updated_at: String,
    recurrence_id: Option<String>,
    occurrence_date: Option<String>,
) -> Task {
    Task {
        id: id.into(),
        title: title.into(),
        notes: notes.map(str::to_string),
        status,
        planned_for,
        due_at,
        reminder_at,
        recurrence_id,
        occurrence_date,
        completed_at,
        archived_at: None,
        retention_exempt: false,
        created_at,
        updated_at,
    }
}

fn set_archived_at(tasks: &mut [Task], task_id: &str, archived_at: String) -> Result<(), String> {
    let task = tasks
        .iter_mut()
        .find(|task| task.id == task_id)
        .ok_or_else(|| format!("Tarefa de showcase {task_id} nao encontrada."))?;

    task.archived_at = Some(archived_at.clone());
    task.updated_at = archived_at;
    Ok(())
}

fn showcase_checklist_items(
    now: OffsetDateTime,
    now_iso: &str,
) -> Result<Vec<ChecklistItem>, String> {
    Ok(vec![
        checklist_item(
            "showcase-check-demo-1",
            "showcase-today-checklist",
            "Separar fluxo principal",
            ChecklistItemStatus::Completed,
            0,
            Some(past_iso(now, 1)?),
            past_iso(now, 2)?,
            now_iso.into(),
        ),
        checklist_item(
            "showcase-check-demo-2",
            "showcase-today-checklist",
            "Validar badge e lembretes",
            ChecklistItemStatus::Completed,
            1,
            Some(past_iso(now, 1)?),
            past_iso(now, 2)?,
            now_iso.into(),
        ),
        checklist_item(
            "showcase-check-demo-3",
            "showcase-today-checklist",
            "Abrir painel lateral",
            ChecklistItemStatus::Pending,
            2,
            None,
            past_iso(now, 2)?,
            now_iso.into(),
        ),
        checklist_item(
            "showcase-check-demo-4",
            "showcase-today-checklist",
            "Tirar screenshot final",
            ChecklistItemStatus::Pending,
            3,
            None,
            past_iso(now, 2)?,
            now_iso.into(),
        ),
        checklist_item(
            "showcase-check-morning-1",
            "showcase-completed-today",
            "Revisar calendario",
            ChecklistItemStatus::Completed,
            0,
            Some(past_iso(now, 2)?),
            past_iso(now, 4)?,
            now_iso.into(),
        ),
        checklist_item(
            "showcase-check-morning-2",
            "showcase-completed-today",
            "Limpar pendencias rapidas",
            ChecklistItemStatus::Completed,
            1,
            Some(past_iso(now, 2)?),
            past_iso(now, 4)?,
            now_iso.into(),
        ),
        checklist_item(
            "showcase-check-migration-1",
            "showcase-archived-migration",
            "Exportar anotacoes antigas",
            ChecklistItemStatus::Completed,
            0,
            Some(past_iso(now, 800)?),
            past_iso(now, 825)?,
            past_iso(now, 800)?,
        ),
        checklist_item(
            "showcase-check-migration-2",
            "showcase-archived-migration",
            "Validar conteudo importado",
            ChecklistItemStatus::Completed,
            1,
            Some(past_iso(now, 799)?),
            past_iso(now, 825)?,
            past_iso(now, 799)?,
        ),
        checklist_item(
            "showcase-check-migration-3",
            "showcase-archived-migration",
            "Remover copias temporarias",
            ChecklistItemStatus::Completed,
            2,
            Some(past_iso(now, 798)?),
            past_iso(now, 825)?,
            past_iso(now, 798)?,
        ),
    ])
}

fn checklist_item(
    id: &str,
    task_id: &str,
    title: &str,
    status: ChecklistItemStatus,
    sort_order: i64,
    completed_at: Option<String>,
    created_at: String,
    updated_at: String,
) -> ChecklistItem {
    ChecklistItem {
        id: id.into(),
        task_id: task_id.into(),
        title: title.into(),
        status,
        sort_order,
        completed_at,
        created_at,
        updated_at,
    }
}

fn showcase_tags(now: &str) -> Value {
    json!([
        tag("showcase-tag-work", "work", "work", "#c86f28", now),
        tag(
            "showcase-tag-personal",
            "personal",
            "personal",
            "#b45f76",
            now
        ),
        tag("showcase-tag-finance", "finance", "finance", "#b18a2f", now),
        tag("showcase-tag-health", "health", "health", "#6f8f5f", now),
        tag("showcase-tag-focus", "focus", "focus", "#8b7358", now),
        tag("showcase-tag-home", "home", "home", "#8a789f", now)
    ])
}

fn tag(id: &str, name: &str, slug: &str, color: &str, now: &str) -> Value {
    json!({
        "id": id,
        "name": name,
        "slug": slug,
        "color": color,
        "createdAt": now,
        "updatedAt": now
    })
}

fn showcase_task_tags() -> Value {
    json!([
        relation("showcase-today-focus", "showcase-tag-work"),
        relation("showcase-today-focus", "showcase-tag-focus"),
        relation("showcase-today-checklist", "showcase-tag-work"),
        relation("showcase-today-admin", "showcase-tag-focus"),
        relation("showcase-overdue-contract", "showcase-tag-work"),
        relation("showcase-overdue-invoice", "showcase-tag-finance"),
        relation("showcase-week-tomorrow", "showcase-tag-work"),
        relation("showcase-week-design", "showcase-tag-work"),
        relation("showcase-week-release", "showcase-tag-work"),
        relation("showcase-week-report", "showcase-tag-finance"),
        relation("showcase-week-health", "showcase-tag-health"),
        relation("showcase-recurring-weekly", "showcase-tag-focus"),
        relation("showcase-pending-capture", "showcase-tag-personal"),
        relation("showcase-pending-reading", "showcase-tag-personal"),
        relation("showcase-completed-today", "showcase-tag-home"),
        relation("showcase-completed-week", "showcase-tag-finance"),
        relation("showcase-later-roadmap", "showcase-tag-work"),
        relation("showcase-archived-launch", "showcase-tag-work"),
        relation("showcase-archived-launch", "showcase-tag-focus"),
        relation("showcase-archived-finance", "showcase-tag-finance"),
        relation("showcase-archived-migration", "showcase-tag-personal"),
        relation("showcase-archived-migration", "showcase-tag-home")
    ])
}

fn relation(task_id: &str, tag_id: &str) -> Value {
    json!({ "taskId": task_id, "tagId": tag_id })
}

fn showcase_lifecycle_events(now: &str) -> Value {
    json!([
        lifecycle_event(
            "showcase-event-created-focus",
            "task",
            "showcase-today-focus",
            "showcase-today-focus",
            "taskCreated",
            now,
            "Tarefa criada",
            json!({ "title": "Finalizar proposta comercial" })
        ),
        lifecycle_event(
            "showcase-event-reminder-focus",
            "reminder",
            "task:showcase-today-focus",
            "showcase-today-focus",
            "reminderCreated",
            now,
            "Lembrete criado",
            json!({ "scheduledAt": { "from": null, "to": "hoje 09:45" } })
        ),
        lifecycle_event(
            "showcase-event-created-demo",
            "task",
            "showcase-today-checklist",
            "showcase-today-checklist",
            "taskCreated",
            now,
            "Tarefa criada",
            json!({ "title": "Preparar demo do Praxis" })
        ),
        lifecycle_event(
            "showcase-event-checklist-demo",
            "checklistItem",
            "showcase-check-demo-1",
            "showcase-today-checklist",
            "checklistItemAdded",
            now,
            "Item de checklist adicionado",
            json!({ "title": "Separar fluxo principal" })
        ),
        lifecycle_event(
            "showcase-event-overdue-contract",
            "task",
            "showcase-overdue-contract",
            "showcase-overdue-contract",
            "taskOverdue",
            now,
            "Tarefa venceu",
            json!({ "reason": "Vencimento anterior ao dia atual" })
        ),
        lifecycle_event(
            "showcase-event-completed-morning",
            "task",
            "showcase-completed-today",
            "showcase-completed-today",
            "taskCompleted",
            now,
            "Tarefa concluida",
            json!({ "completedAt": now })
        ),
        lifecycle_event(
            "showcase-event-recurring",
            "task",
            "showcase-recurring-weekly",
            "showcase-recurring-weekly",
            "recurrenceOccurrenceCreated",
            now,
            "Ocorrencia recorrente criada",
            json!({ "recurrenceId": "showcase-recurrence-weekly-review" })
        ),
        lifecycle_event(
            "showcase-event-archived-launch",
            "task",
            "showcase-archived-launch",
            "showcase-archived-launch",
            "taskArchived",
            now,
            "Tarefa arquivada",
            json!({ "reason": "retention", "showcase": true })
        ),
        lifecycle_event(
            "showcase-event-archived-finance",
            "task",
            "showcase-archived-finance",
            "showcase-archived-finance",
            "taskArchived",
            now,
            "Tarefa arquivada",
            json!({ "reason": "manual", "showcase": true })
        ),
        lifecycle_event(
            "showcase-event-archived-migration",
            "task",
            "showcase-archived-migration",
            "showcase-archived-migration",
            "taskArchived",
            now,
            "Tarefa arquivada",
            json!({ "reason": "retention", "showcase": true })
        )
    ])
}

fn lifecycle_event(
    id: &str,
    entity_type: &str,
    entity_id: &str,
    task_id: &str,
    event_type: &str,
    occurred_at: &str,
    summary: &str,
    metadata: Value,
) -> Value {
    json!({
        "id": id,
        "entityType": entity_type,
        "entityId": entity_id,
        "taskId": task_id,
        "type": event_type,
        "occurredAt": occurred_at,
        "actor": { "type": "user", "label": null },
        "summary": summary,
        "metadata": metadata
    })
}

fn parse_date(value: &str) -> Result<Date, String> {
    let mut parts = value.split('-');
    let year = parts
        .next()
        .ok_or_else(|| "Data invalida.".to_string())?
        .parse::<i32>()
        .map_err(|_| "Data invalida.".to_string())?;
    let month = parts
        .next()
        .ok_or_else(|| "Data invalida.".to_string())?
        .parse::<u8>()
        .map_err(|_| "Data invalida.".to_string())?;
    let day = parts
        .next()
        .ok_or_else(|| "Data invalida.".to_string())?
        .parse::<u8>()
        .map_err(|_| "Data invalida.".to_string())?;

    Date::from_calendar_date(
        year,
        time::Month::try_from(month).map_err(|_| "Data invalida.".to_string())?,
        day,
    )
    .map_err(|_| "Data invalida.".to_string())
}

fn date(value: Date) -> String {
    value.to_string()
}

fn at_local(date: Date, hour: u8, minute: u8, offset: UtcOffset) -> Result<String, String> {
    date.with_hms(hour, minute, 0)
        .map_err(|error| error.to_string())?
        .assume_offset(offset)
        .to_offset(UtcOffset::UTC)
        .format(&time::format_description::well_known::Rfc3339)
        .map_err(|error| error.to_string())
}

fn past_iso(now: OffsetDateTime, days: i64) -> Result<String, String> {
    format_rfc3339(now - Duration::days(days))
}

fn format_rfc3339(value: OffsetDateTime) -> Result<String, String> {
    value
        .format(&time::format_description::well_known::Rfc3339)
        .map_err(|error| error.to_string())
}
