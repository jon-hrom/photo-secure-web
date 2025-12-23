import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import funcUrls from '../../../backend/func2url.json';

interface UserEmail {
  id: number;
  email: string;
  provider: 'email' | 'google' | 'vk' | 'yandex';
  is_primary: boolean;
  is_verified: boolean;
  verified_at: string | null;
  added_at: string;
  last_used_at: string | null;
}

interface MultiEmailCardProps {
  userId: number;
}

const PROVIDER_LABELS: Record<string, string> = {
  email: 'Email/Пароль',
  google: 'Google',
  vk: 'ВКонтакте',
  yandex: 'Яндекс',
};

const PROVIDER_COLORS: Record<string, string> = {
  email: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  google: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  vk: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  yandex: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
};

const MultiEmailCard = ({ userId }: MultiEmailCardProps) => {
  const [emails, setEmails] = useState<UserEmail[]>([]);
  const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [settingPrimary, setSettingPrimary] = useState(false);

  const selectedEmail = emails.find((e) => e.id === selectedEmailId);

  useEffect(() => {
    loadEmails();
  }, [userId]);

  const loadEmails = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${funcUrls['user-settings']}?action=get-emails`, {
        headers: {
          'X-User-Id': userId.toString(),
        },
      });

      if (!response.ok) {
        throw new Error('Ошибка загрузки email-адресов');
      }

      const data = await response.json();
      setEmails(data.emails || []);

      // Автоматически выбираем primary email
      const primary = data.emails.find((e: UserEmail) => e.is_primary);
      if (primary) {
        setSelectedEmailId(primary.id);
      } else if (data.emails.length > 0) {
        setSelectedEmailId(data.emails[0].id);
      }
    } catch (error) {
      console.error('Error loading emails:', error);
      toast.error('Не удалось загрузить список email');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPrimary = async (emailId: number) => {
    try {
      setSettingPrimary(true);
      const response = await fetch(funcUrls['user-settings'], {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId.toString(),
        },
        body: JSON.stringify({
          action: 'set-primary-email',
          email_id: emailId,
        }),
      });

      if (!response.ok) {
        throw new Error('Ошибка установки основного email');
      }

      toast.success('Основной email обновлён');
      await loadEmails();
    } catch (error) {
      console.error('Error setting primary email:', error);
      toast.error('Не удалось установить основной email');
    } finally {
      setSettingPrimary(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'Никогда';
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <Card className="shadow-xl">
        <CardContent className="py-8">
          <div className="flex items-center justify-center">
            <Icon name="Loader2" size={24} className="animate-spin text-purple-600" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="shadow-xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg md:text-xl text-gray-900 dark:text-white">
          <Icon name="Mail" size={20} className="md:w-6 md:h-6" />
          Связанные Email-адреса
        </CardTitle>
        <CardDescription className="text-xs md:text-sm text-muted-foreground dark:text-gray-300">
          Управление email от разных способов входа
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {emails.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Icon name="Inbox" size={48} className="mx-auto mb-3 opacity-50" />
            <p>Нет связанных email-адресов</p>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <Label className="text-sm md:text-base text-gray-900 dark:text-gray-100">
                Выберите email для просмотра
              </Label>
              <Select
                value={selectedEmailId?.toString()}
                onValueChange={(value) => setSelectedEmailId(parseInt(value))}
              >
                <SelectTrigger className="w-full rounded-xl">
                  <SelectValue placeholder="Выберите email" />
                </SelectTrigger>
                <SelectContent>
                  {emails.map((email) => (
                    <SelectItem key={email.id} value={email.id.toString()}>
                      <div className="flex items-center gap-2">
                        <span>{email.email}</span>
                        {email.is_primary && (
                          <Badge variant="default" className="ml-2">
                            Основной
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedEmail && (
              <div className="bg-gradient-to-br from-purple-50 via-pink-50 to-rose-50 dark:from-purple-950/30 dark:via-pink-950/30 dark:to-rose-950/30 rounded-xl p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-1 flex-1 min-w-0">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Email адрес</p>
                    <p className="font-semibold text-gray-900 dark:text-white break-all">
                      {selectedEmail.email}
                    </p>
                  </div>
                  {selectedEmail.is_primary && (
                    <Badge variant="default" className="flex-shrink-0">
                      <Icon name="Star" size={12} className="mr-1" />
                      Основной
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Провайдер</p>
                    <Badge className={PROVIDER_COLORS[selectedEmail.provider] || 'bg-gray-100 text-gray-800'}>
                      {PROVIDER_LABELS[selectedEmail.provider] || selectedEmail.provider}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Статус верификации</p>
                    <Badge
                      variant={selectedEmail.is_verified ? 'default' : 'secondary'}
                      className="gap-1"
                    >
                      <Icon
                        name={selectedEmail.is_verified ? 'CheckCircle' : 'XCircle'}
                        size={14}
                      />
                      {selectedEmail.is_verified ? 'Подтверждён' : 'Не подтверждён'}
                    </Badge>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Добавлен</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDate(selectedEmail.added_at)}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Последний вход</p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {formatDate(selectedEmail.last_used_at)}
                    </p>
                  </div>
                </div>

                {!selectedEmail.is_primary && selectedEmail.is_verified && (
                  <Button
                    onClick={() => handleSetPrimary(selectedEmail.id)}
                    disabled={settingPrimary}
                    className="w-full rounded-xl mt-3"
                    variant="outline"
                  >
                    {settingPrimary ? (
                      <>
                        <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                        Установка...
                      </>
                    ) : (
                      <>
                        <Icon name="Star" size={16} className="mr-2" />
                        Сделать основным
                      </>
                    )}
                  </Button>
                )}

                {!selectedEmail.is_verified && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 mt-3">
                    <div className="flex items-start gap-2">
                      <Icon name="AlertCircle" size={16} className="text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-yellow-800 dark:text-yellow-300">
                        Этот email не подтверждён. Подтвердите его при следующем входе через {PROVIDER_LABELS[selectedEmail.provider]}.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mt-4">
              <div className="flex items-start gap-2">
                <Icon name="Info" size={16} className="text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
                  <p><strong>Основной email</strong> используется для:</p>
                  <ul className="list-disc list-inside space-y-0.5 ml-2">
                    <li>Отправки уведомлений и кодов 2FA</li>
                    <li>Восстановления пароля</li>
                    <li>Важных сообщений от системы</li>
                  </ul>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};

const Label = ({ children, className = '' }: { children: React.ReactNode; className?: string }) => (
  <label className={`block font-medium ${className}`}>{children}</label>
);

export default MultiEmailCard;
