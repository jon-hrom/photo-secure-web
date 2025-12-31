import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

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
  [key: string]: any;
}

interface PhotoExifDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  s3Key: string;
  fileName: string;
  photoUrl?: string;
}

const PhotoExifDialog = ({ open, onOpenChange, s3Key, fileName, photoUrl }: PhotoExifDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [exifData, setExifData] = useState<ExifData | null>(null);

  useEffect(() => {
    if (open && s3Key) {
      fetchExifData();
    }
  }, [open, s3Key]);

  const fetchExifData = async () => {
    setLoading(true);
    try {
      const response = await fetch(EXTRACT_EXIF_API, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ s3_key: s3Key }),
      });

      if (!response.ok) {
        throw new Error('Не удалось загрузить EXIF данные');
      }

      const data = await response.json();
      setExifData(data.exif || {});
    } catch (error: any) {
      toast.error(`Ошибка: ${error.message}`);
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

  const renderMainInfo = () => {
    if (!exifData) return null;

    const camera = [exifData.Make, exifData.Model].filter(Boolean).join(' ');
    const cameraSerial = exifData.SerialNumber || exifData.BodySerialNumber || exifData.InternalSerialNumber;
    const lens = exifData.LensModel || exifData.Lens;
    const lensSerial = exifData.LensSerialNumber;
    const dateOriginal = exifData.DateTimeOriginal || exifData.DateTime;
    const resolution = exifData.ImageWidth && exifData.ImageHeight
      ? `${exifData.ImageWidth} × ${exifData.ImageHeight}`
      : null;

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

        {dateOriginal && (
          <div className="flex items-start gap-3">
            <Icon name="Calendar" size={20} className="text-muted-foreground mt-0.5" />
            <div>
              <div className="text-sm font-medium text-muted-foreground">Дата съёмки</div>
              <div className="text-base font-semibold">{formatDateTime(dateOriginal)}</div>
            </div>
          </div>
        )}

        {resolution && (
          <div className="flex items-start gap-3">
            <Icon name="Maximize2" size={20} className="text-muted-foreground mt-0.5" />
            <div>
              <div className="text-sm font-medium text-muted-foreground">Разрешение</div>
              <div className="text-base font-semibold">{resolution}</div>
              {exifData.Format && (
                <Badge variant="outline" className="mt-1">{exifData.Format}</Badge>
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Icon name="Loader2" size={32} className="animate-spin text-primary" />
          </div>
        )}

        {!loading && exifData && (
          <div className="space-y-4">
            {renderMainInfo()}
            {renderSettings()}
            {renderAdditionalInfo()}
          </div>
        )}

        {!loading && exifData && Object.keys(exifData).length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <Icon name="AlertCircle" size={32} className="mx-auto mb-2" />
            <p>EXIF данные отсутствуют</p>
          </div>
        )}

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