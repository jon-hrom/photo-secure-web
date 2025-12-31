import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

const EXTRACT_EXIF_API = 'https://functions.poehali.dev/340b5361-292f-4f16-8d31-f179fa6856b1';

interface ExifData {
  Make?: string;
  Model?: string;
  DateTime?: string;
  DateTimeOriginal?: string;
  ExposureTime?: string;
  FNumber?: string;
  ISO?: string;
  ISOSpeedRatings?: string;
  FocalLength?: string;
  LensModel?: string;
  Flash?: string;
  WhiteBalance?: string;
  ImageWidth?: number;
  ImageHeight?: number;
  Format?: string;
  Orientation?: string;
  Software?: string;
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
  const [showAllData, setShowAllData] = useState(false);

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
    const lens = exifData.LensModel;
    const dateOriginal = exifData.DateTimeOriginal || exifData.DateTime;
    const resolution = exifData.ImageWidth && exifData.ImageHeight
      ? `${exifData.ImageWidth} × ${exifData.ImageHeight}`
      : null;

    return (
      <div className="space-y-4">
        {camera && (
          <div className="flex items-start gap-3">
            <Icon name="Camera" size={20} className="text-muted-foreground mt-0.5" />
            <div>
              <div className="text-sm font-medium text-muted-foreground">Камера</div>
              <div className="text-base font-semibold">{camera}</div>
            </div>
          </div>
        )}

        {lens && (
          <div className="flex items-start gap-3">
            <Icon name="Focus" size={20} className="text-muted-foreground mt-0.5" />
            <div>
              <div className="text-sm font-medium text-muted-foreground">Объектив</div>
              <div className="text-base font-semibold">{lens}</div>
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
    const software = exifData.Software;
    const colorSpace = exifData.ColorSpace;
    const orientation = exifData.Orientation;
    const contrast = exifData.Contrast;
    const saturation = exifData.Saturation;
    const sharpness = exifData.Sharpness;
    const sceneType = exifData.SceneType;
    const lightSource = exifData.LightSource;
    const digitalZoom = exifData.DigitalZoomRatio;
    const exposureCompensation = exifData.ExposureBiasValue;

    const hasInfo = flash || whiteBalance || software || colorSpace || orientation || 
                     contrast || saturation || sharpness || sceneType || lightSource || 
                     digitalZoom || exposureCompensation;

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
          {colorSpace && (
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Цветовое пространство</span>
              <span className="font-medium">{colorSpace === '1' ? 'sRGB' : colorSpace === '65535' ? 'Adobe RGB' : colorSpace}</span>
            </div>
          )}
          {orientation && (
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Ориентация</span>
              <span className="font-medium">
                {orientation === '1' ? 'Горизонтальная' : orientation === '6' ? 'Повёрнуто 90° CW' : orientation === '8' ? 'Повёрнуто 90° CCW' : orientation === '3' ? 'Повёрнуто 180°' : orientation}
              </span>
            </div>
          )}
          {contrast && (
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Контраст</span>
              <span className="font-medium">{contrast === '0' ? 'Нормальный' : contrast === '1' ? 'Низкий' : contrast === '2' ? 'Высокий' : contrast}</span>
            </div>
          )}
          {saturation && (
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Насыщенность</span>
              <span className="font-medium">{saturation === '0' ? 'Нормальная' : saturation === '1' ? 'Низкая' : saturation === '2' ? 'Высокая' : saturation}</span>
            </div>
          )}
          {sharpness && (
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Резкость</span>
              <span className="font-medium">{sharpness === '0' ? 'Нормальная' : sharpness === '1' ? 'Низкая' : sharpness === '2' ? 'Высокая' : sharpness}</span>
            </div>
          )}
          {lightSource && (
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Источник света</span>
              <span className="font-medium">
                {lightSource === '0' ? 'Неизвестно' : lightSource === '1' ? 'Дневной свет' : lightSource === '2' ? 'Флуоресцентный' : lightSource === '3' ? 'Вольфрамовый' : lightSource === '17' ? 'Стандартный A' : lightSource === '18' ? 'Стандартный B' : lightSource === '19' ? 'Стандартный C' : lightSource}
              </span>
            </div>
          )}
          {digitalZoom && digitalZoom !== '0' && digitalZoom !== '1' && (
            <div className="flex flex-col">
              <span className="text-xs text-muted-foreground">Цифровой зум</span>
              <span className="font-medium">{digitalZoom}x</span>
            </div>
          )}
          {software && (
            <div className="flex flex-col col-span-2">
              <span className="text-xs text-muted-foreground">Программное обеспечение</span>
              <span className="font-medium">{software}</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAllExifData = () => {
    if (!exifData || Object.keys(exifData).length === 0) return null;

    // Исключаем уже показанные поля и служебные
    const excludeKeys = [
      'Make', 'Model', 'LensModel', 'DateTimeOriginal', 'DateTime',
      'ImageWidth', 'ImageHeight', 'Format', 'ExposureTime', 'FNumber',
      'ISO', 'ISOSpeedRatings', 'FocalLength', 'FocalLengthIn35mmFilm',
      'Flash', 'WhiteBalance', 'Software', 'ExposureMode', 'ExposureProgram',
      'MeteringMode', 'MaxApertureValue', 'ColorSpace', 'Orientation',
      'Contrast', 'Saturation', 'Sharpness', 'SceneType', 'LightSource',
      'DigitalZoomRatio', 'ExposureBiasValue'
    ];

    const allData = Object.entries(exifData)
      .filter(([key]) => !excludeKeys.includes(key))
      .sort((a, b) => a[0].localeCompare(b[0]));

    if (allData.length === 0) return null;

    return (
      <Collapsible open={showAllData} onOpenChange={setShowAllData}>
        <div className="border-t pt-4 mt-4">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-2 h-auto">
              <span className="font-semibold flex items-center gap-2">
                <Icon name="Code2" size={18} />
                Все данные EXIF ({allData.length} полей)
              </span>
              <Icon
                name={showAllData ? "ChevronUp" : "ChevronDown"}
                size={18}
                className="text-muted-foreground"
              />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3">
            <div className="space-y-1 text-xs max-h-64 overflow-y-auto bg-muted/30 rounded-lg p-3">
              {allData.map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4 py-1">
                  <span className="text-muted-foreground font-medium">{key}:</span>
                  <span className="font-mono text-right break-all">
                    {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
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
            {renderAllExifData()}
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