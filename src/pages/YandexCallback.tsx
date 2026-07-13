import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BlockedUserAppeal from '@/components/BlockedUserAppeal';
import TwoFactorDialog from '@/components/TwoFactorDialog';
import LegalConsentModal from '@/components/login/LegalConsentModal';
import OAuthProfileDialog from '@/components/login/OAuthProfileDialog';
import { fetchPendingDocs } from '@/lib/legalApi';

const YANDEX_AUTH_URL = 'https://functions.poehali.dev/e5943511-d507-4fb9-bbb0-2431e3eb0d9a';

const YandexCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);
  const [showAppealDialog, setShowAppealDialog] = useState(false);
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState<{
    userId: number;
    userEmail: string;
    tempToken: string;
    profile: Record<string, unknown>;
  } | null>(null);
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

      console.log('YandexCallback: code=', code, 'state=', state);

      if (!code || !state) {
        console.error('YandexCallback: Missing code or state');
        toast.error('Некорректные параметры авторизации');
        navigate('/');
        return;
      }

      try {
        const response = await fetch(`${YANDEX_AUTH_URL}?code=${code}&state=${state}`);
        const data = await response.json();

        console.log('YandexCallback: Backend response:', data);

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
          console.log('YandexCallback: User is blocked');
          toast.error(data.message || 'Ваш аккаунт заблокирован администратором');
          setBlockedUserData({
            userId: data.user_id,
            userEmail: data.user_email,
            authMethod: data.auth_method || 'yandex'
          });
          setShowAppealDialog(true);
          setProcessing(false);
          return;
        }

        if (data.requires_2fa) {
          console.log('YandexCallback: 2FA required');
          setTwoFactorData({
            userId: data.user_id,
            userEmail: data.user_email,
            tempToken: data.temp_token,
            profile: data.profile || {}
          });
          setShow2FADialog(true);
          setProcessing(false);
          toast.info('Требуется двухфакторная аутентификация');
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

        if (data.success && data.user) {
          const { user, user_id, session_token } = data;

          const userData = {
            user_id: user_id,
            yandex_id: user.id,
            email: user.email,
            name: user.name,
            avatar: user.picture,
            verified_email: user.verified_email
          };

          localStorage.setItem('yandex_user', JSON.stringify(userData));
          localStorage.setItem('auth_token', session_token);
          localStorage.setItem('userId', user_id.toString());

          const pending = await fetchPendingDocs(String(user_id));
          if (pending.length > 0) {
            setShowConsentModal(true);
            setPendingNavigate(true);
            setProcessing(false);
            return;
          }

          toast.success(`Добро пожаловать, ${user.name || 'пользователь'}!`);
          navigate('/');
        } else {
          console.error('YandexCallback: Auth failed:', data);
          toast.error(data.error || 'Ошибка авторизации');
          navigate('/');
        }
      } catch (error) {
        console.error('YandexCallback: Exception:', error);
        toast.error('Ошибка обработки авторизации');
        navigate('/');
      } finally {
        setProcessing(false);
      }
    };

    processCallback();
  }, [searchParams, navigate]);

  const handle2FASuccess = () => {
    if (!twoFactorData) return;

    const userData = {
      user_id: twoFactorData.userId,
      yandex_id: twoFactorData.profile.id,
      email: twoFactorData.profile.email,
      name: twoFactorData.profile.name,
      avatar: twoFactorData.profile.picture,
      verified_email: twoFactorData.profile.verified_email
    };

    localStorage.setItem('yandex_user', JSON.stringify(userData));
    localStorage.setItem('auth_token', twoFactorData.tempToken);

    toast.success(`Добро пожаловать, ${twoFactorData.profile.name || 'пользователь'}!`);
    navigate('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-pink-100">
      <div className="text-center">
        {processing ? (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <p className="text-lg text-gray-700">Обработка авторизации Яндекс...</p>
          </>
        ) : showAppealDialog ? (
          <p className="text-lg text-gray-700">Ваш аккаунт заблокирован</p>
        ) : show2FADialog ? (
          <p className="text-lg text-gray-700">Требуется подтверждение...</p>
        ) : (
          <p className="text-lg text-gray-700">Перенаправление...</p>
        )}
      </div>

      {show2FADialog && twoFactorData && (
        <TwoFactorDialog
          open={show2FADialog}
          userId={twoFactorData.userId}
          userEmail={twoFactorData.userEmail}
          type="email"
          onSuccess={handle2FASuccess}
          onCancel={() => {
            setShow2FADialog(false);
            navigate('/');
          }}
        />
      )}

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
          provider="yandex"
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
            const storedUser = localStorage.getItem('yandex_user');
            const name = storedUser ? JSON.parse(storedUser).name : 'пользователь';
            toast.success(`Добро пожаловать, ${name}!`);
            navigate('/');
          }}
          onCancel={() => {
            setShowConsentModal(false);
            localStorage.removeItem('yandex_user');
            localStorage.removeItem('auth_token');
            localStorage.removeItem('userId');
            navigate('/');
          }}
        />
      )}
    </div>
  );
};

export default YandexCallback;