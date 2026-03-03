import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { settingsSync } from '@/utils/settingsSync';
import FingerprintAnimation, { type AnimationState } from '@/components/ui/FingerprintAnimation';
import {
  checkBiometricAvailability,
  isBiometricRegistered,
  registerBiometric,
  removeBiometric,
  getBiometricUserData,
} from '@/utils/biometricAuth';

const APP_SETTINGS_URL = 'https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0';

const detectPlatform = (): 'ios' | 'android' | 'desktop' => {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'desktop';
};

const getPlatformLabel = (platform: string) => {
  if (platform === 'ios') return { name: 'iOS (Face ID / Touch ID)', icon: 'Smartphone' as const };
  if (platform === 'android') return { name: 'Android (отпечаток пальца)', icon: 'Smartphone' as const };
  return { name: 'Компьютер (Windows Hello / macOS)', icon: 'Monitor' as const };
};

const AdminBiometricSettings = () => {
  const [biometricEnabled, setBiometricEnabled] = useState(false);
  const [deviceSupported, setDeviceSupported] = useState(false);
  const [isRegistered, setIsRegistered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [animState, setAnimState] = useState<AnimationState>('idle');
  const platform = detectPlatform();
  const platformInfo = getPlatformLabel(platform);

  useEffect(() => {
    const init = async () => {
      const supported = await checkBiometricAvailability();
      setDeviceSupported(supported);
      setIsRegistered(isBiometricRegistered());

      try {
        const res = await fetch(`${APP_SETTINGS_URL}?key=biometric_enabled`);
        const data = await res.json();
        if (data.value !== undefined) {
          setBiometricEnabled(data.value === true);
        }
      } catch (error) {
        console.error('Error loading biometric setting:', error);
      }
      setLoading(false);
    };
    init();
  }, []);

  const handleToggleBiometric = async (checked: boolean) => {
    setBiometricEnabled(checked);
    try {
      await fetch(APP_SETTINGS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'biometric_enabled', value: checked }),
      });
      localStorage.removeItem('settings_cache');
      settingsSync.notifyAllUsers();
      toast.success(checked ? 'Биометрия включена для всех пользователей' : 'Биометрия отключена');
    } catch {
      setBiometricEnabled(!checked);
      toast.error('Не удалось сохранить настройку');
    }
  };

  const handleRegisterAdmin = async () => {
    setAnimState('scanning');
    try {
      const sessionData = localStorage.getItem('authSession');
      let userData = { userId: 0, email: 'admin' };
      if (sessionData) {
        const session = JSON.parse(sessionData);
        userData = { userId: session.userId || 0, email: session.userEmail || session.email || 'admin' };
      }

      const success = await registerBiometric(userData);
      if (success) {
        setAnimState('success');
        setIsRegistered(true);
        toast.success('Биометрия привязана к вашему аккаунту');
        setTimeout(() => setAnimState('idle'), 2500);
      } else {
        setAnimState('error');
        toast.error('Не удалось зарегистрировать биометрию');
        setTimeout(() => setAnimState('idle'), 2000);
      }
    } catch {
      setAnimState('error');
      toast.error('Ошибка при регистрации биометрии');
      setTimeout(() => setAnimState('idle'), 2000);
    }
  };

  const handleRemoveBiometric = () => {
    removeBiometric();
    setIsRegistered(false);
    setAnimState('idle');
    toast.success('Биометрия отвязана от аккаунта');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Icon name="Loader2" size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name="Fingerprint" size={20} className="text-primary" />
            Глобальная настройка
          </CardTitle>
          <CardDescription>
            Разрешить пользователям входить по отпечатку пальца или Face ID
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label className="text-base">Биометрическая аутентификация</Label>
              <p className="text-sm text-muted-foreground">
                При включении на странице входа появится кнопка «Войти по биометрии»
              </p>
            </div>
            <Switch checked={biometricEnabled} onCheckedChange={handleToggleBiometric} />
          </div>

          <div className="grid grid-cols-3 gap-2 pt-2">
            <div className="flex flex-col items-center gap-1 p-3 bg-muted/40 rounded-lg text-center">
              <Icon name="Smartphone" size={20} className="text-green-600" />
              <span className="text-xs font-medium">Android</span>
              <span className="text-[10px] text-muted-foreground">Отпечаток</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 bg-muted/40 rounded-lg text-center">
              <Icon name="Smartphone" size={20} className="text-blue-600" />
              <span className="text-xs font-medium">iOS</span>
              <span className="text-[10px] text-muted-foreground">Face ID / Touch ID</span>
            </div>
            <div className="flex flex-col items-center gap-1 p-3 bg-muted/40 rounded-lg text-center">
              <Icon name="Monitor" size={20} className="text-purple-600" />
              <span className="text-xs font-medium">Desktop</span>
              <span className="text-[10px] text-muted-foreground">Windows Hello</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Icon name={platformInfo.icon} size={20} className="text-primary" />
            Ваше устройство
          </CardTitle>
          <CardDescription>
            {platformInfo.name}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FingerprintAnimation state={animState} size="sm" />

          <div className="flex items-center gap-3">
            <span className="text-sm">Поддержка биометрии:</span>
            {deviceSupported ? (
              <Badge variant="default" className="bg-green-600">
                <Icon name="Check" size={12} className="mr-1" />
                Поддерживается
              </Badge>
            ) : (
              <Badge variant="secondary">
                <Icon name="X" size={12} className="mr-1" />
                Не поддерживается
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm">Статус привязки:</span>
            {isRegistered ? (
              <Badge variant="default" className="bg-blue-600">
                <Icon name="Fingerprint" size={12} className="mr-1" />
                Привязано
              </Badge>
            ) : (
              <Badge variant="outline">Не привязано</Badge>
            )}
          </div>

          {isRegistered && getBiometricUserData() && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <span className="text-muted-foreground">Аккаунт: </span>
              <span className="font-medium">{getBiometricUserData()?.email}</span>
            </div>
          )}

          <Separator />

          {deviceSupported ? (
            <div className="flex gap-2 flex-wrap">
              {!isRegistered ? (
                <Button onClick={handleRegisterAdmin} disabled={animState === 'scanning'}>
                  <Icon name={animState === 'scanning' ? 'Loader2' : 'Fingerprint'} size={16} className={animState === 'scanning' ? 'animate-spin mr-2' : 'mr-2'} />
                  Привязать биометрию
                </Button>
              ) : (
                <>
                  <Button onClick={handleRegisterAdmin} variant="outline" disabled={animState === 'scanning'}>
                    <Icon name={animState === 'scanning' ? 'Loader2' : 'RefreshCw'} size={16} className={animState === 'scanning' ? 'animate-spin mr-2' : 'mr-2'} />
                    Перепривязать
                  </Button>
                  <Button onClick={handleRemoveBiometric} variant="destructive">
                    <Icon name="Trash2" size={16} className="mr-2" />
                    Отвязать
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="p-4 bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-800 rounded-lg">
              <div className="flex items-start gap-3">
                <Icon name="AlertTriangle" size={20} className="text-orange-500 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-orange-700 dark:text-orange-300">
                    Биометрия недоступна на этом устройстве
                  </p>
                  <p className="text-muted-foreground mt-1">
                    Для привязки откройте сайт на телефоне с поддержкой отпечатка пальца или Face ID
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="p-4 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg">
            <div className="flex items-start gap-3">
              <Icon name="Info" size={20} className="text-blue-500 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-medium text-blue-700 dark:text-blue-300">Как это работает</p>
                <ul className="text-muted-foreground space-y-1 list-disc pl-4">
                  <li>Пользователь входит обычным способом (логин/пароль или OAuth)</li>
                  <li>Устройство предлагает привязать биометрию</li>
                  <li>В следующий раз — вход в одно касание без пароля</li>
                  <li>Работает на Android, iOS и ПК с Windows Hello</li>
                </ul>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminBiometricSettings;
