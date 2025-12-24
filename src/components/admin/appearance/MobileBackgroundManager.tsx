import { toast as sonnerToast } from 'sonner';
import Icon from '@/components/ui/icon';
import { BackgroundImage } from './BackgroundGallery';
import funcUrls from '../../../../backend/func2url.json';

interface MobileBackgroundManagerProps {
  API_URL: string;
  mobileBackgroundImages: BackgroundImage[];
  setMobileBackgroundImages: (images: BackgroundImage[]) => void;
  selectedMobileBackgroundId: string | null;
  setSelectedMobileBackgroundId: (id: string | null) => void;
}

const MobileBackgroundManager = ({
  API_URL,
  mobileBackgroundImages,
  setMobileBackgroundImages,
  selectedMobileBackgroundId,
  setSelectedMobileBackgroundId,
}: MobileBackgroundManagerProps) => {
  const SETTINGS_API = funcUrls['background-settings'];

  const saveToDatabase = async (mobileUrl: string) => {
    try {
      const videoId = localStorage.getItem('loginPageVideo') || '';
      const videoUrl = localStorage.getItem('loginPageVideoUrl') || '';
      const imageId = localStorage.getItem('loginPageBackground') || '';
      const opacity = localStorage.getItem('loginPageBackgroundOpacity') || '20';
      
      await fetch(SETTINGS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoId,
          videoUrl,
          mobileUrl,
          imageId,
          opacity
        })
      });
    } catch (error) {
      console.error('[MOBILE_BG] Failed to save settings:', error);
    }
  };
  const handleMobileBackgroundUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    sonnerToast.loading('Загрузка изображений...', { id: 'mobile-upload' });

    try {
      const uploadedImages: BackgroundImage[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = reader.result as string;
            const base64 = result.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            file: base64Data,
            filename: file.name,
            type: 'image',
          }),
        });

        const data = await response.json();
        
        if (data.success && data.file) {
          uploadedImages.push({
            id: data.file.id,
            url: data.file.url,
            name: file.name,
          });
        }
      }

      const updatedImages = [...mobileBackgroundImages, ...uploadedImages];
      setMobileBackgroundImages(updatedImages);
      
      const imagesMetadata = updatedImages.map(img => ({
        id: img.id,
        url: img.url,
        name: img.name
      }));
      localStorage.setItem('mobileBackgroundImages', JSON.stringify(imagesMetadata));

      sonnerToast.success(`Добавлено ${uploadedImages.length} изображений`, { id: 'mobile-upload' });
    } catch (error) {
      console.error('Mobile background upload error:', error);
      sonnerToast.error('Ошибка загрузки', { id: 'mobile-upload' });
    }
  };

  const handleSelectMobileBackground = async (imageId: string) => {
    setSelectedMobileBackgroundId(imageId);
    const selectedImage = mobileBackgroundImages.find(img => img.id === imageId);
    
    if (selectedImage) {
      localStorage.setItem('loginPageMobileBackground', imageId);
      localStorage.setItem('loginPageMobileBackgroundUrl', selectedImage.url);
      await saveToDatabase(selectedImage.url);
      window.dispatchEvent(new CustomEvent('mobileBackgroundChange', { detail: selectedImage.url }));
      sonnerToast.success('Мобильный фон применен');
    }
  };

  const handleRemoveMobileBackground = (imageId: string) => {
    const updatedImages = mobileBackgroundImages.filter(img => img.id !== imageId);
    setMobileBackgroundImages(updatedImages);
    localStorage.setItem('mobileBackgroundImages', JSON.stringify(updatedImages));
    
    if (selectedMobileBackgroundId === imageId) {
      setSelectedMobileBackgroundId(null);
      localStorage.removeItem('loginPageMobileBackground');
      localStorage.removeItem('loginPageMobileBackgroundUrl');
      window.dispatchEvent(new CustomEvent('mobileBackgroundChange', { detail: null }));
    }

    sonnerToast.success('Мобильное изображение удалено');
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-2">Мобильный фон (картинка/GIF)</h3>
      <p className="text-sm text-muted-foreground mb-4">
        На мобильных устройствах вместо видео будет показываться эта картинка или GIF
      </p>
      
      <div className="space-y-4">
        <div>
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={(e) => handleMobileBackgroundUpload(e.target.files)}
            className="hidden"
            id="mobile-bg-upload"
          />
          <label
            htmlFor="mobile-bg-upload"
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 cursor-pointer transition-colors"
          >
            <Icon name="Upload" size={20} />
            Загрузить картинку/GIF для мобильных
          </label>
        </div>

        {mobileBackgroundImages.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {mobileBackgroundImages.map((image) => (
              <div
                key={image.id}
                className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                  selectedMobileBackgroundId === image.id
                    ? 'border-primary ring-2 ring-primary/20'
                    : 'border-transparent hover:border-primary/50'
                }`}
                onClick={() => handleSelectMobileBackground(image.id)}
              >
                <img
                  src={image.url}
                  alt={image.name}
                  className="w-full h-32 object-cover"
                />
                {selectedMobileBackgroundId === image.id && (
                  <div className="absolute top-2 right-2 bg-primary text-primary-foreground rounded-full p-1">
                    <Icon name="Check" size={16} />
                  </div>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveMobileBackground(image.id);
                  }}
                  className="absolute bottom-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Icon name="Trash2" size={16} />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-xs p-2 truncate">
                  {image.name}
                </div>
              </div>
            ))}
          </div>
        )}

        {mobileBackgroundImages.length === 0 && (
          <div className="text-center text-muted-foreground py-8 border-2 border-dashed rounded-lg">
            <Icon name="ImagePlus" size={48} className="mx-auto mb-2 opacity-50" />
            <p>Загрузите картинку или GIF для мобильных устройств</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default MobileBackgroundManager;