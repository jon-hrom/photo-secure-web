import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
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
  const SETTINGS_API = funcUrls['background-settings'];
  const [isExpanded, setIsExpanded] = useState(true);
  const [backgroundImages, setBackgroundImages] = useState<BackgroundImage[]>([]);
  const [selectedBackgroundId, setSelectedBackgroundId] = useState<string | null>(null);
  const [backgroundOpacity, setBackgroundOpacity] = useState<number>(20);
  const [cardBackgroundImages, setCardBackgroundImages] = useState<BackgroundImage[]>([]);
  const [cardTransitionTime, setCardTransitionTime] = useState<number>(5);
  const [garlandEnabled, setGarlandEnabled] = useState(
    localStorage.getItem('garlandEnabled') === 'true'
  );
  const [backgroundVideos, setBackgroundVideos] = useState<BackgroundVideo[]>([]);
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [mobileBackgroundImages, setMobileBackgroundImages] = useState<BackgroundImage[]>([]);
  const [selectedMobileBackgroundId, setSelectedMobileBackgroundId] = useState<string | null>(null);
  const [cardOpacity, setCardOpacity] = useState<number>(95);

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const response = await fetch(SETTINGS_API);
        const data = await response.json();
        if (!data.success) return;
        const s = data.settings;

        if (s.login_background_opacity) setBackgroundOpacity(Number(s.login_background_opacity));
        if (s.login_card_opacity) setCardOpacity(Number(s.login_card_opacity));
        if (s.login_card_transition_time) setCardTransitionTime(Number(s.login_card_transition_time));

        if (s.login_background_video_id) setSelectedVideoId(s.login_background_video_id);

        if (s.login_background_image_id) setSelectedBackgroundId(s.login_background_image_id);

        if (s.login_desktop_images) {
          try {
            const imgs = typeof s.login_desktop_images === 'string'
              ? JSON.parse(s.login_desktop_images)
              : s.login_desktop_images;
            setBackgroundImages(imgs);
          } catch (e) { console.error('[ADMIN_APPEARANCE] Failed to parse desktop images:', e); }
        }

        if (s.login_card_images) {
          try {
            const imgs = typeof s.login_card_images === 'string'
              ? JSON.parse(s.login_card_images)
              : s.login_card_images;
            setCardBackgroundImages(imgs);
            window.dispatchEvent(new CustomEvent('cardBackgroundImagesChange', { detail: imgs }));
          } catch (e) { console.error('[ADMIN_APPEARANCE] Failed to parse card images:', e); }
        }

        if (s.login_desktop_selected_id) {
          setSelectedBackgroundId(s.login_desktop_selected_id);
          localStorage.setItem('loginPageBackground', s.login_desktop_selected_id);
        }

        const mobileMetadata = localStorage.getItem('mobileBackgroundImages');
        if (mobileMetadata) {
          try { setMobileBackgroundImages(JSON.parse(mobileMetadata)); } catch (e) { console.error('[ADMIN_APPEARANCE] Failed to parse mobile images:', e); }
        }

        const videoId = s.login_background_video_id || localStorage.getItem('loginPageVideo');
        if (videoId) setSelectedVideoId(videoId);

        const mobileSelected = s.login_mobile_background_url
          ? localStorage.getItem('loginPageMobileBackground')
          : null;
        if (mobileSelected) setSelectedMobileBackgroundId(mobileSelected);

      } catch (e) {
        console.error('[ADMIN_APPEARANCE] Failed to load settings from DB:', e);
        const savedOpacity = localStorage.getItem('loginPageBackgroundOpacity');
        if (savedOpacity) setBackgroundOpacity(Number(savedOpacity));
        const savedCardOpacity = localStorage.getItem('loginCardOpacity');
        if (savedCardOpacity) setCardOpacity(Number(savedCardOpacity));
      }
    };

    loadSettings();
  }, [SETTINGS_API]);

  const saveCardImagesToDb = async (images: BackgroundImage[]) => {
    try {
      await fetch(SETTINGS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cardImages: images.map(img => ({ id: img.id, url: img.url, name: img.name }))
        })
      });
    } catch (e) {
      console.error('[ADMIN_APPEARANCE] Failed to save card images:', e);
    }
  };

  const handleOpacityChange = (value: number[]) => {
    const opacity = value[0];
    setBackgroundOpacity(opacity);
    localStorage.setItem('loginPageBackgroundOpacity', opacity.toString());
    fetch(SETTINGS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opacity: opacity.toString() })
    }).catch(() => {});
  };

  const handleCardBackgroundUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    sonnerToast.loading('Загрузка изображений...', { id: 'card-upload' });

    try {
      const newImages: BackgroundImage[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('image/')) continue;

        const base64Data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve((reader.result as string).split(',')[1]);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ file: base64Data, filename: file.name, type: 'image' }),
        });

        const data = await response.json();
        if (data.success && data.file) {
          newImages.push({ id: data.file.id, url: data.file.url, name: file.name });
        }
      }

      const updatedImages = [...cardBackgroundImages, ...newImages];
      setCardBackgroundImages(updatedImages);
      window.dispatchEvent(new CustomEvent('cardBackgroundImagesChange', { detail: updatedImages }));
      await saveCardImagesToDb(updatedImages);
      sonnerToast.success(`Загружено ${newImages.length} изображений`, { id: 'card-upload' });
    } catch {
      sonnerToast.error('Ошибка загрузки', { id: 'card-upload' });
    }
  };

  const handleCardBackgroundRemove = async (id: string) => {
    const updatedImages = cardBackgroundImages.filter(img => img.id !== id);
    setCardBackgroundImages(updatedImages);
    window.dispatchEvent(new CustomEvent('cardBackgroundImagesChange', { detail: updatedImages }));
    await saveCardImagesToDb(updatedImages);
    sonnerToast.success('Фон карточки удалён');
  };

  const handleCardTransitionTimeChange = (value: number[]) => {
    const time = value[0];
    setCardTransitionTime(time);
    localStorage.setItem('cardTransitionTime', time.toString());
    fetch(SETTINGS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardTransitionTime: time.toString() })
    }).catch(() => {});
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
    fetch(SETTINGS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cardOpacity: opacity.toString() })
    }).catch(() => {});
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
          <Icon name={isExpanded ? 'ChevronUp' : 'ChevronDown'} className="text-muted-foreground" />
        </div>
      </CardHeader>
      {isExpanded && <CardContent className="space-y-6">
        <ColorPicker colors={colors} onColorChange={onColorChange} onSave={onSave} />

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