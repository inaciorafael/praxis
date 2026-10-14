use std::{
    fs,
    io::Write,
    path::{Path, PathBuf},
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};

use argon2::Argon2;
use base64::{engine::general_purpose::STANDARD as BASE64, Engine};
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    Key, XChaCha20Poly1305, XNonce,
};
use keyring::Entry;
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::{AppHandle, Manager};
use time::{format_description::well_known::Rfc3339, OffsetDateTime};
use uuid::Uuid;
use windows::Win32::{
    Foundation::{LocalFree, HLOCAL},
    Security::Cryptography::{
        CryptProtectData, CryptUnprotectData, CRYPTPROTECT_UI_FORBIDDEN, CRYPT_INTEGER_BLOB,
    },
};
use zeroize::Zeroizing;

const APP_NAME: &str = "praxis";
const DATA_FILE_EXTENSION: &str = "praxis";
const FORMAT_VERSION: u32 = 1;
const SCHEMA_VERSION: u32 = 1;
const SETTINGS_FILE: &str = "settings.json";
const SAFETY_COPIES_DIR: &str = "safety-copies";
const DEVICE_CREDENTIALS_DIR: &str = "device-credentials";
const KEYRING_SERVICE: &str = "com.rafael.praxis";

pub struct VaultStore(pub Mutex<VaultState>);

#[derive(Default)]
pub struct VaultState {
    pub active: Option<ActiveVault>,
    pub auto_unlock_error: Option<String>,
}

