import { registerPlugin } from '@capacitor/core';

export interface CameraAccessPlugin {
  /**
   * Открывает системный file picker для выбора множественных файлов
   * Поддерживает MTP устройства (камеры) на Android
   */
  pickFiles(): Promise<{ files: FileData[] }>;
}

export interface FileData {
  name: string;
  size: number;
  type: string;
  uri: string;
  data: string; // base64 encoded content
  error?: string;
}

const CameraAccess = registerPlugin<CameraAccessPlugin>('CameraAccess', {
  web: () => import('./cameraAccessWeb').then(m => new m.CameraAccessWeb()),
});

export default CameraAccess;
