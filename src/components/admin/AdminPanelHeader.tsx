import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useNavigate } from 'react-router-dom';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { isAdminUser } from '@/utils/adminCheck';

interface AdminPanelHeaderProps {
  vkUser: any;
  emailUser?: { email: string; isAdmin: boolean };
  showHistory: boolean;
  onToggleHistory: () => void;
  onSaveSettings: () => void;
  currentRole: 'admin' | 'client' | 'user_view';
  onRoleChange: (role: 'admin' | 'client' | 'user_view') => void;
  onNotifyUsers?: () => void;
}

const AdminPanelHeader = ({ vkUser, emailUser, showHistory, onToggleHistory, onSaveSettings, currentRole, onRoleChange, onNotifyUsers }: AdminPanelHeaderProps) => {
  const navigate = useNavigate();
  
  const handleLogout = () => {
    localStorage.removeItem('vk_user_id');
    localStorage.removeItem('vk_access_token');
    navigate('/');
  };
  
  return (
    <div className="space-y-6">
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
                  <h3 className="text-xl font-bold">{vkUser.name}</h3>
                  {vkUser.is_verified && (
                    <Icon name="BadgeCheck" size={20} className="text-white" />
                  )}
                  {isAdminUser(vkUser.email || null, vkUser) && (
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
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="text-xs opacity-75">Роль:</div>
                  <Select value={currentRole} onValueChange={(value) => onRoleChange(value as 'admin' | 'client' | 'user_view')}>
                    <SelectTrigger className="w-[200px] bg-white/20 border-white/30 text-white hover:bg-white/30 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Icon name="ShieldCheck" size={16} />
                          Главный администратор
                        </div>
                      </SelectItem>
                      <SelectItem value="client">
                        <div className="flex items-center gap-2">
                          <Icon name="User" size={16} />
                          Клиент
                        </div>
                      </SelectItem>
                      <SelectItem value="user_view">
                        <div className="flex items-center gap-2">
                          <Icon name="Eye" size={16} />
                          Просмотр пользователя
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={onToggleHistory}
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 border-white/30"
                  >
                    <Icon name="History" size={16} className="mr-2" />
                    История
                  </Button>
                  {onNotifyUsers && (
                    <Button
                      onClick={onNotifyUsers}
                      variant="secondary"
                      size="sm"
                      className="bg-amber-500/80 hover:bg-amber-500 border-white/30"
                      title="Уведомить всех пользователей о необходимости обновить страницу"
                    >
                      <Icon name="Bell" size={16} className="mr-2" />
                      Уведомить
                    </Button>
                  )}
                  <Button
                    onClick={onSaveSettings}
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 border-white/30"
                  >
                    <Icon name="Save" size={16} className="mr-2" />
                    Сохранить
                  </Button>
                  <Button
                    onClick={handleLogout}
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 border-white/30"
                  >
                    <Icon name="LogOut" size={16} className="mr-2" />
                    Выход
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!vkUser && emailUser && (
        <Card className="bg-gradient-to-br from-green-500 to-blue-600 text-white border-0 shadow-xl">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full border-4 border-white shadow-lg bg-white/20 flex items-center justify-center">
                <Icon name="Mail" size={32} className="text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-xl font-bold">
                    {isAdminUser(emailUser.email, null) ? 'Главный администратор' : emailUser.email}
                  </h3>
                  {isAdminUser(emailUser.email, null) && (
                    <span className="px-3 py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold border border-white/30">
                      Администратор
                    </span>
                  )}
                </div>
                <p className="text-sm opacity-90">{emailUser.email}</p>
              </div>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <div className="text-xs opacity-75">Роль:</div>
                  <Select value={currentRole} onValueChange={(value) => onRoleChange(value as 'admin' | 'client' | 'user_view')}>
                    <SelectTrigger className="w-[200px] bg-white/20 border-white/30 text-white hover:bg-white/30 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">
                        <div className="flex items-center gap-2">
                          <Icon name="ShieldCheck" size={16} />
                          Главный администратор
                        </div>
                      </SelectItem>
                      <SelectItem value="client">
                        <div className="flex items-center gap-2">
                          <Icon name="User" size={16} />
                          Клиент
                        </div>
                      </SelectItem>
                      <SelectItem value="user_view">
                        <div className="flex items-center gap-2">
                          <Icon name="Eye" size={16} />
                          Просмотр пользователя
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={onToggleHistory}
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 border-white/30"
                  >
                    <Icon name="History" size={16} className="mr-2" />
                    История
                  </Button>
                  {onNotifyUsers && (
                    <Button
                      onClick={onNotifyUsers}
                      variant="secondary"
                      size="sm"
                      className="bg-amber-500/80 hover:bg-amber-500 border-white/30"
                      title="Уведомить всех пользователей о необходимости обновить страницу"
                    >
                      <Icon name="Bell" size={16} className="mr-2" />
                      Уведомить
                    </Button>
                  )}
                  <Button
                    onClick={onSaveSettings}
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 border-white/30"
                  >
                    <Icon name="Save" size={16} className="mr-2" />
                    Сохранить
                  </Button>
                  <Button
                    onClick={handleLogout}
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 border-white/30"
                  >
                    <Icon name="LogOut" size={16} className="mr-2" />
                    Выход
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminPanelHeader;