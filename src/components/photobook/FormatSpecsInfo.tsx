import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import type { PhotobookFormat } from './PhotobookCreator';
import { FORMAT_SPECS, SPREAD_SPECS_20x20 } from './layoutUtils';

interface FormatSpecsInfoProps {
  format: PhotobookFormat;
}

const FormatSpecsInfo = ({ format }: FormatSpecsInfoProps) => {
  const [showSpecsDialog, setShowSpecsDialog] = useState(false);

  return (
    <>
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
        <div className="flex items-start justify-between">
          <div className="text-sm space-y-1 flex-1">
            <div className="font-semibold text-blue-900">Размеры для типографии (формат {format}):</div>
            <div className="grid grid-cols-2 gap-x-4 text-blue-800">
              <div>• Разворот: {FORMAT_SPECS[format].spreadMM} мм ({FORMAT_SPECS[format].spreadPX} px)</div>
              <div>• Обложка: {FORMAT_SPECS[format].coverMM} мм ({FORMAT_SPECS[format].coverPX} px)</div>
              <div>• Корешок: {FORMAT_SPECS[format].spineMM} мм ({FORMAT_SPECS[format].spinePX} px)</div>
              <div>• Количество разворотов: {FORMAT_SPECS[format].spreadsRange}</div>
            </div>
          </div>
          {format === '20x20' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSpecsDialog(true)}
              className="text-blue-700 hover:text-blue-900"
            >
              <Icon name="Info" size={18} className="mr-1" />
              Детали
            </Button>
          )}
        </div>
      </div>

      <Dialog open={showSpecsDialog} onOpenChange={setShowSpecsDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Детальные размеры макетов 20×20 см для типографии</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="text-sm text-muted-foreground mb-4">
              Размеры разворота, обложки и корешка в зависимости от количества разворотов
            </div>
            <div className="space-y-3">
              {SPREAD_SPECS_20x20.map((spec, index) => (
                <Card key={index} className="border-l-4 border-l-primary">
                  <CardContent className="p-4">
                    <div className="font-semibold text-primary mb-2">
                      Развороты: {spec.spreads}
                    </div>
                    <div className="grid md:grid-cols-3 gap-2 text-sm">
                      <div>
                        <span className="font-medium">Разворот:</span>
                        <div className="text-muted-foreground">{spec.spread}</div>
                      </div>
                      <div>
                        <span className="font-medium">Обложка:</span>
                        <div className="text-muted-foreground">{spec.cover}</div>
                      </div>
                      <div>
                        <span className="font-medium">Корешок:</span>
                        <div className="text-muted-foreground">{spec.spine}</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mt-4">
              <div className="flex items-start gap-2">
                <Icon name="AlertTriangle" size={18} className="text-yellow-600 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <strong>Важно:</strong> Данные для разворотов от 26 до 40 будут добавлены позже. 
                  Используйте указанные размеры для точной подготовки макетов в типографию.
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FormatSpecsInfo;
