import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Textarea } from '@/components/ui/textarea';
import { useState } from 'react';

interface User {
  id: string | number;
  source: 'email' | 'vk' | 'google' | 'yandex';
  email: string | null;
  phone: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
  is_active: boolean;
  is_blocked: boolean;
  ip_address: string | null;
  last_login: string | null;
  user_agent: string | null;
  blocked_at: string | null;
  blocked_reason: string | null;
  registered_at: string | null;
}

interface UserDetailsModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onBlock: (userId: string | number, reason: string) => void;
  onUnblock: (userId: string | number) => void;
  onDelete: (userId: string | number) => void;
}

const UserDetailsModal = ({ user, isOpen, onClose, onBlock, onUnblock, onDelete }: UserDetailsModalProps) => {
  const [blockReason, setBlockReason] = useState('');
  const [showBlockForm, setShowBlockForm] = useState(false);

  if (!user) return null;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Не указано';
    return new Date(dateStr).toLocaleString('ru-RU');
  };

  const handleBlock = () => {
    if (!blockReason.trim()) {
      alert('Укажите причину блокировки');
      return;
    }
    onBlock(user.id, blockReason);
    setShowBlockForm(false);
    setBlockReason('');
    onClose();
  };

  const handleUnblock = () => {
    onUnblock(user.id);
    onClose();
  };

  const handleDelete = () => {
    const userName = user.email || user.full_name || user.phone || 'этого пользователя';
    if (confirm(`Вы уверены, что хотите удалить пользователя ${userName}? Это действие нельзя отменить.`)) {
      onDelete(user.id);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Icon name="User" size={24} />
            Детали пользователя
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {user.avatar_url && (
            <div className="flex items-center gap-4">
              <img 
                src={user.avatar_url} 
                alt={user.full_name || 'User avatar'} 
                className="w-20 h-20 rounded-full object-cover border-4 border-primary/20"
              />
              <div>
                {user.full_name && (
                  <h3 className="text-xl font-semibold">{user.full_name}</h3>
                )}
                <Badge variant="outline" className="mt-1">
                  {user.source === 'vk' && 'VK ID'}
                  {user.source === 'email' && 'Email'}
                  {user.source === 'google' && 'Google'}
                  {user.source === 'yandex' && 'Яндекс'}
                </Badge>
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            {user.is_blocked ? (
              <Badge variant="destructive" className="gap-1">
                <Icon name="Ban" size={14} />
                Заблокирован
              </Badge>
            ) : (
              <Badge variant="default" className="gap-1">
                <Icon name="CheckCircle" size={14} />
                Активен
              </Badge>
            )}
            {user.is_active && (
              <Badge variant="outline">Подтвержден</Badge>
            )}
            <Badge variant="outline">
              Источник: {user.source === 'vk' ? 'VK ID' : user.source === 'email' ? 'Email' : user.source}
            </Badge>
          </div>

          <div className="grid gap-4">
            {user.full_name && (
              <div className="border-l-4 border-purple-500 pl-4 py-2 bg-muted/30 rounded-r">
                <div className="text-sm text-muted-foreground mb-1">Имя</div>
                <div className="font-medium flex items-center gap-2">
                  <Icon name="User" size={16} className="text-purple-500" />
                  {user.full_name}
                </div>
              </div>
            )}

            {user.email && (
              <div className="border-l-4 border-primary pl-4 py-2 bg-muted/30 rounded-r">
                <div className="text-sm text-muted-foreground mb-1">Email</div>
                <div className="font-medium flex items-center gap-2">
                  <Icon name="Mail" size={16} className="text-primary" />
                  {user.email}
                </div>
              </div>
            )}

            {user.phone && (
              <div className="border-l-4 border-blue-500 pl-4 py-2 bg-muted/30 rounded-r">
                <div className="text-sm text-muted-foreground mb-1">Телефон</div>
                <div className="font-medium flex items-center gap-2">
                  <Icon name="Phone" size={16} className="text-blue-500" />
                  {user.phone}
                </div>
              </div>
            )}

            <div className="border-l-4 border-green-500 pl-4 py-2 bg-muted/30 rounded-r">
              <div className="text-sm text-muted-foreground mb-1">IP адрес</div>
              <div className="font-medium flex items-center gap-2">
                <Icon name="Globe" size={16} className="text-green-500" />
                {user.ip_address || 'Не указан'}
              </div>
            </div>

            <div className="border-l-4 border-orange-500 pl-4 py-2 bg-muted/30 rounded-r">
              <div className="text-sm text-muted-foreground mb-1">Дата регистрации</div>
              <div className="font-medium flex items-center gap-2">
                <Icon name="Calendar" size={16} className="text-orange-500" />
                {formatDate(user.registered_at || user.created_at)}
              </div>
            </div>

            {user.last_login && (
              <div className="border-l-4 border-purple-500 pl-4 py-2 bg-muted/30 rounded-r">
                <div className="text-sm text-muted-foreground mb-1">Последний вход</div>
                <div className="font-medium flex items-center gap-2">
                  <Icon name="Clock" size={16} className="text-purple-500" />
                  {formatDate(user.last_login)}
                </div>
              </div>
            )}

            {user.user_agent && (
              <div className="border-l-4 border-cyan-500 pl-4 py-2 bg-muted/30 rounded-r">
                <div className="text-sm text-muted-foreground mb-1">Устройство / Браузер</div>
                <div className="font-medium text-sm flex items-center gap-2">
                  <Icon name="Monitor" size={16} className="text-cyan-500" />
                  <span className="break-all">{user.user_agent}</span>
                </div>
              </div>
            )}

            {user.is_blocked && user.blocked_reason && (
              <div className="border-l-4 border-red-500 pl-4 py-2 bg-red-50 dark:bg-red-950/20 rounded-r">
                <div className="text-sm text-red-600 dark:text-red-400 mb-1">Причина блокировки</div>
                <div className="font-medium text-red-700 dark:text-red-300 flex items-start gap-2">
                  <Icon name="AlertTriangle" size={16} className="mt-0.5" />
                  <span>{user.blocked_reason}</span>
                </div>
                {user.blocked_at && (
                  <div className="text-xs text-red-600 dark:text-red-400 mt-2">
                    Заблокирован: {formatDate(user.blocked_at)}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t pt-4 space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <Icon name="Settings" size={18} />
              Управление пользователем
            </h4>

            {!user.is_blocked ? (
              <>
                {!showBlockForm ? (
                  <Button
                    variant="destructive"
                    onClick={() => setShowBlockForm(true)}
                    className="w-full gap-2"
                  >
                    <Icon name="Ban" size={18} />
                    Заблокировать пользователя
                  </Button>
                ) : (
                  <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
                    <label className="text-sm font-medium">
                      Причина блокировки
                    </label>
                    <Textarea
                      value={blockReason}
                      onChange={(e) => setBlockReason(e.target.value)}
                      placeholder="Укажите причину блокировки..."
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="destructive"
                        onClick={handleBlock}
                        className="flex-1 gap-2"
                      >
                        <Icon name="Ban" size={16} />
                        Подтвердить блокировку
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowBlockForm(false);
                          setBlockReason('');
                        }}
                        className="flex-1"
                      >
                        Отмена
                      </Button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <Button
                variant="default"
                onClick={handleUnblock}
                className="w-full gap-2"
              >
                <Icon name="CheckCircle" size={18} />
                Разблокировать пользователя
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handleDelete}
              className="w-full gap-2 border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
            >
              <Icon name="Trash2" size={18} />
              Удалить пользователя и все данные
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserDetailsModal;