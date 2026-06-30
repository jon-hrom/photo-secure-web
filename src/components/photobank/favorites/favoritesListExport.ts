import { resolveClientPhotos } from './useFavoritesData';
import type { ClientData, Photo } from './useFavoritesData';

// «Номер фото» — это имя файла без расширения, напр. "(12).jpg" -> "(12)".
function photoNumber(fileName: string): string {
  const name = (fileName || '').trim();
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

interface ClientLine {
  fullName: string;
  numbers: string[];
}

function buildClientLines(clients: ClientData[], allPhotos: Photo[]): ClientLine[] {
  return clients
    .map((client) => {
      const photos = resolveClientPhotos(client, allPhotos);
      return {
        fullName: client.full_name || 'Без имени',
        numbers: photos.map((p) => {
          const num = photoNumber(p.file_name);
          if (client.cover_photo_id === p.id) return `(Обложка ${num})`;
          if (client.vignette_photo_id === p.id) return `(Виньетка ${num})`;
          return num;
        }),
      };
    })
    .filter((c) => c.numbers.length > 0);
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Собираем единый HTML-документ списка избранного,
// который используем и для .doc, и для печати.
function buildListHtml(folderName: string, clients: ClientData[], allPhotos: Photo[]): string {
  const lines = buildClientLines(clients, allPhotos);

  const clientsHtml = lines
    .map(
      (c) => `
      <div class="client">
        <p class="client-name">${escapeHtml(c.fullName)}</p>
        <p class="client-photos">${escapeHtml(c.numbers.join(', '))}</p>
      </div>`
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="utf-8" />
<title>${escapeHtml(folderName)}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'Times New Roman', Georgia, serif; font-size: 13pt; line-height: 1.5; color: #000; margin: 0; }
  h1 { font-size: 22pt; font-weight: bold; text-transform: uppercase; text-align: center; margin: 0 0 24px; }
  .client { padding: 12px 0; border-bottom: 1px solid #999; }
  .client-name { font-size: 16pt; font-weight: bold; margin: 0 0 6px; }
  .client-photos { font-size: 13pt; margin: 0; color: #000; }
  .client-photos-label { font-weight: normal; color: #555; }
</style>
</head>
<body>
  <h1>${escapeHtml(folderName)}</h1>
  ${clientsHtml}
</body>
</html>`;
}

// Скачивание списка избранного как документа Word (.doc).
export function downloadFavoritesListDoc(
  folderName: string,
  clients: ClientData[],
  allPhotos: Photo[]
): void {
  const html = buildListHtml(folderName, clients, allPhotos);
  const blob = new Blob(['\ufeff', html], { type: 'application/msword' });
  const url = URL.createObjectURL(blob);
  const safeName = (folderName || 'Избранное').replace(/[\\/:*?"<>|]/g, '_');
  const a = document.createElement('a');
  a.href = url;
  a.download = `${safeName}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Отправка списка избранного на печать через скрытый iframe.
export function printFavoritesList(
  folderName: string,
  clients: ClientData[],
  allPhotos: Photo[]
): void {
  const html = buildListHtml(folderName, clients, allPhotos);
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    document.body.removeChild(iframe);
    return;
  }
  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    setTimeout(() => {
      if (iframe.parentNode) document.body.removeChild(iframe);
    }, 1000);
  };

  if (iframe.contentWindow) {
    iframe.contentWindow.onafterprint = () => {
      if (iframe.parentNode) document.body.removeChild(iframe);
    };
  }
  setTimeout(triggerPrint, 250);
}