pub struct ActiveVault {
    pub path: PathBuf,
    pub header: DataFileHeader,
    file_fingerprint: FileFingerprint,
    safety_copies_dir: PathBuf,
    key: Zeroizing<[u8; 32]>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
struct FileFingerprint {
    len: u64,
    modified_ms: u128,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DataFileHeader {
    app: String,
    format_version: u32,
    file_id: String,
    created_at: String,
    updated_at: String,
    schema_version: u32,
    encryption: EncryptionHeader,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct EncryptionHeader {
    algorithm: String,
    kdf: String,
    salt: String,
    nonce: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct PraxisDataFile {
    header: DataFileHeader,
    ciphertext: String,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct LocalSettings {
    selected_data_file_path: Option<String>,
    device_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VaultStatus {
    pub(crate) active: bool,
    pub(crate) selected_data_file_path: Option<String>,
    pub(crate) active_data_file_path: Option<String>,
    pub(crate) file_id: Option<String>,
    pub(crate) schema_version: Option<u32>,
    pub(crate) data_file_updated_at: Option<String>,
    pub(crate) data_file_modified_at: Option<String>,
    pub(crate) device_id: String,
    pub(crate) credential_saved: bool,
    pub(crate) auto_unlock_error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataFileValidation {
    valid: bool,
    header: Option<DataFileHeader>,
    error: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SafetyCopyInfo {
    file_name: String,
    path: String,
    size_bytes: u64,
    modified_at: Option<String>,
}

#[tauri::command]
pub fn suggest_data_file_path(app: AppHandle) -> Result<String, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?
        .join("my-tasks.praxis");

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_vault_status(
    app: AppHandle,
    state: tauri::State<'_, VaultStore>,
) -> Result<VaultStatus, String> {
    vault_status(&app, &state)
}

pub fn auto_unlock_data_file(app: &AppHandle) -> Result<(), String> {
    let settings = load_settings(app)?;
    let Some(path) = settings.selected_data_file_path else {
        return Ok(());
    };

    let path = PathBuf::from(path);

    if !path.exists() {
        set_auto_unlock_error(
            app,
            Some("Arquivo .praxis selecionado nao foi encontrado.".into()),
        );
        return Ok(());
    }

    let data_file = read_data_file(&path)?;
    let header = validate_header(data_file.header)?;
    let password = match read_saved_password(app, &header.file_id) {
        Ok(password) => password,
        Err(error) => {
            set_auto_unlock_error(app, Some(format!("Senha salva nao encontrada: {error}")));
            return Ok(());
        }
    };

    let active = match unlock_data_file(path, password, safety_copies_dir(app)?) {
        Ok(active) => active,
        Err(error) => {
            set_auto_unlock_error(app, Some(format!("Auto-unlock falhou: {error}")));
            return Ok(());
        }
    };

    let state = app.state::<VaultStore>();

    if let Ok(mut state) = state.0.lock() {
        state.active = Some(active);
        state.auto_unlock_error = None;
    }

    Ok(())
}

fn set_auto_unlock_error(app: &AppHandle, error: Option<String>) {
    let state = app.state::<VaultStore>();

    if let Ok(mut state) = state.0.lock() {
        state.auto_unlock_error = error;
    };
}

fn selected_file_credential_saved(app: &AppHandle, path: Option<&str>) -> bool {
    let Some(path) = path else {
        return false;
    };

    let Ok(data_file) = read_data_file(Path::new(path)) else {
        return false;
    };
    let Ok(header) = validate_header(data_file.header) else {
        return false;
    };

    read_saved_password(app, &header.file_id).is_ok()
}

#[tauri::command]
pub fn validate_data_file(path: String) -> DataFileValidation {
    match read_data_file(Path::new(&path)).and_then(|file| validate_header(file.header)) {
        Ok(header) => DataFileValidation {
            valid: true,
            header: Some(header),
            error: None,
        },
        Err(error) => DataFileValidation {
            valid: false,
            header: None,
            error: Some(error),
        },
    }
}

#[tauri::command]
pub fn list_safety_copies(app: AppHandle) -> Result<Vec<SafetyCopyInfo>, String> {
    let dir = safety_copies_dir(&app)?;

    if !dir.exists() {
        return Ok(Vec::new());
    }

    let mut copies = fs::read_dir(dir)
        .map_err(|error| error.to_string())?
        .filter_map(Result::ok)
        .filter_map(|entry| safety_copy_info(entry.path()).transpose())
        .collect::<Result<Vec<_>, String>>()?;

    copies.sort_by(|a, b| b.modified_at.cmp(&a.modified_at));
    Ok(copies)
}

#[tauri::command]
pub fn get_safety_copies_dir(app: AppHandle) -> Result<String, String> {
    let dir = safety_copies_dir(&app)?;
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir.to_string_lossy().to_string())
}

#[tauri::command]
pub fn reload_active_data_file(
    app: AppHandle,
    state: tauri::State<'_, VaultStore>,
) -> Result<VaultStatus, String> {
    {
        let mut state = state
            .0
            .lock()
            .map_err(|_| "Nao foi possivel acessar o cofre.".to_string())?;
        let active = state
            .active
            .as_mut()
            .ok_or_else(|| "Abra um arquivo .praxis antes de continuar.".to_string())?;
        let data_file = read_data_file(&active.path)?;
        let header = validate_header(data_file.header)?;

        if header.file_id != active.header.file_id {
            return Err("O arquivo selecionado nao e o mesmo cofre aberto.".into());
        }

        let nonce = decode_fixed::<24>(&header.encryption.nonce, "nonce")?;
        let document = decrypt_payload(&active.key, &nonce, &data_file.ciphertext)?;
        validate_plaintext(&document)?;

        active.header = header;
        active.file_fingerprint = file_fingerprint(&active.path)?;
    }

    vault_status(&app, &state)
}

#[tauri::command]
pub fn create_data_file(
    app: AppHandle,
    state: tauri::State<'_, VaultStore>,
    path: String,
    password: String,
) -> Result<VaultStatus, String> {
    let path = normalize_data_file_path(path)?;

    if path.exists() {
        return Err("Arquivo .praxis ja existe.".into());
    }

    let now = now_iso()?;
    let mut salt = [0_u8; 16];
    let mut nonce = [0_u8; 24];
    rand::thread_rng().fill_bytes(&mut salt);
    rand::thread_rng().fill_bytes(&mut nonce);

    let key = derive_key(&password, &salt)?;
    let header = DataFileHeader {
        app: APP_NAME.into(),
        format_version: FORMAT_VERSION,
        file_id: Uuid::new_v4().to_string(),
        created_at: now.clone(),
        updated_at: now.clone(),
        schema_version: SCHEMA_VERSION,
        encryption: EncryptionHeader {
            algorithm: "XChaCha20-Poly1305".into(),
            kdf: "Argon2id".into(),
            salt: BASE64.encode(salt),
            nonce: BASE64.encode(nonce),
        },
    };
    let plaintext = initial_plaintext(&now);
    let ciphertext = encrypt_payload(&key, &nonce, &plaintext)?;
    let data_file = PraxisDataFile {
        header: header.clone(),
        ciphertext,
    };

    write_data_file(&path, &data_file)?;
    set_selected_data_file_path(&app, Some(path.to_string_lossy().to_string()))?;
    save_password(&app, &header.file_id, &password)?;

    if let Ok(mut state) = state.0.lock() {
        state.auto_unlock_error = None;
        state.active = Some(ActiveVault {
            file_fingerprint: file_fingerprint(&path)?,
            safety_copies_dir: safety_copies_dir(&app)?,
            path,
            header,
            key,
        });
    }

    vault_status(&app, &state)
}

#[tauri::command]
pub fn open_data_file(
    app: AppHandle,
    state: tauri::State<'_, VaultStore>,
    path: String,
    password: String,
) -> Result<VaultStatus, String> {
    let path = normalize_data_file_path(path)?;
    let active = unlock_data_file(path, password.clone(), safety_copies_dir(&app)?)?;

    set_selected_data_file_path(&app, Some(active.path.to_string_lossy().to_string()))?;
    save_password(&app, &active.header.file_id, &password)?;

    if let Ok(mut state) = state.0.lock() {
        state.auto_unlock_error = None;
        state.active = Some(active);
    }

    vault_status(&app, &state)
}

#[tauri::command]
pub fn close_data_file(
    app: AppHandle,
    state: tauri::State<'_, VaultStore>,
) -> Result<VaultStatus, String> {
    if let Ok(mut state) = state.0.lock() {
        if let Some(active) = state.active.as_ref() {
            let _ = delete_saved_password(&app, &active.header.file_id);
        }

        state.active = None;
    }

    vault_status(&app, &state)
}

fn unlock_data_file(
    path: PathBuf,
    password: String,
    safety_copies_dir: PathBuf,
) -> Result<ActiveVault, String> {
    let data_file = read_data_file(&path)?;
    let header = validate_header(data_file.header)?;
    let salt = decode_fixed::<16>(&header.encryption.salt, "salt")?;
    let nonce = decode_fixed::<24>(&header.encryption.nonce, "nonce")?;
    let key = derive_key(&password, &salt)?;
    let plaintext = decrypt_payload(&key, &nonce, &data_file.ciphertext)?;
    validate_plaintext(&plaintext)?;

    Ok(ActiveVault {
        file_fingerprint: file_fingerprint(&path)?,
        path,
        header,
        safety_copies_dir,
        key,
    })
}

pub(crate) fn vault_status(app: &AppHandle, state: &VaultStore) -> Result<VaultStatus, String> {
    let settings = load_settings(app)?;
    let selected_data_file_path = settings.selected_data_file_path.clone();
    let (active, auto_unlock_error) = state
        .0
        .lock()
        .ok()
        .map(|state| {
            (
                state.active.as_ref().map(|active| {
                    (
                        active.path.to_string_lossy().to_string(),
                        active.header.file_id.clone(),
                        active.header.schema_version,
                        active.header.updated_at.clone(),
                        data_file_modified_at(&active.path),
                    )
                }),
                state.auto_unlock_error.clone(),
            )
        })
        .unwrap_or((None, None));
    let credential_saved =
        active.is_some() || selected_file_credential_saved(app, selected_data_file_path.as_deref());
    let inactive_updated_at = active
        .is_none()
        .then(|| data_file_updated_at(selected_data_file_path.as_deref()))
        .flatten();
    let inactive_modified_at = active
        .is_none()
        .then(|| data_file_modified_at_from_str(selected_data_file_path.as_deref()))
        .flatten();

    Ok(VaultStatus {
        active: active.is_some(),
        selected_data_file_path,
        active_data_file_path: active.as_ref().map(|active| active.0.clone()),
        file_id: active.as_ref().map(|active| active.1.clone()),
        schema_version: active.as_ref().map(|active| active.2),
        data_file_updated_at: active
            .as_ref()
            .map(|active| active.3.clone())
            .or(inactive_updated_at),
        data_file_modified_at: active
            .as_ref()
            .and_then(|active| active.4.clone())
            .or(inactive_modified_at),
        device_id: settings.device_id,
        credential_saved,
        auto_unlock_error,
    })
}

fn normalize_data_file_path(path: String) -> Result<PathBuf, String> {
    let path = PathBuf::from(path.trim());

    if path.as_os_str().is_empty() {
        return Err("Informe o caminho do arquivo .praxis.".into());
    }

    if path.extension().and_then(|extension| extension.to_str()) != Some(DATA_FILE_EXTENSION) {
        return Err("O arquivo precisa usar a extensao .praxis.".into());
    }

    Ok(path)
}

fn initial_plaintext(now: &str) -> Value {
    json!({
        "schemaVersion": SCHEMA_VERSION,
        "tasks": [],
        "tags": [],
        "taskTags": [],
        "checklistItems": [],
        "reminders": [],
        "recurrenceRules": [],
        "lifecycleEvents": [],
        "settings": {},
        "metadata": {
            "createdAt": now,
            "updatedAt": now
        }
    })
}

pub fn read_active_document(state: &VaultStore) -> Result<Value, String> {
    let state = state
        .0
        .lock()
        .map_err(|_| "Nao foi possivel acessar o cofre.".to_string())?;
    let active = state
        .active
        .as_ref()
        .ok_or_else(|| "Abra um arquivo .praxis antes de continuar.".to_string())?;
    read_document(active)
}

fn read_document(active: &ActiveVault) -> Result<Value, String> {
    let data_file = read_data_file(&active.path)?;
    let header = validate_header(data_file.header)?;
    if header.file_id != active.header.file_id {
        return Err("O arquivo selecionado nao e o mesmo cofre aberto.".into());
    }
    let nonce = decode_fixed::<24>(&header.encryption.nonce, "nonce")?;
    let document = decrypt_payload(&active.key, &nonce, &data_file.ciphertext)?;
    validate_plaintext(&document)?;

    Ok(document)
}

pub fn write_active_document(state: &VaultStore, document: &mut Value) -> Result<(), String> {
    validate_plaintext(document)?;

    let mut state = state
        .0
        .lock()
        .map_err(|_| "Nao foi possivel acessar o cofre.".to_string())?;
    let active = state
        .active
        .as_mut()
        .ok_or_else(|| "Abra um arquivo .praxis antes de continuar.".to_string())?;
    commit_document(active, document)
}

/// Runs a fresh read, domain mutation and encrypted commit under the same vault lock.
pub(crate) fn mutate_active_document<T>(
    state: &VaultStore,
    mutate: impl FnOnce(&mut Value) -> Result<T, String>,
) -> Result<T, String> {
    let mut state = state
        .0
        .lock()
        .map_err(|_| "Nao foi possivel acessar o cofre.")?;
    let active = state
        .active
        .as_mut()
        .ok_or("Abra um arquivo .praxis antes de continuar.")?;
    ensure_file_was_not_changed_externally(active)?;
    let mut document = read_document(active)?;
    let before = document.clone();
    let result = mutate(&mut document)?;
    if document != before {
        commit_document(active, &mut document)?;
    }
    Ok(result)
}

fn document_revision(document: &Value) -> Result<u64, String> {
    match document.pointer("/metadata/revision") {
        None => Ok(0),
        Some(value) => value
            .as_u64()
            .ok_or_else(|| "Revisao do cofre invalida.".into()),
    }
}

#[cfg(test)]
mod persistence_tests {
    use super::*;

    struct Fixture {
        state: VaultStore,
        directory: PathBuf,
        path: PathBuf,
    }
    impl Fixture {
        fn new() -> Self {
            let directory =
                std::env::temp_dir().join(format!("praxis-vault-test-{}", Uuid::new_v4()));
            let path = directory.join("fixture.praxis");
            let now = now_iso().unwrap();
            let key = Zeroizing::new([7_u8; 32]);
            let nonce = [3_u8; 24];
            let header = DataFileHeader {
                app: APP_NAME.into(),
                format_version: FORMAT_VERSION,
                file_id: Uuid::new_v4().to_string(),
                created_at: now.clone(),
                updated_at: now.clone(),
                schema_version: SCHEMA_VERSION,
                encryption: EncryptionHeader {
                    algorithm: "XChaCha20-Poly1305".into(),
                    kdf: "Argon2id".into(),
                    salt: BASE64.encode([1_u8; 16]),
                    nonce: BASE64.encode(nonce),
                },
            };
            let document = initial_plaintext(&now);
            write_data_file(
                &path,
                &PraxisDataFile {
                    header: header.clone(),
                    ciphertext: encrypt_payload(&key, &nonce, &document).unwrap(),
                },
            )
            .unwrap();
            let active = ActiveVault {
                path: path.clone(),
                header,
                file_fingerprint: file_fingerprint(&path).unwrap(),
                safety_copies_dir: directory.join("copies"),
                key,
            };
            Self {
                state: VaultStore(Mutex::new(VaultState {
                    active: Some(active),
                    auto_unlock_error: None,
                })),
                directory,
                path,
            }
        }
    }
    impl Drop for Fixture {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.directory);
        }
    }

    #[test]
    fn encrypted_atomic_roundtrip_rejects_stale_writers_and_skips_noop() {
        let fixture = Fixture::new();
        let mut stale = read_active_document(&fixture.state).unwrap();
        let mut latest = stale.clone();
        latest["settings"]["privateNote"] = json!("secret-board-text");
        write_active_document(&fixture.state, &mut latest).unwrap();
        assert_eq!(document_revision(&latest).unwrap(), 1);
        assert_eq!(read_active_document(&fixture.state).unwrap(), latest);
        assert!(!fs::read_to_string(&fixture.path)
            .unwrap()
            .contains("secret-board-text"));
        let bytes = fs::read(&fixture.path).unwrap();
        write_active_document(&fixture.state, &mut latest).unwrap();
        mutate_active_document(&fixture.state, |_| Ok(())).unwrap();
        assert_eq!(fs::read(&fixture.path).unwrap(), bytes);
        assert_eq!(
            fs::read_dir(fixture.directory.join("copies"))
                .unwrap()
                .count(),
            1
        );
        stale["settings"]["stale"] = json!(true);
        assert!(write_active_document(&fixture.state, &mut stale).is_err());
        assert_eq!(fs::read(&fixture.path).unwrap(), bytes);
        assert_eq!(
            fs::read_dir(&fixture.directory)
                .unwrap()
                .filter_map(Result::ok)
                .filter(|entry| entry.path().extension().is_some_and(|ext| ext == "tmp"))
                .count(),
            0
        );
    }

    #[test]
    fn failed_mutation_and_external_conflict_preserve_file_and_header() {
        let fixture = Fixture::new();
        let bytes = fs::read(&fixture.path).unwrap();
        let result: Result<(), String> = mutate_active_document(&fixture.state, |document| {
            document["settings"]["changed"] = json!(true);
            Err("Domain validation failed".into())
        });
        assert!(result.is_err());
        assert_eq!(fs::read(&fixture.path).unwrap(), bytes);
        let mut stale = read_active_document(&fixture.state).unwrap();
        let nonce = fixture
            .state
            .0
            .lock()
            .unwrap()
            .active
            .as_ref()
            .unwrap()
            .header
            .encryption
            .nonce
            .clone();
        let mut external = bytes.clone();
        external.push(b' ');
        fs::write(&fixture.path, &external).unwrap();
        stale["settings"]["changed"] = json!(true);
        assert!(write_active_document(&fixture.state, &mut stale).is_err());
        assert_eq!(fs::read(&fixture.path).unwrap(), external);
        assert_eq!(
            fixture
                .state
                .0
                .lock()
                .unwrap()
                .active
                .as_ref()
                .unwrap()
                .header
                .encryption
                .nonce,
            nonce
        );
    }
}

fn commit_document(active: &mut ActiveVault, document: &mut Value) -> Result<(), String> {
    validate_plaintext(document)?;
    ensure_file_was_not_changed_externally(active)?;
    let current = read_document(active)?;
    let revision = document_revision(&current)?;
    if document_revision(document)? != revision {
        return Err(
            "O cofre mudou durante esta operacao. Recarregue os dados antes de tentar novamente."
                .into(),
        );
    }
    if document == &current {
        return Ok(());
    }
    let next_revision = revision
        .checked_add(1)
        .ok_or("Limite de revisoes do cofre atingido.")?;
    create_safety_copy(active, "before-write")?;

    let now = now_iso()?;
    let mut nonce = [0_u8; 24];
    rand::thread_rng().fill_bytes(&mut nonce);

    let mut saved = document.clone();
    let object = saved
        .as_object_mut()
        .ok_or("Documento do cofre invalido.")?;
    let metadata = object.entry("metadata").or_insert_with(|| json!({}));
    let metadata = metadata
        .as_object_mut()
        .ok_or("Metadados do cofre invalidos.")?;
    metadata.insert("updatedAt".into(), Value::String(now.clone()));
    metadata.insert("revision".into(), json!(next_revision));

    let mut header = active.header.clone();
    header.updated_at = now;
    header.encryption.nonce = BASE64.encode(nonce);
    let ciphertext = encrypt_payload(&active.key, &nonce, &saved)?;
    let data_file = PraxisDataFile {
        header: header.clone(),
        ciphertext,
    };

    write_data_file(&active.path, &data_file)?;
    active.header = header;
    active.file_fingerprint = file_fingerprint(&active.path)?;
    *document = saved;
    Ok(())
}

fn validate_plaintext(value: &Value) -> Result<(), String> {
    match value.get("schemaVersion").and_then(Value::as_u64) {
        Some(version) if version == u64::from(SCHEMA_VERSION) => Ok(()),
        _ => Err("Arquivo .praxis possui schema invalido.".into()),
    }
}

fn validate_header(header: DataFileHeader) -> Result<DataFileHeader, String> {
    if header.app != APP_NAME {
        return Err("Arquivo nao pertence ao Praxis.".into());
    }

    if header.format_version != FORMAT_VERSION {
        return Err("Versao de arquivo .praxis nao suportada.".into());
    }

    if header.schema_version != SCHEMA_VERSION {
        return Err("Schema de arquivo .praxis nao suportado.".into());
    }

    if header.encryption.algorithm != "XChaCha20-Poly1305" || header.encryption.kdf != "Argon2id" {
        return Err("Criptografia do arquivo .praxis nao suportada.".into());
    }

    Ok(header)
}

fn derive_key(password: &str, salt: &[u8]) -> Result<Zeroizing<[u8; 32]>, String> {
    if password.len() < 8 {
        return Err("A senha precisa ter pelo menos 8 caracteres.".into());
    }

    let mut key = Zeroizing::new([0_u8; 32]);
    Argon2::default()
        .hash_password_into(password.as_bytes(), salt, key.as_mut())
        .map_err(|error| error.to_string())?;

    Ok(key)
}

fn encrypt_payload(key: &[u8; 32], nonce: &[u8; 24], payload: &Value) -> Result<String, String> {
    let cipher = XChaCha20Poly1305::new(Key::from_slice(key));
    let plaintext = serde_json::to_vec(payload).map_err(|error| error.to_string())?;
    let ciphertext = cipher
        .encrypt(XNonce::from_slice(nonce), plaintext.as_ref())
        .map_err(|_| "Nao foi possivel criptografar o arquivo .praxis.".to_string())?;

    Ok(BASE64.encode(ciphertext))
}

fn decrypt_payload(key: &[u8; 32], nonce: &[u8; 24], ciphertext: &str) -> Result<Value, String> {
    let cipher = XChaCha20Poly1305::new(Key::from_slice(key));
    let ciphertext = BASE64
        .decode(ciphertext)
        .map_err(|_| "Ciphertext invalido.".to_string())?;
    let plaintext = cipher
        .decrypt(XNonce::from_slice(nonce), ciphertext.as_ref())
        .map_err(|_| "Senha incorreta ou arquivo corrompido.".to_string())?;

    serde_json::from_slice(&plaintext).map_err(|error| error.to_string())
}

fn read_data_file(path: &Path) -> Result<PraxisDataFile, String> {
    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&content).map_err(|error| error.to_string())
}

fn write_data_file(path: &Path, data_file: &PraxisDataFile) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let content = serde_json::to_string_pretty(data_file).map_err(|error| error.to_string())?;
    let temporary = path.with_file_name(format!(".praxis-{}.tmp", Uuid::new_v4()));
    let result = (|| {
        let mut file = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&temporary)
            .map_err(|error| error.to_string())?;
        file.write_all(content.as_bytes())
            .map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
        drop(file);
        replace_file(&temporary, path)
    })();
    if result.is_err() {
        let _ = fs::remove_file(&temporary);
    }
    result
}

#[cfg(target_os = "windows")]
fn replace_file(source: &Path, target: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;
    use windows::{
        core::PCWSTR,
        Win32::Storage::FileSystem::{
            MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
        },
    };
    let source: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
    let target: Vec<u16> = target.as_os_str().encode_wide().chain(Some(0)).collect();
    unsafe {
        MoveFileExW(
            PCWSTR(source.as_ptr()),
            PCWSTR(target.as_ptr()),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    }
    .map_err(|error| error.to_string())
}

#[cfg(not(target_os = "windows"))]
fn replace_file(source: &Path, target: &Path) -> Result<(), String> {
    fs::rename(source, target).map_err(|error| error.to_string())
}

fn ensure_file_was_not_changed_externally(active: &ActiveVault) -> Result<(), String> {
    let current = file_fingerprint(&active.path)?;

    if current == active.file_fingerprint {
        return Ok(());
    }

    let copy_path = create_safety_copy(active, "external-conflict")?;

    Err(format!(
        "O arquivo .praxis foi alterado fora do Praxis desde que foi aberto. Para evitar perda de dados, a escrita foi cancelada. Copia preservada em: {}",
        copy_path.to_string_lossy()
    ))
}

fn create_safety_copy(active: &ActiveVault, reason: &str) -> Result<PathBuf, String> {
    fs::create_dir_all(&active.safety_copies_dir).map_err(|error| error.to_string())?;

    let file_stem = active
        .path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("praxis");
    let copy_path = active.safety_copies_dir.join(format!(
        "{}-{}-{}-{}.praxis",
        file_stem,
        now_file_stamp(),
        reason,
        Uuid::new_v4()
    ));

    fs::copy(&active.path, &copy_path).map_err(|error| error.to_string())?;
    Ok(copy_path)
}

fn file_fingerprint(path: &Path) -> Result<FileFingerprint, String> {
    let metadata = fs::metadata(path).map_err(|error| error.to_string())?;
    let modified = metadata
        .modified()
        .map_err(|error| error.to_string())?
        .duration_since(UNIX_EPOCH)
        .map_err(|error| error.to_string())?;

    Ok(FileFingerprint {
        len: metadata.len(),
        modified_ms: modified.as_millis(),
    })
}

fn data_file_updated_at(path: Option<&str>) -> Option<String> {
    let path = Path::new(path?);
    read_data_file(path)
        .ok()
        .and_then(|file| validate_header(file.header).ok())
        .map(|header| header.updated_at)
}

fn data_file_modified_at_from_str(path: Option<&str>) -> Option<String> {
    data_file_modified_at(Path::new(path?))
}

fn data_file_modified_at(path: &Path) -> Option<String> {
    fs::metadata(path)
        .ok()
        .and_then(|metadata| metadata.modified().ok())
        .and_then(system_time_to_iso)
}

fn safety_copy_info(path: PathBuf) -> Result<Option<SafetyCopyInfo>, String> {
    if path.extension().and_then(|extension| extension.to_str()) != Some(DATA_FILE_EXTENSION) {
        return Ok(None);
    }

    let metadata = fs::metadata(&path).map_err(|error| error.to_string())?;
    let file_name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("backup.praxis")
        .to_string();
    let modified_at = metadata.modified().ok().and_then(system_time_to_iso);

    Ok(Some(SafetyCopyInfo {
        file_name,
        path: path.to_string_lossy().to_string(),
        size_bytes: metadata.len(),
        modified_at,
    }))
}

fn system_time_to_iso(value: SystemTime) -> Option<String> {
    let timestamp = value.duration_since(UNIX_EPOCH).ok()?.as_secs();
    OffsetDateTime::from_unix_timestamp(timestamp as i64)
        .ok()?
        .format(&Rfc3339)
        .ok()
}

fn decode_fixed<const N: usize>(value: &str, label: &str) -> Result<[u8; N], String> {
    let bytes = BASE64
        .decode(value)
        .map_err(|_| format!("{label} invalido."))?;

    bytes
        .try_into()
        .map_err(|_| format!("{label} possui tamanho invalido."))
}

fn settings_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(SETTINGS_FILE))
        .map_err(|error| error.to_string())
}

pub(crate) fn safety_copies_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(SAFETY_COPIES_DIR))
        .map_err(|error| error.to_string())
}

