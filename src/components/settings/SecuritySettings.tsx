import ChangePassword from './ChangePassword';

interface SecuritySettingsProps {
  userId: number;
  hasPassword: boolean;
  userSource?: string | null;
}

const SecuritySettings = ({ userId, hasPassword, userSource }: SecuritySettingsProps) => {
  return (
    <section>
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Безопасность</h2>
      
      {hasPassword ? (
        <div className="space-y-4">
          <ChangePassword userId={userId} />
          <p className="text-sm text-gray-500">
            Используйте надёжный пароль для защиты аккаунта
          </p>
        </div>
      ) : (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-medium text-blue-900 mb-1">
                Вход через {userSource === 'vk' ? 'ВКонтакте' : userSource === 'google' ? 'Google' : 'OAuth'}
              </h3>
              <p className="text-sm text-blue-700">
                Ваш аккаунт защищён через внешний сервис. Для управления паролем используйте настройки {userSource === 'vk' ? 'ВКонтакте' : 'Google'}.
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default SecuritySettings;
