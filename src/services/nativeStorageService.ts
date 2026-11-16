import { Capacitor, registerPlugin } from '@capacitor/core';
import { DocumentItem } from '../types/document';
import {
  dataUriToUint8Array,
  decodeTextBytes,
  detectDocumentFormat,
} from '../utils/fileHelpers';

interface ScannedNativeFile {
  name: string;
  path: string;
  extension: string;
  size: number;
  modifiedAt: string;
}

interface StorageVaultPluginInterface {
  checkAllFilesPermission(): Promise<{ granted: boolean; sdkInt: number }>;
  requestAllFilesPermission(): Promise<{ granted: boolean; openedSettings: boolean }>;
  scanDeviceDocuments(): Promise<{ granted: boolean; files: ScannedNativeFile[] }>;
  readDeviceFileBase64(options: { path: string }): Promise<{ base64: string; size: number }>;
  hideFileInVaultStorage(options: {
    path: string;
    vaultId: string;
  }): Promise<{ hidden: boolean; deletedOriginal: boolean; vaultFilePath: string }>;
  savePrivateBytesToVault(options: {
    base64: string;
    vaultId: string;
  }): Promise<{ vaultFilePath: string }>;
  restoreVaultFileToStorage(options: {
    vaultFilePath: string;
    originalPath: string;
  }): Promise<{ restored: boolean }>;
  deleteVaultSandboxFile(options: { vaultFilePath: string }): Promise<{ deleted: boolean }>;
  openUpiPayment(options: {
    upiUri: string;
  }): Promise<{ launched: boolean; error?: string }>;
}

const StorageVault = registerPlugin<StorageVaultPluginInterface>('StorageVault');

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function checkAllFilesStoragePermission(): Promise<boolean> {
  if (isNativeAndroid()) {
    try {
      const res = await StorageVault.checkAllFilesPermission();
      return Boolean(res.granted);
    } catch (err) {
      console.warn('checkAllFilesPermission failed:', err);
      return false;
    }
  }
  return localStorage.getItem('masterdocs_storage_onboarding_done') === 'granted';
}

export async function requestAllFilesStoragePermission(): Promise<{
  granted: boolean;
  openedSettings: boolean;
}> {
  if (isNativeAndroid()) {
    try {
      return await StorageVault.requestAllFilesPermission();
    } catch (err) {
      console.warn('requestAllFilesPermission failed:', err);
      return { granted: false, openedSettings: false };
    }
  }
  localStorage.setItem('masterdocs_storage_onboarding_done', 'granted');
  return { granted: true, openedSettings: false };
}

export async function scanAllDeviceDocuments(): Promise<DocumentItem[]> {
  if (!isNativeAndroid()) {
    return [];
  }

  const res = await StorageVault.scanDeviceDocuments();
  if (!res.granted || !Array.isArray(res.files)) {
    return [];
  }

  const items: DocumentItem[] = [];
  for (const f of res.files) {
    const ext = (f.extension || 'txt').toLowerCase();
    const { type } = await detectDocumentFormat(new Uint8Array(0), f.name);
    items.push({
      id: `device-${btoa(unescape(encodeURIComponent(f.path))).replace(/=+$/, '')}`,
      name: f.name,
      extension: ext,
      type,
      size: Number(f.size) || 0,
      modifiedAt: f.modifiedAt || new Date().toISOString(),
      createdAt: f.modifiedAt || new Date().toISOString(),
      isFavorite: false,
      isPrivate: false,
      devicePath: f.path,
      pageCount: 1,
      lastReadPage: 1,
      readProgress: 0,
    });
  }

  return items.sort(
    (a, b) => new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime()
  );
}

/**
 * Loads bytes on demand for scanned Android internal storage files without
 * saturating IndexedDB or WebView memory during initial scan.
 */
export async function loadScannedDeviceDocument(doc: DocumentItem): Promise<DocumentItem> {
  if (doc.arrayBuffer || doc.dataUri || doc.content || !doc.devicePath || !isNativeAndroid()) {
    return doc;
  }

  const res = await StorageVault.readDeviceFileBase64({ path: doc.devicePath });
  const bytes = dataUriToUint8Array(res.base64);
  const { type, extension } = await detectDocumentFormat(bytes, doc.name);
  const arrayBuffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;

  return {
    ...doc,
    type,
    extension,
    arrayBuffer,
    content: type === 'text' || type === 'markdown' ? decodeTextBytes(bytes) : doc.content,
  };
}

/**
 * Hides a file inside Android app-private sandboxed Vault storage and deletes the
 * public copy from shared internal storage when moved from device storage.
 */
export async function hideDocumentInSystemStorage(
  doc: DocumentItem
): Promise<{ deletedOriginal: boolean; vaultFilePath?: string; originalDevicePath?: string }> {
  if (!isNativeAndroid()) {
    return { deletedOriginal: false };
  }

  try {
    if (doc.devicePath) {
      const res = await StorageVault.hideFileInVaultStorage({
        path: doc.devicePath,
        vaultId: doc.id,
      });
      return {
        deletedOriginal: Boolean(res.deletedOriginal),
        vaultFilePath: res.vaultFilePath,
        originalDevicePath: doc.devicePath,
      };
    }

    if (doc.arrayBuffer) {
      const bytes = new Uint8Array(doc.arrayBuffer);
      let binary = '';
      const chunkSize = 0x8000;
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
      }
      const res = await StorageVault.savePrivateBytesToVault({
        base64: btoa(binary),
        vaultId: doc.id,
      });
      return {
        deletedOriginal: false,
        vaultFilePath: res.vaultFilePath,
      };
    }
  } catch (err) {
    console.warn('hideDocumentInSystemStorage warning:', err);
  }
  return { deletedOriginal: false };
}

export async function restoreDocumentFromVaultStorage(doc: DocumentItem): Promise<boolean> {
  if (!isNativeAndroid() || !doc.vaultFilePath) return false;
  try {
    if (doc.originalDevicePath) {
      const res = await StorageVault.restoreVaultFileToStorage({
        vaultFilePath: doc.vaultFilePath,
        originalPath: doc.originalDevicePath,
      });
      return Boolean(res.restored);
    }
    await StorageVault.deleteVaultSandboxFile({ vaultFilePath: doc.vaultFilePath });
  } catch (err) {
    console.warn('restoreDocumentFromVaultStorage warning:', err);
  }
  return false;
}

export async function deleteVaultSandboxCopy(doc: DocumentItem): Promise<void> {
  if (!isNativeAndroid() || !doc.vaultFilePath) return;
  try {
    await StorageVault.deleteVaultSandboxFile({ vaultFilePath: doc.vaultFilePath });
  } catch {
    // ignore
  }
}

export async function launchUpiPaymentIntent(upiUri: string): Promise<{
  launched: boolean;
  error?: string;
}> {
  if (isNativeAndroid()) {
    try {
      return await StorageVault.openUpiPayment({ upiUri });
    } catch (err: any) {
      return { launched: false, error: err?.message || 'Unable to launch UPI app.' };
    }
  }

  // On mobile Web/PWA, setting location.href triggers installed UPI intent without window.open
  try {
    window.location.href = upiUri;
    return { launched: true };
  } catch {
    return {
      launched: false,
      error: 'No UPI app available in browser. Scan the QR code with GPay, PhonePe, or Paytm.',
    };
  }
}
