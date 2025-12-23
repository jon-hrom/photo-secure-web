import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import BlockedUserAppeal from '@/components/BlockedUserAppeal';
import TwoFactorDialog from '@/components/TwoFactorDialog';
import funcUrls from '../../backend/func2url.json';

const GoogleCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [processing, setProcessing] = useState(true);
  const [showAppealDialog, setShowAppealDialog] = useState(false);
  const [show2FADialog, setShow2FADialog] = useState(false);
  const [twoFactorData, setTwoFactorData] = useState<{
    userId: number;
    userEmail: string;
    tempToken: string;
    profile: any;
  } | null>(null);
  const [blockedUserData, setBlockedUserData] = useState<{
    userId?: number;
    userEmail?: string;
    authMethod?: string;
  } | null>(null);

  useEffect(() => {
    const processCallback = async () => {
      const code = searchParams.get('code');
      const state = searchParams.get('state');

      console.log('GoogleCallback: code=', code, 'state=', state);

      if (!code || !state) {
        console.error('GoogleCallback: Missing code or state');
        toast.error('Некорректные параметры авторизации');
        navigate('/');
        return;
      }

      try {
        const googleAuthUrl = funcUrls['google-auth'];
        console.log('GoogleCallback: Calling backend:', googleAuthUrl);
        const response = await fetch(`${googleAuthUrl}?code=${code}&state=${state}`);
        const data = await response.json();

        console.log('GoogleCallback: Backend response:', data);

        if (response.status === 403 && data.blocked) {
          console.log('GoogleCallback: User is blocked');
          toast.error(data.message || 'Ваш аккаунт заблокирован администратором');
          setBlockedUserData({
            userId: data.user_id,
            userEmail: data.user_email,
            authMethod: data.auth_method || 'google'
          });
          setShowAppealDialog(true);
          setProcessing(false);
          return;
        }
        
        if (data.requires2FA) {
          console.log('GoogleCallback: 2FA required');
          setTwoFactorData({
            userId: data.user_id,
            userEmail: data.user_email,
            tempToken: data.temp_token,
            profile: data.profile
          });
          setShow2FADialog(true);
          setProcessing(false);
          toast.info('Требуется двухфакторная аутентификация');
          return;
        }
        
        if (data.success && data.profile) {
          const { profile, user_id } = data;
          
          const userData = {
            user_id: user_id,
            google_sub: profile.sub,
            email: profile.email,
            name: profile.name,
            avatar: profile.picture,
            verified_email: profile.verified_email
          };
          
          localStorage.setItem('google_user', JSON.stringify(userData));
          localStorage.setItem('auth_token', data.session_id);

          toast.success(`Добро пожаловать, ${profile.name || 'пользователь'}!`);
          navigate('/');
        } else {
          console.error('GoogleCallback: Auth failed:', data);
          toast.error(data.error || 'Ошибка авторизации');
          navigate('/');
        }
      } catch (error) {
        console.error('GoogleCallback: Exception:', error);
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
      google_sub: twoFactorData.profile.sub,
      email: twoFactorData.profile.email,
      name: twoFactorData.profile.name,
      avatar: twoFactorData.profile.picture,
      verified_email: twoFactorData.profile.verified_email
    };
    
    localStorage.setItem('google_user', JSON.stringify(userData));
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
            <p className="text-lg text-gray-700">Обработка авторизации Google...</p>
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
    </div>
  );
};

export default GoogleCallback;