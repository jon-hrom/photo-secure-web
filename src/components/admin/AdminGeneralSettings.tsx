import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';

interface AdminGeneralSettingsProps {
  settings: any;
  onToggle: (key: string) => void;
  onInputChange: (key: string, value: string) => void;
}

const AdminGeneralSettings = ({ settings, onToggle, onInputChange }: AdminGeneralSettingsProps) => {
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Основные настройки</CardTitle>
          <CardDescription>Управление доступом и функциями сайта</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="registration" className="text-sm sm:text-base">Регистрация новых пользователей</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Разрешить создание новых аккаунтов
              </p>
            </div>
            <Switch
              id="registration"
              checked={settings.registrationEnabled}
              onCheckedChange={() => onToggle('registrationEnabled')}
            />
          </div>
          <Separator />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="maintenance" className="text-sm sm:text-base">Режим обслуживания</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Закрыть сайт для технических работ
              </p>
            </div>
            <Switch
              id="maintenance"
              checked={settings.maintenanceMode}
              onCheckedChange={() => onToggle('maintenanceMode')}
            />
          </div>
          <Separator />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="guestAccess" className="text-sm sm:text-base">Гостевой доступ</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Разрешить просмотр без авторизации
              </p>
            </div>
            <Switch
              id="guestAccess"
              checked={settings.guestAccess}
              onCheckedChange={() => onToggle('guestAccess')}
            />
          </div>
          <Separator />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="fileUpload" className="text-sm sm:text-base">Загрузка файлов</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Разрешить пользователям загружать файлы
              </p>
            </div>
            <Switch
              id="fileUpload"
              checked={settings.fileUploadEnabled}
              onCheckedChange={() => onToggle('fileUploadEnabled')}
            />
          </div>
          <Separator />
          
          <div className="space-y-2">
            <Label htmlFor="maxFileSize" className="text-sm sm:text-base">Максимальный размер файла (МБ)</Label>
            <Input
              id="maxFileSize"
              type="number"
              value={settings.maxFileSize}
              onChange={(e) => onInputChange('maxFileSize', e.target.value)}
              className="w-full sm:max-w-xs"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Уведомления</CardTitle>
          <CardDescription>Настройка системы уведомлений</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="emailNotif" className="text-sm sm:text-base">Email уведомления</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Отправка уведомлений на почту
              </p>
            </div>
            <Switch
              id="emailNotif"
              checked={settings.emailNotifications}
              onCheckedChange={() => onToggle('emailNotifications')}
            />
          </div>
          <Separator />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="smsNotif" className="text-sm sm:text-base">SMS уведомления</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Отправка уведомлений по SMS
              </p>
            </div>
            <Switch
              id="smsNotif"
              checked={settings.smsNotifications}
              onCheckedChange={() => onToggle('smsNotifications')}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Безопасность</CardTitle>
          <CardDescription>Настройки защиты и аутентификации</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="twoFactor" className="text-sm sm:text-base">Двухфакторная аутентификация</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Требовать код подтверждения при входе
              </p>
            </div>
            <Switch
              id="twoFactor"
              checked={settings.twoFactorEnabled}
              onCheckedChange={() => onToggle('twoFactorEnabled')}
            />
          </div>
          <Separator />
          
          <div className="space-y-2">
            <Label htmlFor="sessionTimeout" className="text-sm sm:text-base">Таймаут сессии (минуты)</Label>
            <Input
              id="sessionTimeout"
              type="number"
              value={settings.sessionTimeout}
              onChange={(e) => onInputChange('sessionTimeout', e.target.value)}
              className="w-full sm:max-w-xs"
            />
            <p className="text-xs sm:text-sm text-muted-foreground">
              Автоматический выход при неактивности
            </p>
          </div>
          <Separator />
          
          <div className="space-y-2">
            <Label htmlFor="maxAttempts" className="text-sm sm:text-base">Максимум попыток входа</Label>
            <Input
              id="maxAttempts"
              type="number"
              value={settings.maxLoginAttempts}
              onChange={(e) => onInputChange('maxLoginAttempts', e.target.value)}
              className="w-full sm:max-w-xs"
            />
            <p className="text-xs sm:text-sm text-muted-foreground">
              Блокировка после неудачных попыток
            </p>
          </div>
          <Separator />
          
          <div className="space-y-2">
            <Label htmlFor="passwordLength" className="text-sm sm:text-base">Минимальная длина пароля</Label>
            <Input
              id="passwordLength"
              type="number"
              value={settings.passwordMinLength}
              onChange={(e) => onInputChange('passwordMinLength', e.target.value)}
              className="w-full sm:max-w-xs"
            />
          </div>
          <Separator />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-0">
            <div className="space-y-0.5 flex-1">
              <Label htmlFor="apiAccess" className="text-sm sm:text-base">API доступ</Label>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Разрешить доступ через API
              </p>
            </div>
            <Switch
              id="apiAccess"
              checked={settings.apiAccess}
              onCheckedChange={() => onToggle('apiAccess')}
            />
          </div>
        </CardContent>
      </Card>
    </>
  );
};

export default AdminGeneralSettings;