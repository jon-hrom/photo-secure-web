import JSZip from 'jszip';
import html2canvas from 'html2canvas';
import type { PhotoSlot, UploadedPhoto } from '@/components/photobook/PhotobookCreator';

interface Spread {
  id: string;
  slots: PhotoSlot[];
}

export async function exportAsJPEG(
  spreads: Spread[],
  photos: UploadedPhoto[],
  quality: number = 95,
  canvasWidth: number = 2000,
  canvasHeight: number = 1000
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder('photobook-jpeg');

  if (!folder) throw new Error('Failed to create ZIP folder');

  for (let i = 0; i < spreads.length; i++) {
    const spread = spreads[i];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) continue;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (const slot of spread.slots) {
      if (!slot.photoId) continue;
      
      const photo = photos.find(p => p.id === slot.photoId);
      if (!photo) continue;

      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = photo.url;
        });

        const scaleX = canvas.width / 1000;
        const scaleY = canvas.height / 600;
        
        ctx.drawImage(
          img,
          slot.x * scaleX,
          slot.y * scaleY,
          slot.width * scaleX,
          slot.height * scaleY
        );
      } catch (error) {
        console.error('Error loading image:', error);
      }
    }

    const jpegBlob = await new Promise<Blob>((resolve) => {
      canvas.toBlob((blob) => resolve(blob!), 'image/jpeg', quality / 100);
    });

    const pageNumber = String(i + 1).padStart(3, '0');
    folder.file(`spread_${pageNumber}.jpg`, jpegBlob);
  }

  return await zip.generateAsync({ type: 'blob' });
}

export async function exportAsPSD(
  spreads: Spread[],
  photos: UploadedPhoto[],
  canvasWidth: number = 2000,
  canvasHeight: number = 1000
): Promise<Blob> {
  const zip = new JSZip();
  const folder = zip.folder('photobook-psd');

  if (!folder) throw new Error('Failed to create ZIP folder');

  for (let i = 0; i < spreads.length; i++) {
    const spread = spreads[i];
    
    const layers = [];
    for (const slot of spread.slots) {
      if (!slot.photoId) continue;
      
      const photo = photos.find(p => p.id === slot.photoId);
      if (!photo) continue;

      layers.push({
        name: slot.id,
        x: slot.x,
        y: slot.y,
        width: slot.width,
        height: slot.height,
        photoUrl: photo.url
      });
    }

    const psdData = generatePSDFile(layers, canvasWidth, canvasHeight);
    
    const pageNumber = String(i + 1).padStart(3, '0');
    folder.file(`spread_${pageNumber}.psd`, psdData);
  }

  return await zip.generateAsync({ type: 'blob' });
}

function generatePSDFile(
  layers: Array<{
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    photoUrl: string;
  }>,
  width: number,
  height: number
): Uint8Array {
  const header = new ArrayBuffer(26);
  const view = new DataView(header);
  
  view.setUint32(0, 0x38425053, false);
  view.setUint16(4, 1, false);
  view.setUint32(18, height, false);
  view.setUint32(14, width, false);
  view.setUint16(12, 8, false);
  view.setUint16(22, 3, false);

  const colorModeSection = new Uint8Array(4);
  new DataView(colorModeSection.buffer).setUint32(0, 0, false);

  const imageResourceSection = new Uint8Array(4);
  new DataView(imageResourceSection.buffer).setUint32(0, 0, false);

  const layerCount = layers.length;
  const layerInfoSize = layerCount * 64 + 8;
  const layerInfo = new ArrayBuffer(layerInfoSize);
  const layerView = new DataView(layerInfo);
  
  layerView.setUint32(0, layerInfoSize - 4, false);
  layerView.setInt16(4, layerCount, false);

  const imageDataSection = new Uint8Array(2);
  new DataView(imageDataSection.buffer).setUint16(0, 0, false);

  const totalSize = 26 + 4 + 4 + layerInfoSize + 2;
  const result = new Uint8Array(totalSize);
  
  let offset = 0;
  result.set(new Uint8Array(header), offset);
  offset += 26;
  result.set(colorModeSection, offset);
  offset += 4;
  result.set(imageResourceSection, offset);
  offset += 4;
  result.set(new Uint8Array(layerInfo), offset);
  offset += layerInfoSize;
  result.set(imageDataSection, offset);

  return result;
}

export async function exportAsPDF(
  spreads: Spread[],
  photos: UploadedPhoto[],
  canvasWidth: number = 2000,
  canvasHeight: number = 1000
): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) throw new Error('Canvas not supported');

  canvas.width = canvasWidth;
  canvas.height = canvasHeight;

  let pdfData = '%PDF-1.4\n';
  
  pdfData += '1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  pdfData += `2 0 obj\n<< /Type /Pages /Kids [`;
  
  for (let i = 0; i < spreads.length; i++) {
    pdfData += `${i + 3} 0 R `;
  }
  
  pdfData += `] /Count ${spreads.length} >>\nendobj\n`;

  for (let i = 0; i < spreads.length; i++) {
    pdfData += `${i + 3} 0 obj\n<< /Type /Page /Parent 2 0 R /Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> /Contents ${spreads.length + i + 3} 0 R /MediaBox [0 0 ${canvas.width} ${canvas.height}] >>\nendobj\n`;
  }

  for (let i = 0; i < spreads.length; i++) {
    pdfData += `${spreads.length + i + 3} 0 obj\n<< /Length 0 >>\nstream\nendstream\nendobj\n`;
  }

  pdfData += 'xref\n';
  pdfData += `0 ${spreads.length * 2 + 3}\n`;
  pdfData += '0000000000 65535 f\n';
  
  for (let i = 0; i < spreads.length * 2 + 2; i++) {
    pdfData += '0000000000 00000 n\n';
  }

  pdfData += 'trailer\n<< /Size ' + (spreads.length * 2 + 3) + ' /Root 1 0 R >>\n';
  pdfData += 'startxref\n0\n%%EOF';

  return new Blob([pdfData], { type: 'application/pdf' });
}

export function downloadFile(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}