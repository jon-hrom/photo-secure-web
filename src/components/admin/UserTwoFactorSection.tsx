import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface UserTwoFactorSectionProps {
  userSource: 'email' | 'vk' | 'google' | 'yandex';
  twoFactorSettings: {sms: boolean; email: boolean} | null;
  loadingRequest: boolean;
  onRequestDisable: (type: 'sms' | 'email' | 'both') => void;
}

const UserTwoFactorSection = ({ 
  userSource, 
  twoFactorSettings, 
  loadingRequest, 
  onRequestDisable 
}: UserTwoFactorSectionProps) => {
  if (userSource !== 'email' || !twoFactorSettings) {
    return null;
  }

  return (
    <div className="border-t pt-4 space-y-3">
      <h4 className="font-semibold flex items-center gap-2">
        <Icon name="Shield" size={18} />
        Двухфакторная аутентификация
      </h4>

      <div className="grid grid-cols-2 gap-3">
        <div className={`border-l-4 pl-4 py-3 rounded-r ${twoFactorSettings.sms ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-gray-300 bg-gray-50 dark:bg-gray-900/20'}`}>
          <div className="flex items-center gap-2 mb-1">
            <Icon name="Smartphone" size={16} className={twoFactorSettings.sms ? 'text-green-600' : 'text-gray-400'} />
            <span className="text-sm font-medium">SMS</span>
          </div>
          <Badge variant={twoFactorSettings.sms ? 'default' : 'secondary'} className="text-xs">
            {twoFactorSettings.sms ? 'Включена' : 'Отключена'}
          </Badge>
        </div>

        <div className={`border-l-4 pl-4 py-3 rounded-r ${twoFactorSettings.email ? 'border-green-500 bg-green-50 dark:bg-green-950/20' : 'border-gray-300 bg-gray-50 dark:bg-gray-900/20'}`}>
          <div className="flex items-center gap-2 mb-1">
            <Icon name="Mail" size={16} className={twoFactorSettings.email ? 'text-green-600' : 'text-gray-400'} />
            <span className="text-sm font-medium">Email</span>
          </div>
          <Badge variant={twoFactorSettings.email ? 'default' : 'secondary'} className="text-xs">
            {twoFactorSettings.email ? 'Включена' : 'Отключена'}
          </Badge>
        </div>
      </div>

      {(twoFactorSettings.sms || twoFactorSettings.email) && (
        <div className="space-y-2">
          {twoFactorSettings.sms && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRequestDisable('sms')}
              disabled={loadingRequest}
              className="w-full gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
            >
              <Icon name="ShieldOff" size={16} />
              Отключить SMS-аутентификацию
            </Button>
          )}
          {twoFactorSettings.email && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRequestDisable('email')}
              disabled={loadingRequest}
              className="w-full gap-2 border-orange-500 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/20"
            >
              <Icon name="ShieldOff" size={16} />
              Отключить Email-аутентификацию
            </Button>
          )}
          {twoFactorSettings.sms && twoFactorSettings.email && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRequestDisable('both')}
              disabled={loadingRequest}
              className="w-full gap-2 border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              <Icon name="ShieldAlert" size={16} />
              Отключить всю 2FA
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default UserTwoFactorSection;
