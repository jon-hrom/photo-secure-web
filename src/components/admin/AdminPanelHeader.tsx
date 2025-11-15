import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface AdminPanelHeaderProps {
  vkUser: any;
  showHistory: boolean;
  onToggleHistory: () => void;
  onSaveSettings: () => void;
}

const AdminPanelHeader = ({ vkUser, showHistory, onToggleHistory, onSaveSettings }: AdminPanelHeaderProps) => {
  return (
    <>
      {vkUser && (
        <Card className="bg-gradient-to-br from-blue-500 to-purple-600 text-white border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              {vkUser.avatar && (
                <div className="relative">
                  <img 
                    src={vkUser.avatar} 
                    alt={vkUser.name}
                    className="w-16 h-16 rounded-full border-4 border-white shadow-lg"
                  />
                  {vkUser.is_verified && (
                    <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1">
                      <Icon name="BadgeCheck" size={16} className="text-blue-500" />
                    </div>
                  )}
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-bold">{vkUser.name || 'Пользователь VK'}</h3>
                  {vkUser.is_verified && (
                    <Icon name="BadgeCheck" size={20} className="text-white" />
                  )}
                  {(vkUser.name && vkUser.name.includes('Пономарев Евгений')) && (
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold border border-white/30">
                      Администратор
                    </span>
                  )}
                </div>
                <p className="text-sm opacity-90">{vkUser.email || 'Вход через VK ID'}</p>
                {vkUser.phone && (
                  <p className="text-xs opacity-75 mt-1">{vkUser.phone}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-xs opacity-75">Роль</div>
                  <div className="font-semibold">Главный администратор</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Панель администратора</h1>
          <p className="text-sm sm:text-base text-muted-foreground">Управление настройками системы</p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onToggleHistory}
            className="w-full sm:w-auto"
          >
            <Icon name="History" size={18} className="mr-2" />
            <span className="sm:inline">История</span>
          </Button>
          <Button onClick={onSaveSettings} className="w-full sm:w-auto">
            <Icon name="Save" size={18} className="mr-2" />
            Сохранить все
          </Button>
        </div>
      </div>
    </>
  );
};

export default AdminPanelHeader;
