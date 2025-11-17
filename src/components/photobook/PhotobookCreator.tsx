import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import PhotobookConfigStep from './steps/PhotobookConfigStep';
import PhotobookMethodStep from './steps/PhotobookMethodStep';
import PhotobookTemplateStep from './steps/PhotobookTemplateStep';
import PhotobookFillMethodStep from './steps/PhotobookFillMethodStep';
import PhotobookUploadStep from './steps/PhotobookUploadStep';
import PhotobookEditorStep from './steps/PhotobookEditorStep';
import SmartPhotobookEditor from './SmartPhotobookEditor';
import PhotobookFinalStep from './steps/PhotobookFinalStep';

export type PhotobookFormat = '20x20' | '21x30' | '25x25' | '30x20' | '30x30';
export type PhotobookLayer = 'none' | '1mm' | '2mm';
export type PhotobookMethod = 'template' | 'package';
export type PhotobookFillMethod = 'auto' | 'manual';

export interface PhotoSlot {
  id: string;
  orientation: 'horizontal' | 'vertical';
  x: number;
  y: number;
  width: number;
  height: number;
  photoId?: string;
}

export interface UploadedPhoto {
  id: string;
  url: string;
  file: File;
  width: number;
  height: number;
}

export interface PhotobookTemplate {
  id: string;
  name: string;
  category: string;
  thumbnail: string;
  spreads: number;
}

export interface PhotobookConfig {
  format: PhotobookFormat;
  layer: PhotobookLayer;
  spreadsCount: number;
  copiesCount: number;
  price: number;
}

export interface PhotobookData {
  id: string;
  title: string;
  config: PhotobookConfig;
  method: PhotobookMethod;
  fillMethod: PhotobookFillMethod;
  template?: PhotobookTemplate;
  photos: UploadedPhoto[];
  spreads: Array<{ id: string; slots?: PhotoSlot[]; photos?: any[] }>;
  createdAt: Date;
  enableClientLink: boolean;
  clientLinkId?: string;
  clientComments?: Array<{ id: string; text: string; page: number; x: number; y: number; date: Date }>;
}

interface PhotobookCreatorProps {
  open: boolean;
  onClose: () => void;
  onComplete?: (photobook: PhotobookData) => void;
}

type Step = 'config' | 'method' | 'template' | 'fillMethod' | 'upload' | 'editor' | 'final';

const PhotobookCreator = ({ open, onClose, onComplete }: PhotobookCreatorProps) => {
  const [currentStep, setCurrentStep] = useState<Step>('config');
  const [config, setConfig] = useState<PhotobookConfig>({
    format: '20x20',
    layer: 'none',
    spreadsCount: 3,
    copiesCount: 1,
    price: 727
  });
  const [method, setMethod] = useState<PhotobookMethod | null>(null);
  const [fillMethod, setFillMethod] = useState<PhotobookFillMethod | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState<PhotobookTemplate | null>(null);
  const [uploadedPhotos, setUploadedPhotos] = useState<UploadedPhoto[]>([]);
  const [spreads, setSpreads] = useState<Array<{ id: string; slots: PhotoSlot[]; photos?: any[] }>>([]);
  const [enableClientLink, setEnableClientLink] = useState<boolean>(false);

  const handleConfigComplete = (newConfig: PhotobookConfig) => {
    setConfig(newConfig);
    setCurrentStep('method');
  };

  const handleMethodSelect = (selectedMethod: PhotobookMethod) => {
    setMethod(selectedMethod);
    if (selectedMethod === 'template') {
      setCurrentStep('template');
    } else {
      setCurrentStep('upload');
    }
  };

  const handleTemplateSelect = (template: PhotobookTemplate | null) => {
    setSelectedTemplate(template);
    setCurrentStep('fillMethod');
  };

  const handleFillMethodSelect = (selected: PhotobookFillMethod) => {
    setFillMethod(selected);
    setCurrentStep('upload');
  };

  const handlePhotosUploaded = (photos: UploadedPhoto[]) => {
    setUploadedPhotos(photos);
    setCurrentStep('editor');
  };

  const handleEditorComplete = (editedSpreads: Array<{ id: string; slots?: PhotoSlot[]; photos?: any[] }>) => {
    setSpreads(editedSpreads);
    setCurrentStep('final');
  };

  const handleComplete = (title: string, clientLinkEnabled: boolean) => {
    if (onComplete) {
      const photobookData: PhotobookData = {
        id: `photobook-${Date.now()}`,
        title,
        config,
        method: method!,
        fillMethod: fillMethod || 'manual',
        template: selectedTemplate || undefined,
        photos: uploadedPhotos,
        spreads,
        createdAt: new Date(),
        enableClientLink: clientLinkEnabled,
        clientLinkId: clientLinkEnabled ? `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}` : undefined,
      };
      onComplete(photobookData);
    }
    handleClose();
  };

  const handleClose = () => {
    setCurrentStep('config');
    setConfig({
      format: '20x20',
      layer: 'none',
      spreadsCount: 3,
      copiesCount: 1,
      price: 727
    });
    setMethod(null);
    setFillMethod(null);
    setSelectedTemplate(null);
    setUploadedPhotos([]);
    setSpreads([]);
    setEnableClientLink(false);
    onClose();
  };

  const handleBack = () => {
    if (currentStep === 'method') setCurrentStep('config');
    else if (currentStep === 'template') setCurrentStep('method');
    else if (currentStep === 'fillMethod') setCurrentStep('template');
    else if (currentStep === 'upload') {
      if (method === 'template') {
        setCurrentStep('fillMethod');
      } else {
        setCurrentStep('method');
      }
    }
    else if (currentStep === 'editor') setCurrentStep('upload');
    else if (currentStep === 'final') setCurrentStep('editor');
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-7xl max-h-[95vh] overflow-y-auto p-0">
        {currentStep === 'config' && (
          <PhotobookConfigStep
            config={config}
            onComplete={handleConfigComplete}
            onClose={handleClose}
          />
        )}

        {currentStep === 'method' && (
          <PhotobookMethodStep
            onSelect={handleMethodSelect}
            onBack={handleBack}
          />
        )}

        {currentStep === 'template' && (
          <PhotobookTemplateStep
            onSelect={handleTemplateSelect}
            onBack={handleBack}
          />
        )}

        {currentStep === 'fillMethod' && (
          <PhotobookFillMethodStep
            onSelect={handleFillMethodSelect}
            onBack={handleBack}
          />
        )}

        {currentStep === 'upload' && (
          <PhotobookUploadStep
            requiredPhotos={config.spreadsCount * 4}
            onComplete={handlePhotosUploaded}
            onBack={handleBack}
          />
        )}

        {currentStep === 'editor' && (
          <SmartPhotobookEditor
            config={config}
            photos={uploadedPhotos}
            onComplete={handleEditorComplete}
            onBack={handleBack}
          />
        )}

        {currentStep === 'final' && (
          <PhotobookFinalStep
            config={config}
            spreads={spreads}
            photos={uploadedPhotos}
            onComplete={handleComplete}
            onBack={handleBack}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PhotobookCreator;