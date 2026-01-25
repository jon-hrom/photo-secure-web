import Icon from '@/components/ui/icon';

interface PhotoBankAdminBannerProps {
  isAdminViewing: boolean;
  userId: string | null;
  onExitAdminView: () => void;
}

const PhotoBankAdminBanner = ({ isAdminViewing, userId, onExitAdminView }: PhotoBankAdminBannerProps) => {
  if (!isAdminViewing) return null;

  return (
    <div className="max-w-7xl mx-auto mb-4">
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-3 rounded-lg flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2">
          <Icon name="Shield" size={20} />
          <div>
            <h3 className="font-semibold text-sm">Режим администратора</h3>
            <p className="text-xs opacity-90">Просмотр пользователя ID: {userId}</p>
          </div>
        </div>
        <button
          onClick={onExitAdminView}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 rounded-lg transition-colors text-sm"
        >
          <Icon name="LogOut" size={16} />
          Выйти
        </button>
      </div>
    </div>
  );
};

export default PhotoBankAdminBanner;