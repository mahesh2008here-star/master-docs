import { Filesystem } from '@capacitor/filesystem';

export async function requestAndroidStoragePermissions(): Promise<boolean> {
  try {
    const status = await Filesystem.checkPermissions();
    if (status.publicStorage !== 'granted') {
      const request = await Filesystem.requestPermissions();
      return request.publicStorage === 'granted';
    }
    return true;
  } catch (error) {
    console.warn('Storage permission request handled on web/browser platform:', error);
    return true;
  }
}
