use std::{
    collections::{BTreeMap, BTreeSet},
    fs,
    path::PathBuf,
    process::Command,
};

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use time::{format_description::well_known::Rfc3339, OffsetDateTime, UtcOffset};

use crate::reminders::{Reminder, ReminderStatus};

const INDEX_FILE: &str = "native-reminders.json";
const LAST_ERROR_FILE: &str = "native-reminders-error.txt";
const TASK_PREFIX: &str = "Praxis_Reminder_";
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
enum NativeReminderEntry {
    Legacy(String),
    Scheduled {
        task_name: String,
        scheduled_at: String,
        #[serde(default)]
        executable_path: String,
    },
}

impl NativeReminderEntry {
    fn task_name(&self) -> &str {
        match self {
            Self::Legacy(task_name) => task_name,
            Self::Scheduled { task_name, .. } => task_name,
        }
    }

    fn matches(&self, task_name: &str, scheduled_at: &str, executable_path: &str) -> bool {
        matches!(
            self,
            Self::Scheduled {
                task_name: current_task_name,
                scheduled_at: current_scheduled_at,
                executable_path: current_executable_path,
            } if current_task_name == task_name
                && current_scheduled_at == scheduled_at
                && current_executable_path == executable_path
        )
    }
}

#[derive(Debug, Default, Serialize, Deserialize)]
struct NativeReminderIndex {
    tasks: BTreeMap<String, NativeReminderEntry>,
}

pub fn reconcile_native_reminders(app: &AppHandle, reminders: &[Reminder]) {
    #[cfg(target_os = "windows")]
    {
        if let Err(error) = reconcile_windows_reminders(app, reminders) {
            persist_last_error(app, &error);
        }
    }

    #[cfg(not(target_os = "windows"))]
    {
        let _ = (app, reminders);
    }
}

pub fn native_reminder_count(app: &AppHandle) -> usize {
    load_index(app)
        .map(|index| index.tasks.len())
        .unwrap_or_default()
}

#[cfg(target_os = "windows")]
fn reconcile_windows_reminders(app: &AppHandle, reminders: &[Reminder]) -> Result<(), String> {
    let mut index = load_index(app)?;
    let now = OffsetDateTime::now_utc();
    let executable = std::env::current_exe().map_err(|error| error.to_string())?;
    let executable_path = executable.to_string_lossy().to_string();
    let desired = reminders
        .iter()
        .filter(|reminder| reminder.status == ReminderStatus::Scheduled)
        .filter_map(|reminder| {
            parse_time(&reminder.scheduled_at)
                .ok()
                .filter(|scheduled_at| *scheduled_at > now)
                .map(|scheduled_at| (reminder, scheduled_at))
        })
        .collect::<Vec<_>>();
    let desired_ids = desired
        .iter()
        .map(|(reminder, _)| reminder.id.clone())
        .collect::<BTreeSet<_>>();

    let mut index_changed = false;

    for (reminder_id, entry) in index.tasks.clone() {
        if !desired_ids.contains(&reminder_id) {
            delete_task(entry.task_name())?;
            index.tasks.remove(&reminder_id);
            index_changed = true;
        }
    }

    for (reminder, scheduled_at) in desired {
        let task_name = task_name_for(&reminder.id);
        let scheduled_at_value = reminder.scheduled_at.clone();
        let is_current = index
            .tasks
            .get(&reminder.id)
            .is_some_and(|entry| entry.matches(&task_name, &scheduled_at_value, &executable_path));

        if is_current {
            continue;
        }

        create_or_update_task(app, &executable_path, &task_name, reminder, scheduled_at)?;
        index.tasks.insert(
            reminder.id.clone(),
            NativeReminderEntry::Scheduled {
                task_name,
                scheduled_at: scheduled_at_value,
                executable_path: executable_path.clone(),
            },
        );
        index_changed = true;
    }

    if index_changed {
        save_index(app, &index)?;
    }
    clear_last_error(app);
    Ok(())
}

#[cfg(target_os = "windows")]
fn create_or_update_task(
    app: &AppHandle,
    executable_path: &str,
    task_name: &str,
    reminder: &Reminder,
    scheduled_at: OffsetDateTime,
) -> Result<(), String> {
    let xml_path = scheduler_dir(app)?.join(format!("{}.xml", sanitize_file_name(task_name)));
    let xml = task_xml(executable_path, &reminder.id, scheduled_at);

    fs::write(&xml_path, xml).map_err(|error| error.to_string())?;

    let mut command = Command::new("schtasks");
    let output = command
        .args([
            "/Create",
            "/TN",
            task_name,
            "/XML",
            &xml_path.to_string_lossy(),
            "/F",
        ])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|error| error.to_string())?;

    let _ = fs::remove_file(xml_path);

    if output.status.success() {
        return Ok(());
    }

    Err(format!(
        "Nao foi possivel agendar lembrete nativo {}. stdout: {} stderr: {}",
        reminder.id,
        String::from_utf8_lossy(&output.stdout),
        String::from_utf8_lossy(&output.stderr)
    ))
}

#[cfg(target_os = "windows")]
fn delete_task(task_name: &str) -> Result<(), String> {
    let mut command = Command::new("schtasks");
    let output = command
        .args(["/Delete", "/TN", task_name, "/F"])
        .creation_flags(CREATE_NO_WINDOW)
        .output()
        .map_err(|error| error.to_string())?;

    if output.status.success() {
        return Ok(());
    }

    Ok(())
}

