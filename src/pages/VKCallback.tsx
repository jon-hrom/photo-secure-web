import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BlockedUserAppeal from '@/components/BlockedUserAppeal';
import LegalConsentModal from '@/components/login/LegalConsentModal';
import OAuthProfileDialog from '@/components/login/OAuthProfileDialog';
import { fetchPendingDocs } from '@/lib/legalApi';

const VKCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);
  const [showAppealDialog, setShowAppealDialog] = useState(false);
  const [blockedUserData, setBlockedUserData] = useState<{
    userId?: number;
    userEmail?: string;
    authMethod?: string;
  } | null>(null);
  const [showConsentModal, setShowConsentModal] = useState(false);
  const [pendingNavigate, setPendingNavigate] = useState(false);
  const [profileData, setProfileData] = useState<{
    userId: number;
    email?: string;
    phone?: string;
  } | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');
      const device_id = searchParams.get('device_id');

      console.log('VKCallback: code=', code, 'state=', state, 'device_id=', device_id);

      if (!code || !state) {
        console.error('VKCallback: Missing code or state');
        toast.error('Некорректные параметры авторизации');
        navigate('/');
        return;
      }

      try {
        const vkAuthUrl = 'https://functions.poehali.dev/2cc3877b-e2f8-496e-98b2-9c8a8ec9950d';
        console.log('VKCallback: Calling backend:', vkAuthUrl);
        const callbackUrl = `${vkAuthUrl}?action=callback&code=${code}&state=${state}${device_id ? `&device_id=${device_id}` : ''}`;
        const response = await fetch(callbackUrl);
        const data = await response.json();

        console.log('VKCallback: Backend response:', data);

        if (response.status === 403 && data.registration_disabled) {
          toast.error('Регистрация сейчас временно недоступна, попробуйте позже.', {
            description: 'Создание новых аккаунтов приостановлено администратором.',
            duration: 6000,
          });
          setProcessing(false);
          navigate('/');
          return;
        }

        if (response.status === 403 && data.blocked) {
          console.log('VKCallback: User is blocked');
          toast.error(data.message || 'Ваш аккаунт заблокирован администратором');
          setBlockedUserData({
            userId: data.user_id,
            userEmail: data.user_email,
            authMethod: data.auth_method || 'vk'
          });
          setShowAppealDialog(true);
          setProcessing(false);
          return;
        }
        
        if (data.success && data.needs_profile) {
          const profile = data.profile || {};
          setProfileData({
            userId: data.user_id,
            email: profile.email,
            phone: profile.phone,
          });
          setProcessing(false);
          return;
        }

        if (data.success && (data.profile || data.userData)) {
          const profile = data.profile || data.userData;
          const user_id = data.user_id;
          
          const userData = {
            user_id: user_id,
            vk_id: profile.vk_id || profile.sub,
            email: profile.email,
            name: profile.name,
            avatar: profile.avatar || profile.picture,
            verified: profile.verified || profile.is_verified || false,
            phone: profile.phone || profile.phone_number
          };
          
          console.log('VKCallback: Saving to localStorage:', userData);
          localStorage.setItem('vk_user', JSON.stringify(userData));
          localStorage.setItem('auth_token', data.token || data.session_id);
          localStorage.setItem('userId', user_id.toString());
          console.log('VKCallback: Saved. Checking...');
          console.log('VKCallback: vk_user =', localStorage.getItem('vk_user'));
          console.log('VKCallback: auth_token =', localStorage.getItem('auth_token'));
          console.log('VKCallback: userId =', localStorage.getItem('userId'));

          await new Promise(resolve => setTimeout(resolve, 100));

          const pending = await fetchPendingDocs(String(user_id));
          if (pending.length > 0) {
            setShowConsentModal(true);
            setPendingNavigate(true);
            setProcessing(false);
            return;
          }

          toast.success(`Добро пожаловать, ${profile.name || 'пользователь'}!`);
          navigate('/');
        } else {
          console.error('VKCallback: Auth failed:', data);
          toast.error(data.error || 'Ошибка авторизации');
          navigate('/');
        }
      } catch (error) {
        console.error('VKCallback: Exception:', error);
        toast.error('Ошибка обработки авторизации');
        navigate('/');
      } finally {
        setProcessing(false);
      }
    };

    processCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center">
        {processing ? (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-lg text-gray-700">Обработка авторизации VK...</p>
          </>
        ) : showAppealDialog ? (
          <p className="text-lg text-gray-700">Ваш аккаунт заблокирован</p>
        ) : (
          <p className="text-lg text-gray-700">Перенаправление...</p>
        )}
      </div>

      <Dialog open={showAppealDialog} onOpenChange={(open) => {
        setShowAppealDialog(open);
        if (!open) navigate('/');
      }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="sr-only">Форма обращения к администратору</DialogTitle>
          </DialogHeader>
          <BlockedUserAppeal
            userId={blockedUserData?.userId}
            userEmail={blockedUserData?.userEmail}
            authMethod={blockedUserData?.authMethod}
            onClose={() => {
              setShowAppealDialog(false);
              navigate('/');
            }}
          />
        </DialogContent>
      </Dialog>

      {profileData && (
        <OAuthProfileDialog
          open={true}
          userId={profileData.userId}
          provider="vk"
          presetEmail={profileData.email}
          presetPhone={profileData.phone}
          onDone={() => {
            setProfileData(null);
            navigate('/');
          }}
        />
      )}

      {showConsentModal && pendingNavigate && (
        <LegalConsentModal
          open={showConsentModal}
          userId={localStorage.getItem('userId') || ''}
          onAccepted={() => {
            setShowConsentModal(false);
            const storedUser = localStorage.getItem('vk_user');
            const name = storedUser ? JSON.parse(storedUser).name : 'пользователь';
            toast.success(`Добро пожаловать, ${name}!`);
            navigate('/');
          }}
          onCancel={() => {
            setShowConsentModal(false);
            localStorage.removeItem('vk_user');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('userId');
            navigate('/');
          }}
        />
      )}
    </div>
  );
};

export default VKCallback;