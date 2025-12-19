import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const MAX_URL = 'https://functions.poehali.dev/6bd5e47e-49f9-4af3-a814-d426f5cd1f6d';

interface MAXAdminSettings {
  instance_id: string;
  token_masked?: string;
  configured: boolean;
}

export const MaxSettings = () => {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<MAXAdminSettings>({
    instance_id: '',
    configured: false
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const userId = localStorage.getItem('userId');
      const response = await fetch(MAX_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId || '1'
        },
        body: JSON.stringify({ action: 'get_admin_settings' })
      });

      const data = await response.json();
      
      if (data.error) {
        toast.error(data.error);
      } else {
        setSettings(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки настроек:', error);
      toast.error('Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center items-center py-12">
          <Icon name="Loader2" className="animate-spin" size={32} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-lg border-2 border-primary/20">
      <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50">
        <CardTitle className="flex items-center gap-2">
          <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
            <Icon name="MessageSquare" size={20} className="text-white" />
          </div>
          Глобальные настройки MAX
        </CardTitle>
        <CardDescription>
          Единый аккаунт MAX для отправки сообщений всем клиентам от имени фотографов
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-6 space-y-6">
        {settings.configured ? (
          <>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-700 mb-2">
                <Icon name="CheckCircle2" size={20} />
                <span className="font-semibold">MAX настроен и работает</span>
              </div>
              <div className="text-sm space-y-1 text-gray-700">
                <p>Instance ID: <span className="font-mono">{settings.instance_id}</span></p>
                <p>Token: <span className="font-mono">{settings.token_masked}</span></p>
              </div>
            </div>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Icon name="Info" size={20} className="text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-900 space-y-2">
                  <p className="font-semibold">Как работает единая система:</p>
                  <ul className="list-disc list-inside space-y-1 text-blue-800">
                    <li>Все фотографы используют один MAX аккаунт</li>
                    <li>Сообщения отправляются только своим клиентам</li>
                    <li>Система автоматически проверяет принадлежность клиента</li>
                    <li>История переписки сохраняется в карточке клиента</li>
                  </ul>
                </div>
              </div>
            </div>

            <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Icon name="Key" size={20} className="text-purple-600 mt-0.5" />
                <div className="text-sm text-purple-900 space-y-2">
                  <p className="font-semibold">Управление credentials:</p>
                  <p className="text-purple-800">
                    Credentials хранятся в секретах платформы (MAX_INSTANCE_ID и MAX_TOKEN).
                    Для изменения используйте панель управления секретами в настройках проекта.
                  </p>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-amber-700 mb-2">
                <Icon name="AlertCircle" size={20} />
                <span className="font-semibold">MAX не настроен</span>
              </div>
              <p className="text-sm text-amber-800">
                Для работы системы необходимо добавить секреты MAX_INSTANCE_ID и MAX_TOKEN в настройках проекта.
              </p>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <Icon name="Info" size={20} className="text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-900 space-y-2">
                  <p className="font-semibold">Как настроить:</p>
                  <ol className="list-decimal list-inside space-y-1 text-blue-800">
                    <li>Зарегистрируйтесь в GREEN-API и получите Instance ID и Token</li>
                    <li>Перейдите в панель управления секретами проекта</li>
                    <li>Добавьте секрет MAX_INSTANCE_ID со значением вашего Instance ID</li>
                    <li>Добавьте секрет MAX_TOKEN со значением вашего Token</li>
                    <li>Обновите эту страницу для проверки статуса</li>
                  </ol>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default MaxSettings;
