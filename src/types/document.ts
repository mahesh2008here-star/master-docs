export type DocumentType =
  | 'pdf'
  | 'word'
  | 'excel'
  | 'powerpoint'
  | 'text'
  | 'markdown'
  | 'image'
  | 'other';

export type FileExtension = string;

export interface DocumentItem {
  id: string;
  name: string;
  extension: FileExtension;
  type: DocumentType;
  mimeType?: string;
  size: number; // bytes
  modifiedAt: string;
  createdAt: string;
  isFavorite: boolean;
  isPrivate?: boolean; // Stored inside Secure Vault & hidden from Home/Recent/Search/System Storage
  devicePath?: string; // Native Android internal storage path for scanned documents
  originalDevicePath?: string; // Original public Android storage path before hiding in Vault
  vaultFilePath?: string; // Native Android app-private sandbox file path inside files/secure_vault/
  pageCount: number;
  lastReadPage: number;
  readProgress: number; // 0 - 100 percentage
  dataUri?: string; // Legacy or backup serialization
  content?: string; // Text, Markdown, or cached searchable text
  arrayBuffer?: ArrayBuffer; // Primary local binary payload stored in IndexedDB
}

export interface ReadingSession {
  documentId: string;
  documentName: string;
  extension: FileExtension;
  currentPage: number;
  totalPages: number;
  progressPercent: number;
  lastOpenedAt: string;
}

export type ReaderTheme = 'parchment' | 'white' | 'sepia' | 'ink';

export interface AppSettings {
  themeMode: 'system' | 'light' | 'dark';
  accentColor: string;
  customAccentColor?: string;
  defaultZoom: number;
  pageSpacing: 'compact' | 'normal' | 'relaxed';
  continuousScroll: boolean;
  keepScreenAwake: boolean;
}

export type VaultLockType = 'pin' | 'password';

export interface VaultSecurityConfig {
  lockType: VaultLockType;
  salt: string;
  secretHash: string;
  securityQuestion: string;
  answerHash: string;
  failedAttempts: number;
  lockoutUntil: number | null;
  updatedAt: string;
}

export interface ContributorEntry {
  id: string;
  name: string;
  amount: number;
  note?: string;
  thankYouNote?: string;
  utrMasked: string;
  utrHash: string;
  verifiedAt: string;
}

export type NavigationTab =
  | 'home'
  | 'vault'
  | 'favourites'
  | 'recent'
  | 'settings'
  | 'support'
  | 'search'
  | 'reader';
