import Icon from '@/components/ui/icon';
import PasswordForm from './PasswordForm';
import BlockedContactButton from './BlockedContactButton';

interface LoadingScreenProps {
  type: 'loading';
}

interface BlockedScreenProps {
  type: 'blocked';
  code: string | undefined;
  photographerEmail: string | null;
  photographerId: number | null;
}

interface ErrorScreenProps {
  type: 'error';
  error: string;
}

interface PasswordScreenProps {
  type: 'password';
  password: string;
  passwordError: string;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

type GalleryStatusScreenProps = LoadingScreenProps | BlockedScreenProps | ErrorScreenProps | PasswordScreenProps;

const GalleryStatusScreens = (props: GalleryStatusScreenProps) => {
  if (props.type === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Icon name="Loader2" size={48} className="animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Загрузка галереи...</p>
        </div>
      </div>
    );
  }

  if (props.type === 'blocked') {
    if (props.code) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.includes(props.code)) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
    }
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Icon name="ShieldOff" size={32} className="text-red-600" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">Ссылка недоступна</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Ссылка была заблокирована или удалена по истечению времени действия ссылки. 
            Обратитесь к вашему фотографу для создания новой ссылки с вашими фото.
          </p>
          {props.photographerEmail && (
            <div className="bg-gray-50 rounded-lg p-4 mb-2">
              <p className="text-sm text-gray-500 mb-1">Почта фотографа:</p>
              <a 
                href={`mailto:${props.photographerEmail}`} 
                className="text-blue-600 hover:text-blue-700 font-medium text-lg"
              >
                {props.photographerEmail}
              </a>
            </div>
          )}
          {props.code ? (
            <BlockedContactButton
              code={props.code}
              photographerId={props.photographerId}
              photographerEmail={props.photographerEmail}
            />
          ) : props.photographerEmail ? (
            <a
              href={`mailto:${props.photographerEmail}`}
              className="group relative mt-2 block w-full overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 px-6 py-4 text-center font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98]"
            >
              <span className="flex items-center justify-center gap-2">
                <Icon name="Mail" size={20} />
                Написать фотографу
              </span>
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  if (props.type === 'error') {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-md p-8 max-w-md w-full text-center">
          <Icon name="AlertCircle" size={48} className="text-red-600 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Ошибка</h2>
          <p className="text-gray-600">{props.error}</p>
        </div>
      </div>
    );
  }

  if (props.type === 'password') {
    return (
      <PasswordForm
        password={props.password}
        passwordError={props.passwordError}
        onPasswordChange={props.onPasswordChange}
        onSubmit={props.onSubmit}
      />
    );
  }

  return null;
};

export default GalleryStatusScreens;