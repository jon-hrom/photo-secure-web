import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

const EXTRACT_EXIF_API = 'https://functions.poehali.dev/340b5361-292f-4f16-8d31-f179fa6856b1';

interface ExifData {
  Make?: string;
  Model?: string;
  SerialNumber?: string;
  BodySerialNumber?: string;
  InternalSerialNumber?: string;
  DateTime?: string;
  DateTimeOriginal?: string;
  ExposureTime?: string;
  FNumber?: string;
  ISO?: string;
  ISOSpeedRatings?: string;
  FocalLength?: string;
  FocalLengthIn35mmFilm?: string;
  LensModel?: string;
  Lens?: string;
  LensSerialNumber?: string;
  Flash?: string;
  WhiteBalance?: string;
  ImageWidth?: number;
  ImageHeight?: number;
  Format?: string;
  Orientation?: string;
  Software?: string;
  ExposureMode?: string;
  ExposureProgram?: string;
  MeteringMode?: string;
  MaxApertureValue?: string;
  ExposureBiasValue?: string;
  [key: string]: string | number | undefined;
}

interface PhotoFileInfo {
  file_size?: number | null;
  width?: number | null;
  height?: number | null;
  shot_date?: string | null;
  created_at?: string | null;
  content_type?: string | null;
  is_raw?: boolean;
  is_video?: boolean;
}

interface PhotoExifDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  s3Key: string;
  fileName: string;
  photoUrl?: string;
  photo?: PhotoFileInfo;
}

