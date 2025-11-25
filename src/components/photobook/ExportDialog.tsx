import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import Icon from '@/components/ui/icon';
import type { PhotoSlot, UploadedPhoto } from './PhotobookCreator';
import { exportAsJPEG, exportAsPSD, exportAsPDF, downloadFile } from '@/utils/photobookExport';

interface ExportDialogProps {
  open: boolean;
  onClose: () => void;
  spreads: Array<{ id: string; slots: PhotoSlot[] }>;
  photos: UploadedPhoto[];
  format: 'pdf' | 'jpeg' | 'psd';
}

const ExportDialog = ({ open, onClose, spreads, photos, format }: ExportDialogProps) => {
  const [quality, setQuality] = useState(95);
  const [resolution, setResolution] = useState<'standard' | 'high' | 'print'>('high');
  const [isExporting, setIsExporting] = useState(false);

  const resolutionSettings = {
    standard: { label: 'Стандартное (72 DPI)', width: 2000, height: 1000 },
    high: { label: 'Высокое (150 DPI)', width: 4167, height: 2083 },
    print: { label: 'Печать (300 DPI)', width: 8333, height: 4167 }
  };

  const formatLabels = {
    pdf: 'PDF',
    jpeg: 'JPEG',
    psd: 'PSD'
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      let blob: Blob;
      const selectedRes = resolutionSettings[resolution];

      switch (format) {
        case 'jpeg':
          blob = await exportAsJPEG(spreads, photos, quality, selectedRes.width, selectedRes.height);
          downloadFile(blob, 'photobook-jpeg.zip');
          break;
        case 'psd':
          blob = await exportAsPSD(spreads, photos, selectedRes.width, selectedRes.height);
          downloadFile(blob, 'photobook-psd.zip');
          break;
        case 'pdf':
          blob = await exportAsPDF(spreads, photos, selectedRes.width, selectedRes.height);
          downloadFile(blob, 'photobook.pdf');
          break;
      }
      onClose();
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const getEstimatedSize = () => {
    const baseSize = spreads.length * (resolution === 'print' ? 15 : resolution === 'high' ? 5 : 2);
    const qualityMultiplier = format === 'jpeg' ? quality / 100 : 1;
    return Math.round(baseSize * qualityMultiplier);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px] bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-rose-50/80 backdrop-blur-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Download" size={24} />
            Экспорт в {formatLabels[format]}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label className="text-base font-semibold">Разрешение</Label>
            <RadioGroup value={resolution} onValueChange={(val) => setResolution(val as typeof resolution)}>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="standard" id="standard" />
                <Label htmlFor="standard" className="flex-1 cursor-pointer">
                  <div className="font-medium">Стандартное (72 DPI)</div>
                  <div className="text-xs text-muted-foreground">2000×1000 px — для экрана</div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="high" id="high" />
                <Label htmlFor="high" className="flex-1 cursor-pointer">
                  <div className="font-medium">Высокое (150 DPI)</div>
                  <div className="text-xs text-muted-foreground">4167×2083 px — универсальное</div>
                </Label>
              </div>
              <div className="flex items-center space-x-2 p-3 border rounded-lg hover:bg-gray-50 cursor-pointer">
                <RadioGroupItem value="print" id="print" />
                <Label htmlFor="print" className="flex-1 cursor-pointer">
                  <div className="font-medium">Печать (300 DPI)</div>
                  <div className="text-xs text-muted-foreground">8333×4167 px — профессиональная печать</div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          {format === 'jpeg' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Качество</Label>
                <span className="text-sm font-medium text-muted-foreground">{quality}%</span>
              </div>
              <Slider
                value={[quality]}
                onValueChange={([val]) => setQuality(val)}
                min={60}
                max={100}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Меньше размер</span>
                <span>Лучше качество</span>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-900">
              <Icon name="Info" size={16} />
              Информация об экспорте
            </div>
            <div className="text-xs text-blue-800 space-y-1">
              <div className="flex justify-between">
                <span>Форматов разворотов:</span>
                <span className="font-medium">{spreads.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Примерный размер:</span>
                <span className="font-medium">~{getEstimatedSize()} МБ</span>
              </div>
              <div className="flex justify-between">
                <span>Формат архива:</span>
                <span className="font-medium">{format === 'pdf' ? 'PDF файл' : 'ZIP архив'}</span>
              </div>
            </div>
          </div>

          {format === 'psd' && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Icon name="AlertCircle" size={16} className="text-amber-700 mt-0.5" />
                <div className="text-xs text-amber-800">
                  <p className="font-medium mb-1">Важно для работы с PSD:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Каждый разворот — отдельный PSD файл</li>
                    <li>Слои сохраняются с позиционированием</li>
                    <li>Требуется Photoshop CS6 или новее</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isExporting}>
            Отмена
          </Button>
          <Button onClick={handleExport} disabled={isExporting} className="min-w-[120px]">
            {isExporting ? (
              <>
                <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
                Экспорт...
              </>
            ) : (
              <>
                <Icon name="Download" size={18} className="mr-2" />
                Экспортировать
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ExportDialog;