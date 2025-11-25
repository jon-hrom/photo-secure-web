import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const NotificationSoundSettings = () => {
  const [customSound, setCustomSound] = useState<string | null>(null);
  const [soundFile, setSoundFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const savedSound = localStorage.getItem('admin_notification_sound');
    if (savedSound) {
      setCustomSound(savedSound);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validTypes = ['audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp3'];
    if (!validTypes.includes(file.type)) {
      toast.error('Поддерживаются только аудио форматы: MP3, WAV, OGG');
      return;
    }

    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      toast.error('Файл слишком большой. Максимум 2 МБ');
      return;
    }

    setSoundFile(file);
  };

  const uploadSound = async () => {
    if (!soundFile) return;

    setUploading(true);
    try {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        localStorage.setItem('admin_notification_sound', dataUrl);
        setCustomSound(dataUrl);
        toast.success('Звук уведомления сохранён');
        setSoundFile(null);
      };
      reader.readAsDataURL(soundFile);
    } catch (error) {
      console.error('Error uploading sound:', error);
      toast.error('Ошибка загрузки звука');
    } finally {
      setUploading(false);
    }
  };

  const resetToDefault = () => {
    localStorage.removeItem('admin_notification_sound');
    setCustomSound(null);
    setSoundFile(null);
    toast.success('Сброшено на стандартный звук');
  };

  const playTestSound = () => {
    try {
      const defaultSound = 'data:audio/wav;base64,UklGRmQEAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YUAEAACAP4CAf4B/gICAgH+AgIB/gH+AgICAgICAf4CAgH+Af4CAgICAgICAgH+AgICAgH+Af4B/gICAgICAf4CAgICAf4B/gH+AgICAgICAgH+AgICAgH+Af4B/gH+AgICAgICAgH+AgICAgH+Af4B/gH+AgICAgICAgH+AgICAgH+Af4B/gH+AgICAgICAgH+AgICAgH+Af4B/gH+Af4CAgICAgICAgH+AgICAgH+Af4B/gH+Af4CAgICAgICAgH+AgICAgH+Af4B/gH+Af4CAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+AgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+AgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4CAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4CAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4CAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+AgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+AgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+Af4CAgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+Af4CAgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+Af4CAgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gICAgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gICAgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+AgICAgICAgICAgICAgICAgH+AgICAgH+Af4B/gH+Af4B/gH+Af4B/gH+Af4B/gH+AgICAgICAgICAgICAgICAgA==';
      const soundUrl = customSound || defaultSound;
      const audio = new Audio(soundUrl);
      audio.volume = 0.5;
      audio.play().catch(err => console.log('Sound play failed:', err));
      toast.success('Проигрывается тестовый звук');
    } catch (error) {
      console.error('Error playing test sound:', error);
      toast.error('Ошибка воспроизведения');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon name="Volume2" size={24} className="text-blue-600" />
          Звук уведомления об обращениях
        </CardTitle>
        <CardDescription>
          Настройте звук, который будет проигрываться при получении нового обращения от пользователя
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="sound-file">Загрузить свой звук (MP3, WAV, OGG)</Label>
          <div className="flex gap-2">
            <Input
              id="sound-file"
              type="file"
              accept="audio/*"
              onChange={handleFileChange}
              className="flex-1"
              disabled={uploading}
            />
            <Button
              onClick={uploadSound}
              disabled={!soundFile || uploading}
              variant="default"
            >
              {uploading ? (
                <>
                  <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <Icon name="Upload" size={16} className="mr-2" />
                  Сохранить
                </>
              )}
            </Button>
          </div>
          {soundFile && (
            <p className="text-sm text-muted-foreground">
              Выбран файл: {soundFile.name} ({(soundFile.size / 1024).toFixed(1)} КБ)
            </p>
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            onClick={playTestSound}
            variant="outline"
            className="flex-1"
          >
            <Icon name="Play" size={16} className="mr-2" />
            Проверить звук
          </Button>
          
          {customSound && (
            <Button
              onClick={resetToDefault}
              variant="outline"
              className="flex-1"
            >
              <Icon name="RotateCcw" size={16} className="mr-2" />
              Сбросить на стандартный
            </Button>
          )}
        </div>

        {customSound && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Icon name="CheckCircle" size={18} className="text-green-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-green-900">Используется пользовательский звук</p>
                <p className="text-xs text-green-700">Звук сохранён в браузере и будет проигрываться при новых обращениях</p>
              </div>
            </div>
          </div>
        )}

        {!customSound && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <Icon name="Info" size={18} className="text-blue-600 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-900">Используется стандартный звук</p>
                <p className="text-xs text-blue-700">Загрузите свой аудиофайл, чтобы изменить звук уведомления</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default NotificationSoundSettings;
