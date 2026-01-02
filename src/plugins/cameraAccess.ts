import { registerPlugin } from '@capacitor/core';

export interface CameraAccessPlugin {
  /**
   * Сканирует доступные даты съёмки на подключенной камере
   * Возвращает список уникальных дат в формате DD.MM.YYYY
   */
  getAvailableDates(): Promise<{ dates: string[] }>;
  
  /**
   * Открывает системный file picker для выбора множественных файлов
   * Поддерживает MTP устройства (камеры) на Android
   * @param options - Опции для фильтрации файлов
   * @param options.filterDate - Дата для фильтрации фото (формат: YYYY-MM-DD)
   */
  pickFiles(options?: { filterDate?: string }): Promise<{ files: FileData[] }>;
}

export interface FileData {
  name: string;
  size: number;
  type: string;
  uri: string;
  data: string; // base64 encoded content
  date?: string; // Дата съёмки из EXIF (формат: YYYY-MM-DD)
  error?: string;
}

const CameraAccess = registerPlugin<CameraAccessPlugin>('CameraAccess', {
  web: () => import('./cameraAccessWeb').then(m => new m.CameraAccessWeb()),
});

export default CameraAccess;