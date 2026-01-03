import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import Disable2FACodeDialog from './Disable2FACodeDialog';
import UserDetailsInfo from './UserDetailsInfo';
import UserTwoFactorSection from './UserTwoFactorSection';
import UserManagementActions from './UserManagementActions';

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
  two_factor_sms?: boolean;
  two_factor_email?: boolean;
}

interface UserDetailsModalProps {
  user: User | null;
  isOpen: boolean;
  onClose: () => void;
  onBlock: (userId: string | number, reason: string) => void;
  onUnblock: (userId: string | number) => void;
  onDelete: (userId: string | number) => void;
  onOpenPhotoBank?: (userId: string | number) => void;
}

const UserDetailsModal = ({ user, isOpen, onClose, onBlock, onUnblock, onDelete, onOpenPhotoBank }: UserDetailsModalProps) => {
  const [blockReason, setBlockReason] = useState('');
  const [showBlockForm, setShowBlockForm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [geoData, setGeoData] = useState<{country: string; city: string; flag: string} | null>(null);
  const [loadingGeo, setLoadingGeo] = useState(false);
  const [showDisable2FADialog, setShowDisable2FADialog] = useState(false);
  const [disable2FAType, setDisable2FAType] = useState<'sms' | 'email' | 'both'>('both');
  const [twoFactorSettings, setTwoFactorSettings] = useState<{sms: boolean; email: boolean} | null>(null);
  const [loadingRequest, setLoadingRequest] = useState(false);

  useEffect(() => {
    if (user?.ip_address && user.ip_address !== 'unknown' && isOpen) {
      setLoadingGeo(true);
      fetch(`https://ipapi.co/${user.ip_address}/json/`)
        .then(res => res.json())
        .then(data => {
          if (data.country_name && data.city) {
            setGeoData({
              country: data.country_name,
              city: data.city,
              flag: data.country_code ? `https://flagcdn.com/24x18/${data.country_code.toLowerCase()}.png` : ''
            });
          }
        })
        .catch(() => setGeoData(null))
        .finally(() => setLoadingGeo(false));
    }
  }, [user?.ip_address, isOpen]);

  useEffect(() => {
    if (user && isOpen && user.source === 'email') {
      fetch(`https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9?userId=${user.id}`)
        .then(res => res.json())
        .then(data => {
          setTwoFactorSettings({
            sms: data.two_factor_sms || false,
            email: data.two_factor_email || false
          });
        })
        .catch(() => setTwoFactorSettings(null));
    }
  }, [user, isOpen]);

  if (!user) return null;

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Не указано';
    return new Date(dateStr).toLocaleString('ru-RU', {
      timeZone: 'Europe/Samara',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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

  const handleDelete = async () => {
    const userName = user.full_name || user.email || user.phone || 'этого пользователя';
    const confirmMessage = `⚠️ ВНИМАНИЕ! Вы собираетесь удалить пользователя:\n\n${userName}\n\nБудут удалены:\n• Профиль пользователя\n• История входов\n• Все связанные данные\n• OAuth сессии\n\nЭто действие НЕЛЬЗЯ отменить!\n\nВы уверены?`;
    
    if (confirm(confirmMessage)) {
      const secondConfirm = `🔴 ПОСЛЕДНЕЕ ПРЕДУПРЕЖДЕНИЕ!\n\nВы действительно хотите БЕЗВОЗВРАТНО удалить пользователя ${userName}?\n\nНажмите OK для окончательного удаления.`;
      
      if (confirm(secondConfirm)) {
        setIsDeleting(true);
        await onDelete(user.id);
        setTimeout(() => {
          setIsDeleting(false);
          onClose();
        }, 1500);
      }
    }
  };

  const handleRequestDisable2FA = async (type: 'sms' | 'email' | 'both') => {
    const typeText = {
      'sms': 'SMS-аутентификацию',
      'email': 'Email-аутентификацию',
      'both': 'всю двухфакторную аутентификацию'
    }[type];
    
    if (!confirm(`Отправить запрос на отключение ${typeText}?\n\nПользователю придёт письмо с кодом подтверждения на ${user.email}`)) {
      return;
    }
    
    try {
      setLoadingRequest(true);
      const adminId = localStorage.getItem('authSession') ? JSON.parse(localStorage.getItem('authSession')!).userId : null;
      
      const res = await fetch('https://functions.poehali.dev/d0cbcec4-bc93-4819-8609-38c55cbe35e4', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Admin-Id': adminId
        },
        body: JSON.stringify({ action: 'request_disable', userId: user.id, disableType: type })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        toast.success(data.message || 'Код отправлен пользователю');
        setDisable2FAType(type);
        setShowDisable2FADialog(true);
      } else if (res.status === 409) {
        toast.info('Запрос уже существует, попросите пользователя ввести код');
        setDisable2FAType(type);
        setShowDisable2FADialog(true);
      } else {
        toast.error(data.error || 'Ошибка запроса');
      }
    } catch (err) {
      toast.error('Ошибка подключения');
      console.error(err);
    } finally {
      setLoadingRequest(false);
    }
  };

  const handle2FADisableSuccess = () => {
    setTwoFactorSettings(prev => {
      if (!prev) return null;
      return {
        sms: disable2FAType === 'both' || disable2FAType === 'sms' ? false : prev.sms,
        email: disable2FAType === 'both' || disable2FAType === 'email' ? false : prev.email
      };
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        {isDeleting && (
          <div className="absolute inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-4">
            <div className="w-64 h-2 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-red-500 via-orange-500 to-red-500 animate-shimmer bg-[length:200%_100%]" />
            </div>
            <p className="text-lg font-medium text-muted-foreground animate-pulse">Удаление пользователя...</p>
          </div>
        )}
        
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Icon name="User" size={24} />
            Детали пользователя
          </DialogTitle>
        </DialogHeader>

        <UserDetailsInfo
          user={user}
          geoData={geoData}
          loadingGeo={loadingGeo}
          formatDate={formatDate}
        />

        <UserTwoFactorSection
          userSource={user.source}
          twoFactorSettings={twoFactorSettings}
          loadingRequest={loadingRequest}
          onRequestDisable={handleRequestDisable2FA}
        />

        <UserManagementActions
          isBlocked={user.is_blocked}
          showBlockForm={showBlockForm}
          blockReason={blockReason}
          userId={user.id}
          onBlockReasonChange={setBlockReason}
          onShowBlockForm={setShowBlockForm}
          onBlock={handleBlock}
          onUnblock={handleUnblock}
          onDelete={handleDelete}
          onOpenPhotoBank={(userId) => {
            onClose();
            if (onOpenPhotoBank) onOpenPhotoBank(userId);
          }}
        />

        {showDisable2FADialog && user && (
          <Disable2FACodeDialog
            open={showDisable2FADialog}
            onClose={() => setShowDisable2FADialog(false)}
            userId={user.id}
            disableType={disable2FAType}
            onSuccess={handle2FADisableSuccess}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

export default UserDetailsModal;