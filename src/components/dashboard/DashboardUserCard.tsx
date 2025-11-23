import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { isAdminUser } from '@/utils/adminCheck';

interface DashboardUserCardProps {
  vkUser: any;
  emailUser: any;
  finalIsAdmin: boolean;
  onOpenAdminPanel?: () => void;
  onLogout?: () => void;
}

const DashboardUserCard = ({ vkUser, emailUser, finalIsAdmin, onOpenAdminPanel, onLogout }: DashboardUserCardProps) => {
  const [showLogoutDialog, setShowLogoutDialog] = useState(false);
  
  // Show card for either VK or email users
  if (!vkUser && !emailUser) return null;
  
  // Determine which user data to show
  const displayUser = vkUser || emailUser;
  const displayName = displayUser?.name || displayUser?.userEmail || displayUser?.email || 'Пользователь';
  const displayEmail = displayUser?.email || displayUser?.userEmail || 'Вход через почту';
  const displayPhone = displayUser?.phone || null;
  const displayAvatar = displayUser?.avatar || null;
  const displayVerified = displayUser?.is_verified || displayUser?.verified || false;

  return (
    <>
      <Card className="bg-gradient-to-br from-blue-500 to-purple-600 text-white border-0 shadow-xl">
        <CardContent className="p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
            {displayAvatar && (
              <div className="relative flex-shrink-0">
                <img 
                  src={displayAvatar} 
                  alt={displayName}
                  className="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-4 border-white shadow-lg object-cover"
                />
                {displayVerified && (
                  <div className="absolute -bottom-1 -right-1 bg-white rounded-full p-1">
                    <Icon name="BadgeCheck" size={14} className="text-blue-500" />
                  </div>
                )}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                <h3 className="text-lg sm:text-xl font-bold truncate">{displayName}</h3>
                {displayVerified && (
                  <Icon name="BadgeCheck" size={18} className="text-white hidden sm:block" />
                )}
                {finalIsAdmin && (
                  <span className="px-2 py-0.5 sm:px-3 sm:py-1 bg-white/20 backdrop-blur-sm rounded-full text-xs font-semibold border border-white/30 w-fit">
                    Администратор
                  </span>
                )}
              </div>
              <p className="text-xs sm:text-sm opacity-90 truncate">{displayEmail}</p>
              {displayPhone && (
                <p className="text-xs opacity-75 mt-1 truncate">{displayPhone}</p>
              )}
            </div>
            <div className="flex flex-row sm:flex-col items-center gap-2 w-full sm:w-auto sm:items-end">
              {finalIsAdmin && onOpenAdminPanel && (
                <button
                  onClick={onOpenAdminPanel}
                  className="px-2.5 py-1.5 sm:px-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm rounded-full transition-colors border border-white/30 flex items-center gap-1.5 flex-1 sm:flex-initial justify-center"
                  title="Админ-панель"
                >
                  <Icon name="ShieldCheck" size={14} className="text-white" />
                  <span className="text-xs font-semibold">Админка</span>
                </button>
              )}
              {onLogout && (
                <button
                  onClick={() => setShowLogoutDialog(true)}
                  className="p-1.5 sm:p-2 hover:bg-white/20 rounded-full transition-colors"
                  title="Выйти"
                >
                  <Icon name="LogOut" size={18} className="text-white" />
                </button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <AlertDialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Icon name="LogOut" className="text-orange-500" size={24} />
              Выход из аккаунта
            </AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите выйти? Вам потребуется снова войти в систему для доступа к своему аккаунту.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowLogoutDialog(false);
                onLogout?.();
              }}
              className="bg-primary hover:bg-primary/90"
            >
              <Icon name="LogOut" size={16} className="mr-2" />
              Выйти
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default DashboardUserCard;