import { WebPlugin } from '@capacitor/core';
import type { CameraAccessPlugin, FileData } from './cameraAccess';

export class CameraAccessWeb extends WebPlugin implements CameraAccessPlugin {
  async pickFiles(): Promise<{ files: FileData[] }> {
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.multiple = true;
      input.accept = 'image/*,video/*,.raw,.cr2,.nef,.arw,.dng';

      input.onchange = async () => {
        const files = Array.from(input.files || []);
        
        if (files.length === 0) {
          reject('No files selected');
          return;
        }

        try {
          const fileDataArray: FileData[] = await Promise.all(
            files.map(file => this.convertFileToData(file))
          );
          resolve({ files: fileDataArray });
        } catch (error) {
          reject(error);
        }
      };

      input.oncancel = () => {
        reject('File selection cancelled');
      };

      input.click();
    });
  }

  private async convertFileToData(file: File): Promise<FileData> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        resolve({
          name: file.name,
          size: file.size,
          type: file.type,
          uri: URL.createObjectURL(file),
          data: base64,
        });
      };
      
      reader.onerror = () => {
        reject(new Error(`Failed to read file: ${file.name}`));
      };
      
      reader.readAsDataURL(file);
    });
  }
}
