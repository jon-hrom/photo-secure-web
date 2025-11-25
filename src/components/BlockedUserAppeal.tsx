import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

interface BlockedUserAppealProps {
  userId?: number;
  userEmail?: string;
  userPhone?: string;
  authMethod?: string;
  onClose?: () => void;
}

const BlockedUserAppeal = ({ 
  userId, 
  userEmail, 
  userPhone, 
  authMethod = 'unknown',
  onClose 
}: BlockedUserAppealProps) => {
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!message.trim()) {
      toast.error('Пожалуйста, напишите сообщение');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'submit_appeal',
          user_identifier: userEmail || userPhone || `user_${userId}`,
          user_email: userEmail,
          user_phone: userPhone,
          auth_method: authMethod,
          message: message.trim()
        }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        toast.success('Ваше обращение отправлено администратору', {
          description: 'Мы рассмотрим ваш запрос в ближайшее время'
        });
        setMessage('');
        if (onClose) {
          setTimeout(() => onClose(), 2000);
        }
      } else {
        toast.error('Ошибка при отправке обращения', {
          description: data.error || 'Попробуйте позже'
        });
      }
    } catch (error) {
      console.error('Appeal submission error:', error);
      toast.error('Ошибка сети', {
        description: 'Проверьте подключение к интернету'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-lg mx-auto shadow-2xl border-red-200">
      <CardHeader className="bg-gradient-to-r from-red-50 to-orange-50">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-red-100 rounded-full">
            <Icon name="ShieldAlert" size={24} className="text-red-600" />
          </div>
          <div>
            <CardTitle className="text-xl">Доступ заблокирован</CardTitle>
            <CardDescription>Обратитесь к администратору</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-6 space-y-4">
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
          <div className="flex gap-3">
            <Icon name="Info" className="text-amber-600 flex-shrink-0 mt-0.5" size={18} />
            <p className="text-sm text-amber-800">
              Ваш аккаунт был заблокирован администратором. Опишите ситуацию, и мы рассмотрим ваше обращение.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">Ваше сообщение</label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Опишите, почему вы считаете блокировку ошибочной или что произошло..."
              className="min-h-[150px] resize-none"
              disabled={loading}
            />
            <p className="text-xs text-muted-foreground mt-2">
              Минимум 10 символов
            </p>
          </div>

          <div className="flex gap-3 flex-col sm:flex-row">
            <Button
              type="submit"
              disabled={loading || message.trim().length < 10}
              className="flex-1"
            >
              {loading ? (
                <>
                  <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                  Отправка...
                </>
              ) : (
                <>
                  <Icon name="Send" size={16} className="mr-2" />
                  Отправить обращение
                </>
              )}
            </Button>
            {onClose && (
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={loading}
              >
                Закрыть
              </Button>
            )}
          </div>
        </form>

        <div className="pt-4 border-t">
          <div className="flex items-start gap-2">
            <Icon name="Clock" className="text-muted-foreground flex-shrink-0 mt-0.5" size={16} />
            <p className="text-xs text-muted-foreground">
              Администратор рассматривает обращения в течение 24-48 часов. Вы получите ответ на указанный при регистрации email.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default BlockedUserAppeal;