fn device_credentials_dir(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_data_dir()
        .map(|path| path.join(DEVICE_CREDENTIALS_DIR))
        .map_err(|error| error.to_string())
}

fn device_credential_file_path(app: &AppHandle, file_id: &str) -> Result<PathBuf, String> {
    Ok(device_credentials_dir(app)?.join(format!("{file_id}.bin")))
}

fn load_settings(app: &AppHandle) -> Result<LocalSettings, String> {
    let path = settings_file_path(app)?;

    if !path.exists() {
        let settings = LocalSettings {
            selected_data_file_path: None,
            device_id: Uuid::new_v4().to_string(),
        };
        save_settings(app, &settings)?;
        return Ok(settings);
    }

    let content = fs::read_to_string(path).map_err(|error| error.to_string())?;
    serde_json::from_str(&content).map_err(|error| error.to_string())
}

fn save_settings(app: &AppHandle, settings: &LocalSettings) -> Result<(), String> {
    let path = settings_file_path(app)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let content = serde_json::to_string_pretty(settings).map_err(|error| error.to_string())?;
    fs::write(path, content).map_err(|error| error.to_string())
}

fn set_selected_data_file_path(app: &AppHandle, path: Option<String>) -> Result<(), String> {
    let mut settings = load_settings(app)?;
    settings.selected_data_file_path = path;
    save_settings(app, &settings)
}

