import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import Photobook3DPreview from '../Photobook3DPreview';
import SaveDesignDialog from '../SaveDesignDialog';
import type { PhotobookConfig, UploadedPhoto, PhotoSlot } from '../PhotobookCreator';

interface PhotobookFinalStepProps {
  config: PhotobookConfig;
  spreads: Array<{ id: string; slots: PhotoSlot[] }>;
  photos: UploadedPhoto[];
  onComplete: (title: string, enableClientLink: boolean) => void;
  onBack: () => void;
}

const PhotobookFinalStep = ({ config, spreads, photos, onComplete, onBack }: PhotobookFinalStepProps) => {
  const [show3DPreview, setShow3DPreview] = useState(true);
  const [showSaveDialog, setShowSaveDialog] = useState(false);



  const handleOrder = () => {
    setShow3DPreview(false);
    setShowSaveDialog(true);
  };

  const handleSaveDesign = (name: string) => {
    console.log('Design saved:', name);
    setTimeout(() => {
      onComplete(name, false);
    }, 2000);
  };

  return (
    <>
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" size="icon" onClick={onBack}>
            <Icon name="ArrowLeft" size={24} />
          </Button>
          <h2 className="text-2xl font-bold">Просмотр фотокниги</h2>
          <Button
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold"
            onClick={() => setShow3DPreview(true)}
          >
            <Icon name="Eye" size={20} className="mr-2" />
            Открыть просмотр
          </Button>
        </div>

        <div className="bg-gray-100 p-12 rounded-lg text-center">
          <Icon name="BookOpen" size={96} className="mx-auto mb-6 text-muted-foreground" />
          <p className="text-xl font-semibold mb-3">Ваша фотокнига готова!</p>
          <p className="text-muted-foreground text-lg mb-8">
            Формат: {config.format.replace('x', '×')} см | Разворотов: {spreads.length} | Фото: {photos.length}
          </p>
          <Button
            size="lg"
            className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold text-lg px-12"
            onClick={() => setShow3DPreview(true)}
          >
            <Icon name="Eye" size={24} className="mr-3" />
            Открыть 3D просмотр
          </Button>
        </div>
      </div>

      <Photobook3DPreview
        open={show3DPreview}
        config={config}
        spreads={spreads}
        photos={photos}
        onClose={() => setShow3DPreview(false)}
        onOrder={handleOrder}
      />

      <SaveDesignDialog
        open={showSaveDialog}
        onClose={() => setShowSaveDialog(false)}
        onSave={handleSaveDesign}
      />
    </>
  );
};

export default PhotobookFinalStep;