const PhotoExifDialog = ({ open, onOpenChange, s3Key, fileName, photoUrl, photo }: PhotoExifDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [exifData, setExifData] = useState<ExifData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open && s3Key) {
      fetchExifData();
    }
  }, [open, s3Key]);

  const fetchExifData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(EXTRACT_EXIF_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ s3_key: s3Key }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || errorData.details || 'Не удалось загрузить EXIF данные');
      }

      const data = await response.json();
      setExifData(data.exif || {});
    } catch (error) {
      console.error('[EXIF_DIALOG] Error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Не удалось загрузить EXIF данные';
      setError(errorMessage);
      setExifData(null);
    } finally {
      setLoading(false);
    }
  };

  const formatExposureTime = (value: string) => {
    const match = value.match(/(\d+)\/(\d+)/);
    if (match) {
      const numerator = parseInt(match[1]);
      const denominator = parseInt(match[2]);
      if (denominator > numerator) {
        return `1/${Math.round(denominator / numerator)}`;
      }
    }
    return value;
  };

  const formatFNumber = (value: string) => {
    const match = value.match(/(\d+)\/(\d+)/);
    if (match) {
      const result = parseInt(match[1]) / parseInt(match[2]);
      return `f/${result.toFixed(1)}`;
    }
    return `f/${value}`;
  };

  const formatFocalLength = (value: string) => {
    const match = value.match(/(\d+)\/(\d+)/);
    if (match) {
      const result = parseInt(match[1]) / parseInt(match[2]);
      return `${Math.round(result)}mm`;
    }
    return `${value}mm`;
  };

  const formatDateTime = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleString('ru-RU', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const getFlashText = (value: string) => {
    const flashMap: { [key: string]: string } = {
      '0': 'Без вспышки',
      '1': 'Вспышка сработала',
      '5': 'Вспышка сработала (без определения)',
      '7': 'Вспышка сработала (принудительно)',
      '9': 'Вспышка сработала (принудительно, без подавления)',
      '13': 'Вспышка сработала (принудительно, с подавлением)',
      '16': 'Вспышка не сработала',
      '24': 'Вспышка не сработала (принудительно)',
      '32': 'Вспышка не сработала (авто)',
    };
    return flashMap[value] || value;
  };

  const formatBytes = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) return null;
    const units = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
  };

  const formatFileType = () => {
    if (photo?.is_video) return 'Видео';
    if (photo?.is_raw) return 'RAW';
    const ext = fileName.includes('.') ? fileName.split('.').pop()?.toUpperCase() : null;
    if (ext) return ext;
    if (photo?.content_type) return photo.content_type;
    return null;
  };

  const renderFileInfo = () => {
    const size = formatBytes(photo?.file_size);
    const w = photo?.width || (exifData?.ImageWidth as number | undefined) || null;
    const h = photo?.height || (exifData?.ImageHeight as number | undefined) || null;
    const resolution = w && h ? `${w} × ${h}` : null;
    const megapixels = w && h
      ? `${((w * h) / 1_000_000).toFixed(1)} Мп`
      : null;
    const shotSrc = photo?.shot_date || (exifData?.DateTimeOriginal as string | undefined) || (exifData?.DateTime as string | undefined) || null;
    const shot = shotSrc ? formatDateTime(shotSrc) : null;
    const uploaded = photo?.created_at ? formatDateTime(photo.created_at) : null;
    const fileType = formatFileType();

    const rows: { label: string; value: string; icon: string }[] = [];
    if (size) rows.push({ label: 'Размер файла', value: size, icon: 'HardDrive' });
    if (resolution) rows.push({ label: 'Разрешение', value: megapixels ? `${resolution} (${megapixels})` : resolution, icon: 'Maximize2' });
    if (shot) rows.push({ label: 'Дата съёмки', value: shot, icon: 'Calendar' });
    if (uploaded) rows.push({ label: 'Дата загрузки', value: uploaded, icon: 'Upload' });
    if (fileType) rows.push({ label: 'Тип файла', value: fileType, icon: 'FileImage' });

    if (rows.length === 0) return null;

    return (
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3">
            <Icon name={row.icon} size={20} className="text-muted-foreground mt-0.5" />
            <div>
              <div className="text-sm font-medium text-muted-foreground">{row.label}</div>
              <div className="text-base font-semibold">{row.value}</div>
            </div>
          </div>
        ))}
      </div>
    );
  };

  const renderMainInfo = () => {
    if (!exifData) return null;

    const camera = [exifData.Make, exifData.Model].filter(Boolean).join(' ');
    const cameraSerial = exifData.SerialNumber || exifData.BodySerialNumber || exifData.InternalSerialNumber;
    const lens = exifData.LensModel || exifData.Lens;
    const lensSerial = exifData.LensSerialNumber;

    return (
      <div className="space-y-4">
        {camera && (
          <div className="flex items-start gap-3">
            <Icon name="Camera" size={20} className="text-muted-foreground mt-0.5" />
            <div className="w-full">
              <div className="text-sm font-medium text-muted-foreground">Камера</div>
              <div className="text-base font-semibold">{camera}</div>
              {cameraSerial && (
                <div className="text-xs text-muted-foreground mt-1">Серийный номер: {cameraSerial}</div>
              )}
            </div>
          </div>
        )}

        {lens && (
          <div className="flex items-start gap-3">
            <Icon name="Focus" size={20} className="text-muted-foreground mt-0.5" />
            <div className="w-full">
              <div className="text-sm font-medium text-muted-foreground">Объектив</div>
              <div className="text-base font-semibold">{lens}</div>
              {lensSerial && (
                <div className="text-xs text-muted-foreground mt-1">Серийный номер: {lensSerial}</div>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderSettings = () => {
    if (!exifData) return null;

    const exposureTime = exifData.ExposureTime;
    const fNumber = exifData.FNumber;
    const iso = exifData.ISOSpeedRatings || exifData.ISO;
    const focalLength = exifData.FocalLength;
    const focalLength35mm = exifData.FocalLengthIn35mmFilm;
    const exposureMode = exifData.ExposureMode;
    const exposureProgram = exifData.ExposureProgram;
    const meteringMode = exifData.MeteringMode;
    const maxAperture = exifData.MaxApertureValue;

    const hasSettings = exposureTime || fNumber || iso || focalLength;

    if (!hasSettings) return null;

    return (
      <div className="border-t pt-4 mt-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Icon name="Settings" size={18} />
          Параметры съёмки
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {exposureTime && (
            <div>
              <div className="text-xs text-muted-foreground">Выдержка</div>
              <div className="font-mono text-sm font-semibold">{formatExposureTime(exposureTime)}s</div>
            </div>
          )}
          {fNumber && (
            <div>
              <div className="text-xs text-muted-foreground">Диафрагма</div>
              <div className="font-mono text-sm font-semibold">{formatFNumber(fNumber)}</div>
            </div>
          )}
          {iso && (
            <div>
              <div className="text-xs text-muted-foreground">ISO</div>
              <div className="font-mono text-sm font-semibold">ISO {iso}</div>
            </div>
          )}
          {focalLength && (
            <div>
              <div className="text-xs text-muted-foreground">Фокусное расстояние</div>
              <div className="font-mono text-sm font-semibold">
                {formatFocalLength(focalLength)}
                {focalLength35mm && ` (${focalLength35mm}mm экв.)`}
              </div>
            </div>
          )}
          {maxAperture && (
            <div>
              <div className="text-xs text-muted-foreground">Макс. диафрагма</div>
              <div className="font-mono text-sm font-semibold">{formatFNumber(maxAperture)}</div>
            </div>
          )}
          {meteringMode && (
            <div>
              <div className="text-xs text-muted-foreground">Режим замера</div>
              <div className="font-mono text-sm font-semibold">
                {meteringMode === '5' ? 'Матричный' : meteringMode === '3' ? 'Точечный' : meteringMode === '2' ? 'Центровзвешенный' : meteringMode}
              </div>
            </div>
          )}
          {exposureProgram && (
            <div>
              <div className="text-xs text-muted-foreground">Программа</div>
              <div className="font-mono text-sm font-semibold">
                {exposureProgram === '1' ? 'Ручная' : exposureProgram === '2' ? 'Авто' : exposureProgram === '3' ? 'Приоритет диафрагмы' : exposureProgram === '4' ? 'Приоритет выдержки' : exposureProgram}
              </div>
            </div>
          )}
          {exposureMode && (
            <div>
              <div className="text-xs text-muted-foreground">Режим экспозиции</div>
              <div className="font-mono text-sm font-semibold">
                {exposureMode === '0' ? 'Авто' : exposureMode === '1' ? 'Ручная' : exposureMode === '2' ? 'Брекетинг' : exposureMode}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAdditionalInfo = () => {
    if (!exifData) return null;

    const flash = exifData.Flash;
    const whiteBalance = exifData.WhiteBalance;
    const exposureCompensation = exifData.ExposureBiasValue;

    const hasInfo = flash || whiteBalance || exposureCompensation;

    if (!hasInfo) return null;

    return (
      <div className="border-t pt-4 mt-4">
        <h3 className="font-semibold mb-3 flex items-center gap-2">
          <Icon name="Info" size={18} />
          Дополнительно
        </h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {flash && (
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Вспышка</span>
              <span className="font-medium">{getFlashText(flash)}</span>
            </div>
          )}
          {whiteBalance && (
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Баланс белого</span>
              <span className="font-medium">{whiteBalance === '0' ? 'Авто' : 'Ручной'}</span>
            </div>
          )}
          {exposureCompensation && exposureCompensation !== '0' && (
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Компенсация экспозиции</span>
              <span className="font-medium">{exposureCompensation} EV</span>
            </div>
          )}
        </div>
      </div>
    );
  };



  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[100dvh] sm:max-h-[90vh] w-full sm:w-auto overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Info" size={24} />
            Информация о фото
          </DialogTitle>
        </DialogHeader>

        {photoUrl && (
          <div className="rounded-lg overflow-hidden border">
            <img src={photoUrl} alt={fileName} className="w-full h-auto" />
          </div>
        )}

        <div className="text-sm font-medium text-muted-foreground mb-2">{fileName}</div>

        {(() => {
          const fileInfo = renderFileInfo();
          const hasExif = exifData && Object.keys(exifData).length > 0;
          return (
            <div className="space-y-4">
              {fileInfo}

              {loading && (
                <div className="flex items-center justify-center py-6">
                  <Icon name="Loader2" size={28} className="animate-spin text-primary" />
                  <span className="ml-2 text-sm text-muted-foreground">Читаем EXIF из файла…</span>
                </div>
              )}

              {!loading && hasExif && (
                <div className={fileInfo ? 'border-t pt-4' : ''}>
                  {renderMainInfo()}
                  {renderSettings()}
                  {renderAdditionalInfo()}
                </div>
              )}

              {!loading && !hasExif && !error && fileInfo && (
                <div className="border-t pt-3 text-xs text-muted-foreground flex items-center gap-2">
                  <Icon name="Info" size={14} />
                  <span>Расширенные EXIF-данные (камера, объектив, ISO) в этом файле отсутствуют.</span>
                </div>
              )}

              {!loading && !hasExif && !fileInfo && !error && (
                <div className="text-center py-8 text-muted-foreground">
                  <Icon name="AlertCircle" size={32} className="mx-auto mb-2" />
                  <p>Дополнительная информация о фото недоступна</p>
                </div>
              )}

              {!loading && error && (
                <div className="border-t pt-4 text-center">
                  <p className="text-sm text-muted-foreground mb-2">Не удалось прочитать EXIF из файла</p>
                  <Button onClick={fetchExifData} variant="outline" size="sm">
                    <Icon name="RefreshCw" size={16} className="mr-2" />
                    Попробовать снова
                  </Button>
                </div>
              )}
            </div>
          );
        })()}

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Закрыть
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoExifDialog;