import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';

interface UserSettings {
  email: string;
  phone: string;
  two_factor_email: boolean;
  email_verified_at: string | null;
  source?: 'email' | 'vk' | 'google' | 'yandex';
}

interface SecurityCardProps {
  settings: UserSettings;
  handleToggle2FA: (type: 'email', enabled: boolean) => Promise<void>;
}

const SecurityCard = ({ settings, handleToggle2FA }: SecurityCardProps) => {
  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
          <Icon name="Shield" size={20} className="md:w-6 md:h-6" />
          Безопасность
        </CardTitle>
        <CardDescription className="text-xs md:text-sm">Двухфакторная аутентификация</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 md:space-y-6">
        <div className="flex items-center justify-between p-3 md:p-4 bg-muted/30 rounded-xl">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Icon name="Mail" size={18} className="text-primary md:w-5 md:h-5" />
              <Label className="font-semibold text-sm md:text-base">Email-аутентификация</Label>
            </div>
            <p className="text-xs md:text-sm text-muted-foreground">
              Код из 5 цифр будет отправлен на вашу почту
            </p>
          </div>
          <Switch
            checked={settings.two_factor_email}
            onCheckedChange={(checked) => handleToggle2FA('email', checked)}
            disabled={!settings.email}
          />
        </div>

        <div className="p-3 md:p-4 bg-blue-50 rounded-xl border-2 border-blue-200">
          <div className="flex items-start gap-2 md:gap-3">
            <Icon name="Info" className="text-blue-600 mt-0.5 md:mt-1 flex-shrink-0" size={16} />
            <div className="text-xs md:text-sm">
              <p className="font-semibold text-blue-900 mb-1">Рекомендация</p>
              <p className="text-blue-700">
                Включите двухфакторную аутентификацию для повышения безопасности вашего аккаунта
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default SecurityCard;
