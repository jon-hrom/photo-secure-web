import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { toast as sonnerToast } from 'sonner';
import Icon from '@/components/ui/icon';
import ColorPicker from './appearance/ColorPicker';
import BackgroundSettings from './appearance/BackgroundSettings';
import { BackgroundImage } from './appearance/BackgroundGallery';
import { BackgroundVideo } from './appearance/VideoUploader';
import DesktopBackgroundManager from './appearance/DesktopBackgroundManager';
import MobileBackgroundManager from './appearance/MobileBackgroundManager';
import VideoBackgroundManagerWrapper from './appearance/VideoBackgroundManagerWrapper';
import funcUrls from '../../../backend/func2url.json';

interface AdminAppearanceProps {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    background: string;
    text: string;
  };
  onColorChange: (key: string, value: string) => void;
  onSave: () => void;
}

const AdminAppearance = ({ colors, onColorChange, onSave }: AdminAppearanceProps) => {
  const API_URL = funcUrls['background-media'];
  const [isExpanded, setIsExpanded] = useState(true);
  const [backgroundImages, setBackgroundImages] = useState<BackgroundImage[]>([]);
  const [selectedBackgroundId, setSelectedBackgroundId] = useState<string | null>(
    localStorage.getItem('loginPageBackground') || null
  );
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(
    Number(localStorage.getItem('loginPageBackgroundOpacity')) || 20
  );
  const [cardBackgroundImages, setCardBackgroundImages] = useState<BackgroundImage[]>([]);
  const [cardTransitionTime, setCardTransitionTime] = useState<number>(
    Number(localStorage.getItem('cardTransitionTime')) || 5
  );
  const [garlandEnabled, setGarlandEnabled] = useState(
    localStorage.getItem('garlandEnabled') === 'true'
  );
  const [backgroundVideos, setBackgroundVideos] = useState<BackgroundVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(
    localStorage.getItem('loginPageVideo') || null
  );
  const [mobileBackgroundImages, setMobileBackgroundImages] = useState<BackgroundImage[]>([]);
  const [selectedMobileBackgroundId, setSelectedMobileBackgroundId] = useState<string | null>(
    localStorage.getItem('loginPageMobileBackground') || null
  );
  const [cardOpacity, setCardOpacity] = useState<number>(
    Number(localStorage.getItem('loginCardOpacity')) || 95
  );
  const { toast } = useToast();

  useState(() => {
    const savedCardImages = localStorage.getItem('cardBackgroundImages');
    if (savedCardImages) {
      setCardBackgroundImages(JSON.parse(savedCardImages));
    }
  });

  useState(() => {
    const savedImages = localStorage.getItem('backgroundImages');
    if (savedImages) {
      setBackgroundImages(JSON.parse(savedImages));
    }
  });

  useEffect(() => {
    const savedMobileImages = localStorage.getItem('mobileBackgroundImages');
    if (savedMobileImages) {
      try {
        const parsed = JSON.parse(savedMobileImages);
        setMobileBackgroundImages(parsed);
        console.log('[ADMIN_APPEARANCE] Loaded mobile backgrounds:', parsed);
      } catch (e) {
        console.error('[ADMIN_APPEARANCE] Failed to parse mobile backgrounds:', e);
        localStorage.removeItem('mobileBackgroundImages');
      }
    }
  }, []);

  const handleOpacityChange = (value: number[]) => {
    const opacity = value[0];
    setBackgroundOpacity(opacity);
    localStorage.setItem('loginPageBackgroundOpacity', opacity.toString());
  };

  const handleCardBackgroundUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newImages: BackgroundImage[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (!file.type.startsWith('image/')) continue;

      const reader = new FileReader();
      await new Promise<void>((resolve) => {
        reader.onload = (e) => {
          newImages.push({
            id: `card-bg-${Date.now()}-${i}`,
            url: e.target?.result as string,
            name: file.name,
          });
          resolve();
        };
        reader.readAsDataURL(file);
      });
    }

    const updatedImages = [...cardBackgroundImages, ...newImages];
    setCardBackgroundImages(updatedImages);
    localStorage.setItem('cardBackgroundImages', JSON.stringify(updatedImages));
    
    toast({
      title: 'Фоны карточки добавлены',
      description: `Загружено ${newImages.length} изображений`,
    });
  };

  const handleCardBackgroundRemove = (id: string) => {
    const updatedImages = cardBackgroundImages.filter(img => img.id !== id);
    setCardBackgroundImages(updatedImages);
    localStorage.setItem('cardBackgroundImages', JSON.stringify(updatedImages));
    
    toast({
      title: 'Фон карточки удалён',
      description: 'Изображение удалено из галереи',
    });
  };

  const handleCardTransitionTimeChange = (value: number[]) => {
    const time = value[0];
    setCardTransitionTime(time);
    localStorage.setItem('cardTransitionTime', time.toString());
    window.dispatchEvent(new CustomEvent('cardTransitionTimeChange', { detail: time }));
  };

  const handleGarlandToggle = (enabled: boolean) => {
    setGarlandEnabled(enabled);
    localStorage.setItem('garlandEnabled', enabled.toString());
    window.dispatchEvent(new CustomEvent('garlandToggle', { detail: enabled }));
    sonnerToast.success(enabled ? '🎄 Гирлянда включена' : 'Гирлянда выключена');
  };

  const handleCardOpacityChange = (value: number[]) => {
    const opacity = value[0];
    setCardOpacity(opacity);
    localStorage.setItem('loginCardOpacity', opacity.toString());
    window.dispatchEvent(new CustomEvent('cardOpacityChange', { detail: opacity }));
  };

  return (
    <Card>
      <CardHeader 
        className="cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Цветовая схема</CardTitle>
            <CardDescription>Настройка внешнего вида сайта</CardDescription>
          </div>
          <Icon 
            name={isExpanded ? 'ChevronUp' : 'ChevronDown'} 
            className="text-muted-foreground" 
          />
        </div>
      </CardHeader>
      {isExpanded && <CardContent className="space-y-6">
        <ColorPicker 
          colors={colors}
          onColorChange={onColorChange}
          onSave={onSave}
        />

        <Separator />

        <BackgroundSettings
          backgroundOpacity={backgroundOpacity}
          onOpacityChange={handleOpacityChange}
          cardBackgroundImages={cardBackgroundImages}
          cardTransitionTime={cardTransitionTime}
          onCardBackgroundUpload={handleCardBackgroundUpload}
          onCardBackgroundRemove={handleCardBackgroundRemove}
          onCardTransitionTimeChange={handleCardTransitionTimeChange}
          garlandEnabled={garlandEnabled}
          onGarlandToggle={handleGarlandToggle}
          cardOpacity={cardOpacity}
          onCardOpacityChange={handleCardOpacityChange}
        />

        <Separator />

        <VideoBackgroundManagerWrapper
          backgroundVideos={backgroundVideos}
          setBackgroundVideos={setBackgroundVideos}
          selectedVideoId={selectedVideoId}
          setSelectedVideoId={setSelectedVideoId}
          setSelectedBackgroundId={setSelectedBackgroundId}
        />

        <Separator />

        <MobileBackgroundManager
          API_URL={API_URL}
          mobileBackgroundImages={mobileBackgroundImages}
          setMobileBackgroundImages={setMobileBackgroundImages}
          selectedMobileBackgroundId={selectedMobileBackgroundId}
          setSelectedMobileBackgroundId={setSelectedMobileBackgroundId}
        />

        <Separator />

        <DesktopBackgroundManager
          backgroundImages={backgroundImages}
          setBackgroundImages={setBackgroundImages}
          selectedBackgroundId={selectedBackgroundId}
          setSelectedBackgroundId={setSelectedBackgroundId}
          backgroundOpacity={backgroundOpacity}
          selectedVideoId={selectedVideoId}
          setSelectedVideoId={setSelectedVideoId}
        />
      </CardContent>}
    </Card>
  );
};

export default AdminAppearance;