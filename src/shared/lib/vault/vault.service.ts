import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

import type {
  DataFileCredentials,
  DataFileValidation,
  SafetyCopyInfo,
  VaultStatus,
} from "@/shared/types/vault";

export async function suggestDataFilePath() {
  return invoke<string>("suggest_data_file_path");
}

export async function selectDataFilePath(defaultPath?: string) {
  const selected = await open({
    multiple: false,
    directory: false,
    title: "Selecionar cofre Praxis",
    defaultPath,
    filters: [
      {
        name: "Cofre Praxis",
        extensions: ["praxis"],
      },
    ],
  });

  return typeof selected === "string" ? selected : null;
}

export async function selectNewDataFilePath(defaultPath?: string) {
  const selected = await save({
    title: "Criar cofre Praxis",
    defaultPath,
    filters: [
      {
        name: "Cofre Praxis",
        extensions: ["praxis"],
      },
    ],
  });

  return selected ? ensurePraxisExtension(selected) : null;
}

function ensurePraxisExtension(path: string) {
  return path.toLowerCase().endsWith(".praxis") ? path : `${path}.praxis`;
}

export async function getVaultStatus() {
  return invoke<VaultStatus>("get_vault_status");
}

export async function validateDataFile(path: string) {
  return invoke<DataFileValidation>("validate_data_file", { path });
}

export async function listSafetyCopies() {
  return invoke<SafetyCopyInfo[]>("list_safety_copies");
}

export async function getSafetyCopiesDir() {
  return invoke<string>("get_safety_copies_dir");
}

export async function reloadActiveDataFile() {
  return invoke<VaultStatus>("reload_active_data_file");
}

export async function createDataFile(credentials: DataFileCredentials) {
  return invoke<VaultStatus>("create_data_file", credentials);
}

export async function openDataFile(credentials: DataFileCredentials) {
  return invoke<VaultStatus>("open_data_file", credentials);
}

export async function closeDataFile() {
  return invoke<VaultStatus>("close_data_file");
}
