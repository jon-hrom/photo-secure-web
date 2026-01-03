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
      <div className="bg-gradient-to-r from-purple-500 to-pink-500 text-white p-4 rounded-lg flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-3">
          <Icon name="Shield" size={24} />
          <div>
            <h3 className="font-semibold">Режим администратора</h3>
            <p className="text-sm opacity-90">Вы просматриваете Фото банк пользователя ID: {userId}</p>
          </div>
        </div>
        <button
          onClick={onExitAdminView}
          className="flex items-center gap-2 px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-colors"
        >
          <Icon name="LogOut" size={18} />
          Выйти из режима просмотра
        </button>
      </div>
    </div>
  );
};

export default PhotoBankAdminBanner;