fn now_iso() -> Result<String, String> {
    OffsetDateTime::now_utc()
        .format(&Rfc3339)
        .map_err(|error| error.to_string())
}

fn now_file_stamp() -> String {
    OffsetDateTime::now_utc().unix_timestamp_nanos().to_string()
}

fn credential(file_id: &str) -> Result<Entry, String> {
    Entry::new(KEYRING_SERVICE, file_id).map_err(|error| error.to_string())
}

fn save_password(app: &AppHandle, file_id: &str, password: &str) -> Result<(), String> {
    let keyring_result = credential(file_id).and_then(|entry| {
        entry
            .set_password(password)
            .map_err(|error| error.to_string())
    });
    let device_result = save_device_password(app, file_id, password);

    match (keyring_result, device_result) {
        (_, Ok(())) => Ok(()),
        (Ok(()), Err(_)) => Ok(()),
        (Err(keyring_error), Err(device_error)) => Err(format!(
            "Nao foi possivel salvar a senha no dispositivo. Credential Manager: {keyring_error}. DPAPI: {device_error}"
        )),
    }
}

fn read_saved_password(app: &AppHandle, file_id: &str) -> Result<String, String> {
    match credential(file_id)
        .and_then(|entry| entry.get_password().map_err(|error| error.to_string()))
    {
        Ok(password) => Ok(password),
        Err(keyring_error) => read_device_password(app, file_id).map_err(|device_error| {
            format!("Credential Manager: {keyring_error}. DPAPI local: {device_error}")
        }),
    }
}

