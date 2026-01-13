import Icon from '@/components/ui/icon';

interface PasswordFormProps {
  password: string;
  passwordError: string;
  onPasswordChange: (value: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function PasswordForm({ password, passwordError, onPasswordChange, onSubmit }: PasswordFormProps) {
  return (
    <div className="min-h-screen bg-[#000000] flex items-center justify-center p-4">
      <div className="bg-[#111111] rounded-lg shadow-lg p-8 max-w-md w-full border border-gray-800">
        <div className="text-center mb-6">
          <Icon name="Lock" size={48} className="text-[#4cc9f0] mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Защищённая галерея</h1>
          <p className="text-gray-400">Введите пароль для доступа</p>
        </div>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => onPasswordChange(e.target.value)}
              placeholder="Пароль"
              className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#4cc9f0] focus:border-transparent"
              autoFocus
            />
            {passwordError && (
              <p className="text-red-500 text-sm mt-2">{passwordError}</p>
            )}
          </div>
          <button
            type="submit"
            className="w-full bg-[#4cc9f0] text-black py-3 rounded-lg hover:bg-[#3bb8df] transition-colors font-medium"
          >
            Войти
          </button>
        </form>
      </div>
    </div>
  );
}