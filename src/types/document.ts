export type DocumentType = 'pdf' | 'word' | 'excel' | 'powerpoint' | 'text' | 'markdown' | 'other';

export type FileExtension = 'pdf' | 'docx' | 'doc' | 'xlsx' | 'xls' | 'csv' | 'pptx' | 'ppt' | 'txt' | 'md' | string;

export interface DocumentItem {
  id: string;
  name: string;
  extension: FileExtension;
  type: DocumentType;
  size: number; // bytes
  modifiedAt: string;
  createdAt: string;
  isFavorite: boolean;
  isLocked?: boolean;
  pageCount?: number;
  lastReadPage?: number;
  readProgress?: number; // 0 - 100 percentage
  dataUri?: string; // Base64 data or Blob URL
  content?: string; // Text content if plain text / extracted text
  arrayBuffer?: ArrayBuffer;
  thumbnail?: string;
  path?: string;
}

export interface ReadingSession {
  documentId: string;
  documentName: string;
  extension: FileExtension;
  currentPage: number;
  totalPages: number;
  progressPercent: number;
  lastOpenedAt: string;
  timeSpentSeconds: number;
}

export type ReaderTheme = 'parchment' | 'white' | 'sepia' | 'ink';

export interface AppSettings {
  themeMode: 'system' | 'light' | 'dark';
  accentColor: string; // e.g. '#a92f2e'
  customAccentColor?: string; // hex color picker value
  defaultZoom: number; // e.g. 100
  pageSpacing: 'compact' | 'normal' | 'relaxed';
  continuousScroll: boolean;
  keepScreenAwake: boolean;
  autoSaveProgress: boolean;
  encryptVault: boolean;
}

export type NavigationTab = 'home' | 'files' | 'favourites' | 'recent' | 'settings' | 'search' | 'reader';
