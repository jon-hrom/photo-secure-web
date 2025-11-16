import type { PhotobookConfig, PhotoSlot, UploadedPhoto } from '@/components/photobook/PhotobookCreator';

export const generatePhotobookPDF = async (
  config: PhotobookConfig,
  spreads: Array<{ id: string; slots: PhotoSlot[] }>,
  photos: UploadedPhoto[]
): Promise<Blob> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    canvas.width = 1000;
    canvas.height = 600;
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.fillStyle = '#000';
    ctx.font = '24px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Фотокнига', canvas.width / 2, canvas.height / 2);
    ctx.fillText(`Формат: ${config.format}`, canvas.width / 2, canvas.height / 2 + 40);
    ctx.fillText(`Разворотов: ${spreads.length}`, canvas.width / 2, canvas.height / 2 + 80);

    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      }
    }, 'application/pdf');
  });
};

export const downloadPDF = async (
  config: PhotobookConfig,
  spreads: Array<{ id: string; slots: PhotoSlot[] }>,
  photos: UploadedPhoto[],
  filename: string = 'photobook.pdf'
) => {
  const blob = await generatePhotobookPDF(config, spreads, photos);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
