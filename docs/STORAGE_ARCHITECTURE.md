# Praxis Storage Architecture

Praxis stores user data in a portable encrypted `.praxis` file. This file is the source of truth, not a backup artifact. The user can place it in a local folder or in a synced folder such as Google Drive or OneDrive.

## Goals

- Keep task data local-first and private.
- Let the user choose where the data file lives.
- Make the data file portable across devices.
- Allow cloud-folder sync without trusting the cloud provider.
- Detect wrong passwords, corrupted files, and unsafe writes.

## File Contract

Extension:

```text
.praxis
```

High-level structure:

```json
{
  "header": {
    "app": "praxis",
    "format_version": 1,
    "file_id": "uuid",
    "created_at": "ISO timestamp",
    "updated_at": "ISO timestamp",
    "schema_version": 1,
    "encryption": {
      "algorithm": "XChaCha20-Poly1305",
      "kdf": "Argon2id",
      "salt": "base64",
      "nonce": "base64"
    }
  },
  "ciphertext": "base64"
}
```

The header is public metadata. The body is authenticated encrypted data.

## Encryption

Initial implementation:

- KDF: Argon2id
- Cipher: XChaCha20-Poly1305
- Salt: random 16 bytes
- Nonce: random 24 bytes
- Password: provided by the user

The password is never stored. The derived key lives only in process memory while the file is unlocked.

## Plaintext Document

The first encrypted document is intentionally empty but schema-ready:

```json
{
  "schemaVersion": 1,
  "tasks": [],
  "tags": [],
  "taskTags": [],
  "checklistItems": [],
  "reminders": [],
  "recurrenceRules": [],
  "lifecycleEvents": [],
  "settings": {},
  "metadata": {
    "createdAt": "ISO timestamp",
    "updatedAt": "ISO timestamp"
  }
}
```

## Local Settings

Local settings are stored outside the `.praxis` file and are machine-specific.

They can include:

- selected data file path
- device id
- local UI preferences

They must not include:

- raw passwords
- raw encryption keys
- task data

## Device Credential Cache

Praxis remembers a trusted device unlock using two layers:

- OS credential store through `keyring`
- Windows DPAPI encrypted fallback under app data `device-credentials/`

The DPAPI fallback exists because the Windows Credential Manager can fail to return a previously saved keyring entry in some app packaging/runtime transitions.

Rules:

- The fallback stores the file password only after Windows DPAPI encrypts it for the current user profile.
- The fallback is machine/user local and is not stored inside the portable `.praxis` file.
- Clicking `Bloquear cofre` deletes both the keyring credential and the DPAPI fallback file.
- Exiting through tray `Sair` must not delete remembered credentials.

## Commands

Initial Tauri commands:

- `suggest_data_file_path`
- `create_data_file`
- `open_data_file`
- `validate_data_file`
- `get_vault_status`
- `close_data_file`
- `reload_active_data_file`
- `list_safety_copies`
- `get_safety_copies_dir`

## Conflict Safety

Before write commands mutate the `.praxis` file, Praxis now:

- check whether the file still exists
- check whether the file size or modification timestamp changed since it was opened/last written by Praxis
- create a local safety copy before writing
- refuse to overwrite externally changed files
- preserve the externally changed file as a conflict safety copy
- allow the active vault fingerprint to be refreshed through `reload_active_data_file` after the UI/user chooses to trust the on-disk version

Current implementation:

- file fingerprint: byte length + modified timestamp in milliseconds
- safety copy directory: app data `safety-copies/`
- normal write copy suffix: `before-write`
- external conflict copy suffix: `external-conflict`
- conflict behavior: return an error and do not overwrite the selected `.praxis` file

Current limitation:

- The user-facing conflict resolution screen is not implemented yet.
- The Rust API already exposes safety copy listing and active-file reload.
- A future UI should offer reload, compare/merge, or create a new conflict file explicitly.
- Task hydration avoids writing when no recurrence/reminder data changed.

## Implementation Order

1. Create/open/validate encrypted `.praxis` files.
2. Store selected file path locally.
3. Add locked/unlocked UI states.
4. Add encrypted read/write helpers for future domain repositories.
5. Implement tasks on top of this storage boundary.
6. Add user-facing conflict resolution.
