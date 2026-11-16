import { Capacitor } from '@capacitor/core';
import { Filesystem } from '@capacitor/filesystem';

export async function requestAndroidStoragePermissions(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    return true;
  }
  try {
    const status = await Filesystem.checkPermissions();
    if (status.publicStorage !== 'granted') {
      const request = await Filesystem.requestPermissions();
      return request.publicStorage === 'granted';
    }
    return true;
  } catch (error) {
    console.warn('Storage permission check skipped:', error);
    return true;
  }
}
