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

export type NavigationTab = 'home' | 'files' | 'favourites' | 'recent' | 'settings' | 'search' | 'reader';