fn delete_saved_password(app: &AppHandle, file_id: &str) -> Result<(), String> {
    let _ = credential(file_id)
        .and_then(|entry| entry.delete_credential().map_err(|error| error.to_string()));

    let path = device_credential_file_path(app, file_id)?;

    if path.exists() {
        fs::remove_file(path).map_err(|error| error.to_string())?;
    }

    Ok(())
}

fn save_device_password(app: &AppHandle, file_id: &str, password: &str) -> Result<(), String> {
    let path = device_credential_file_path(app, file_id)?;

    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }

    let encrypted = dpapi_protect(password.as_bytes())?;
    fs::write(path, encrypted).map_err(|error| error.to_string())
}

fn read_device_password(app: &AppHandle, file_id: &str) -> Result<String, String> {
    let path = device_credential_file_path(app, file_id)?;
    let encrypted = fs::read(path).map_err(|error| error.to_string())?;
    let plaintext = dpapi_unprotect(&encrypted)?;

    String::from_utf8(plaintext).map_err(|error| error.to_string())
}

fn dpapi_protect(value: &[u8]) -> Result<Vec<u8>, String> {
    let input = CRYPT_INTEGER_BLOB {
        cbData: value.len() as u32,
        pbData: value.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();

    unsafe {
        CryptProtectData(
            &input,
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
        .map_err(|error| error.to_string())?;

        let encrypted = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        let _ = LocalFree(Some(HLOCAL(output.pbData.cast())));
        Ok(encrypted)
    }
}

fn dpapi_unprotect(value: &[u8]) -> Result<Vec<u8>, String> {
    let input = CRYPT_INTEGER_BLOB {
        cbData: value.len() as u32,
        pbData: value.as_ptr() as *mut u8,
    };
    let mut output = CRYPT_INTEGER_BLOB::default();

    unsafe {
        CryptUnprotectData(
            &input,
            None,
            None,
            None,
            None,
            CRYPTPROTECT_UI_FORBIDDEN,
            &mut output,
        )
        .map_err(|error| error.to_string())?;

        let plaintext = std::slice::from_raw_parts(output.pbData, output.cbData as usize).to_vec();
        let _ = LocalFree(Some(HLOCAL(output.pbData.cast())));
        Ok(plaintext)
    }
}
