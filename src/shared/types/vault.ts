export type DataFileHeader = {
  app: string;
  formatVersion: number;
  fileId: string;
  createdAt: string;
  updatedAt: string;
  schemaVersion: number;
  encryption: {
    algorithm: string;
    kdf: string;
    salt: string;
    nonce: string;
  };
};

export type VaultStatus = {
  active: boolean;
  selectedDataFilePath: string | null;
  activeDataFilePath: string | null;
  fileId: string | null;
  schemaVersion: number | null;
  dataFileUpdatedAt: string | null;
  dataFileModifiedAt: string | null;
  deviceId: string;
  credentialSaved: boolean;
  autoUnlockError: string | null;
};

export type DataFileValidation = {
  valid: boolean;
  header: DataFileHeader | null;
  error: string | null;
};

export type SafetyCopyInfo = {
  fileName: string;
  path: string;
  sizeBytes: number;
  modifiedAt: string | null;
};

export type DataFileCredentials = {
  path: string;
  password: string;
};