#[cfg(target_os = "windows")]
fn task_xml(exe: &str, reminder_id: &str, scheduled_at: OffsetDateTime) -> String {
    let start_boundary = task_scheduler_start_boundary(scheduled_at);
    let escaped_exe = xml_escape(exe);
    let escaped_args = xml_escape(&format!(
        "--minimized --from-native-reminder {}",
        reminder_id
    ));

    format!(
        r#"<Task version="1.4" xmlns="http://schemas.microsoft.com/windows/2004/02/mit/task">
  <RegistrationInfo>
    <Description>Praxis reminder</Description>
  </RegistrationInfo>
  <Triggers>
    <TimeTrigger>
      <StartBoundary>{start_boundary}</StartBoundary>
      <Enabled>true</Enabled>
    </TimeTrigger>
  </Triggers>
  <Principals>
    <Principal id="Author">
      <LogonType>InteractiveToken</LogonType>
      <RunLevel>LeastPrivilege</RunLevel>
    </Principal>
  </Principals>
  <Settings>
    <MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>
    <DisallowStartIfOnBatteries>false</DisallowStartIfOnBatteries>
    <StopIfGoingOnBatteries>false</StopIfGoingOnBatteries>
    <AllowHardTerminate>true</AllowHardTerminate>
    <StartWhenAvailable>true</StartWhenAvailable>
    <RunOnlyIfNetworkAvailable>false</RunOnlyIfNetworkAvailable>
    <IdleSettings>
      <StopOnIdleEnd>false</StopOnIdleEnd>
      <RestartOnIdle>false</RestartOnIdle>
    </IdleSettings>
    <AllowStartOnDemand>true</AllowStartOnDemand>
    <Enabled>true</Enabled>
    <Hidden>true</Hidden>
    <RunOnlyIfIdle>false</RunOnlyIfIdle>
    <WakeToRun>false</WakeToRun>
    <ExecutionTimeLimit>PT5M</ExecutionTimeLimit>
    <Priority>7</Priority>
  </Settings>
  <Actions Context="Author">
    <Exec>
      <Command>{escaped_exe}</Command>
      <Arguments>{escaped_args}</Arguments>
    </Exec>
  </Actions>
</Task>"#
    )
}

#[cfg(target_os = "windows")]
fn task_scheduler_start_boundary(scheduled_at: OffsetDateTime) -> String {
    let local_offset = UtcOffset::current_local_offset().unwrap_or(UtcOffset::UTC);
    let local = scheduled_at.to_offset(local_offset);

    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}",
        local.year(),
        u8::from(local.month()),
        local.day(),
        local.hour(),
        local.minute(),
        local.second()
    )
}

#[cfg(target_os = "windows")]
fn task_name_for(reminder_id: &str) -> String {
    format!("{TASK_PREFIX}{}", sanitize_file_name(reminder_id))
}

#[cfg(target_os = "windows")]
fn parse_time(value: &str) -> Result<OffsetDateTime, String> {
    OffsetDateTime::parse(value, &Rfc3339).map_err(|error| error.to_string())
}

#[cfg(target_os = "windows")]
fn sanitize_file_name(value: &str) -> String {
    value
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                '_'
            }
        })
        .collect()
}

#[cfg(target_os = "windows")]
fn xml_escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}

fn load_index(app: &AppHandle) -> Result<NativeReminderIndex, String> {
    let path = index_path(app)?;

    if !path.exists() {
        return Ok(NativeReminderIndex::default());
    }

    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&content).map_err(|error| error.to_string())
}

fn save_index(app: &AppHandle, index: &NativeReminderIndex) -> Result<(), String> {
    let path = index_path(app)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let content = serde_json::to_string_pretty(index).map_err(|error| error.to_string())?;
    fs::write(path, content).map_err(|error| error.to_string())
}

fn index_path(app: &AppHandle) -> Result<PathBuf, String> {
    scheduler_dir(app).map(|path| path.join(INDEX_FILE))
}

fn scheduler_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join("native-reminders"))
        .map_err(|error| error.to_string())
}

fn persist_last_error(app: &AppHandle, error: &str) {
    let Ok(path) = scheduler_dir(app).map(|path| path.join(LAST_ERROR_FILE)) else {
        return;
    };

    if let Some(parent) = path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    let _ = fs::write(path, error);
}

fn clear_last_error(app: &AppHandle) {
    let Ok(path) = scheduler_dir(app).map(|path| path.join(LAST_ERROR_FILE)) else {
        return;
    };

    if path.exists() {
        let _ = fs::remove_file(path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn legacy_entries_are_refreshed_once() {
        let entry = NativeReminderEntry::Legacy("Praxis_Reminder_task_1".into());

        assert!(!entry.matches(
            "Praxis_Reminder_task_1",
            "2026-06-24T12:00:00Z",
            "C:\\Praxis\\praxis.exe"
        ));
    }

    #[test]
    fn scheduled_entries_only_match_the_same_time_and_task_name() {
        let entry = NativeReminderEntry::Scheduled {
            task_name: "Praxis_Reminder_task_1".into(),
            scheduled_at: "2026-06-24T12:00:00Z".into(),
            executable_path: "C:\\Praxis\\praxis.exe".into(),
        };

        assert!(entry.matches(
            "Praxis_Reminder_task_1",
            "2026-06-24T12:00:00Z",
            "C:\\Praxis\\praxis.exe"
        ));
        assert!(!entry.matches(
            "Praxis_Reminder_task_1",
            "2026-06-24T13:00:00Z",
            "C:\\Praxis\\praxis.exe"
        ));
        assert!(!entry.matches(
            "Praxis_Reminder_task_1",
            "2026-06-24T12:00:00Z",
            "C:\\Praxis\\praxis-new.exe"
        ));
    }
}
