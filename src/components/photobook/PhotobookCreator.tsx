import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import PhotobookFormatSelector from './PhotobookFormatSelector';
import PhotobookLayoutDesigner from './PhotobookLayoutDesigner';
import PhotobookPhotoUploader from './PhotobookPhotoUploader';
import PhotobookPreview from './PhotobookPreview';

export type PhotobookFormat = '20x20' | '21x30' | '30x30';

export interface PhotoSlot {
  id: string;
  orientation: 'horizontal' | 'vertical';
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface UploadedPhoto {
  id: string;
  url: string;
  file: File;
  width: number;
  height: number;
}

interface PhotobookCreatorProps {
  open: boolean;
  onClose: () => void;
  onComplete?: (photobook: any) => void;
}

type Step = 'format' | 'layout' | 'upload' | 'preview';

const PhotobookCreator = ({ open, onClose, onComplete }: PhotobookCreatorProps) => {
  const [currentStep, setCurrentStep] = useState<Step>('format');
  const [selectedFormat, setSelectedFormat] = useState<PhotobookFormat | null>(null);
  const [photosPerSpread, setPhotosPerSpread] = useState<number>(4);
  const [photoSlots, setPhotoSlots] = useState<PhotoSlot[]>([]);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);

  const handleFormatSelect = (format: PhotobookFormat) => {
    setSelectedFormat(format);
    setCurrentStep('layout');
  };

  const handleLayoutConfirm = (slots: PhotoSlot[]) => {
    setPhotoSlots(slots);
    setCurrentStep('upload');
  };

  const handlePhotosUploaded = (photos: UploadedPhoto[]) => {
    setUploadedPhotos(photos);
    setCurrentStep('preview');
  };

  const handleComplete = () => {
    if (onComplete) {
      onComplete({
        format: selectedFormat,
        photosPerSpread,
        photoSlots,
        photos: uploadedPhotos,
      });
    }
    handleClose();
  };

  const handleClose = () => {
    setCurrentStep('format');
    setSelectedFormat(null);
    setPhotosPerSpread(4);
    setPhotoSlots([]);
    setUploadedPhotos([]);
    onClose();
  };

  const handleBack = () => {
    if (currentStep === 'layout') {
      setCurrentStep('format');
      setSelectedFormat(null);
    } else if (currentStep === 'upload') {
      setCurrentStep('layout');
      setUploadedPhotos([]);
    } else if (currentStep === 'preview') {
      setCurrentStep('upload');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl flex items-center gap-2">
            <Icon name="BookOpen" size={28} className="text-primary" />
            Создание фотокниги
          </DialogTitle>
        </DialogHeader>

        <div className="py-4">
          <div className="flex items-center justify-center mb-8">
            <div className="flex items-center gap-2">
              <div className={`flex items-center gap-2 ${currentStep === 'format' ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'format' ? 'bg-primary text-white' : 'bg-gray-200'}`}>
                  1
                </div>
                <span className="hidden sm:inline">Формат</span>
              </div>
              <Icon name="ChevronRight" size={20} className="text-muted-foreground" />
              <div className={`flex items-center gap-2 ${currentStep === 'layout' ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'layout' ? 'bg-primary text-white' : 'bg-gray-200'}`}>
                  2
                </div>
                <span className="hidden sm:inline">Макет</span>
              </div>
              <Icon name="ChevronRight" size={20} className="text-muted-foreground" />
              <div className={`flex items-center gap-2 ${currentStep === 'upload' ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'upload' ? 'bg-primary text-white' : 'bg-gray-200'}`}>
                  3
                </div>
                <span className="hidden sm:inline">Загрузка</span>
              </div>
              <Icon name="ChevronRight" size={20} className="text-muted-foreground" />
              <div className={`flex items-center gap-2 ${currentStep === 'preview' ? 'text-primary font-semibold' : 'text-muted-foreground'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${currentStep === 'preview' ? 'bg-primary text-white' : 'bg-gray-200'}`}>
                  4
                </div>
                <span className="hidden sm:inline">Просмотр</span>
              </div>
            </div>
          </div>

          {currentStep === 'format' && (
            <PhotobookFormatSelector onSelect={handleFormatSelect} />
          )}

          {currentStep === 'layout' && selectedFormat && (
            <PhotobookLayoutDesigner
              format={selectedFormat}
              photosPerSpread={photosPerSpread}
              onPhotosPerSpreadChange={setPhotosPerSpread}
              onConfirm={handleLayoutConfirm}
              onBack={handleBack}
            />
          )}

          {currentStep === 'upload' && (
            <PhotobookPhotoUploader
              requiredPhotos={photoSlots.length}
              onUpload={handlePhotosUploaded}
              onBack={handleBack}
            />
          )}

          {currentStep === 'preview' && selectedFormat && (
            <PhotobookPreview
              format={selectedFormat}
              photoSlots={photoSlots}
              photos={uploadedPhotos}
              onComplete={handleComplete}
              onBack={handleBack}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default PhotobookCreator;
