import { Capacitor } from '@capacitor/core';
import { Directory, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { DocumentItem } from '../types/document';
import { getDocumentBytes, uint8ArrayToDataUri } from '../utils/fileHelpers';

export async function shareDocumentFile(doc: DocumentItem): Promise<void> {
  const bytes = getDocumentBytes(doc);
  if (!bytes) {
    throw new Error('No file data available to share.');
  }

  if (Capacitor.isNativePlatform()) {
    const safeName = doc.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const dataUri = uint8ArrayToDataUri(bytes, doc.mimeType || 'application/octet-stream');
    const base64Data = dataUri.split(',')[1] || '';

    const writeResult = await Filesystem.writeFile({
      path: safeName,
      data: base64Data,
      directory: Directory.Cache,
    });

    await Share.share({
      title: doc.name,
      url: writeResult.uri,
      dialogTitle: `Open or Share ${doc.name}`,
    });
    return;
  }

  // Web Share API (if supported) or download fallback
  const fileBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([fileBuffer], {
    type: doc.mimeType || 'application/octet-stream',
  });
  const file = new File([blob], doc.name, { type: blob.type });

  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [file] })) {
    await navigator.share({
      title: doc.name,
      files: [file],
    });
    return;
  }

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = doc.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
