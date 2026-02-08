import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import AdminGeneralSettings from '@/components/admin/AdminGeneralSettings';
import AdminAppearance from '@/components/admin/AdminAppearance';
import AdminWidgets from '@/components/admin/AdminWidgets';
import EnhancedAdminUsers from '@/components/admin/EnhancedAdminUsers';
import AdminAuthProviders from '@/components/admin/AdminAuthProviders';
import AuthStats from '@/components/admin/AuthStats';
import TelegramVerificationAdmin from '@/components/admin/TelegramVerificationAdmin';
import EmailNotifications from '@/components/admin/EmailNotifications';
import NotificationSoundSettings from '@/components/admin/NotificationSoundSettings';
import SmsBalanceManager from '@/components/admin/SmsBalanceManager';
import MaxTemplates from '@/components/admin/MaxTemplates';
import MaxSettings from '@/components/admin/MaxSettings';
import AdminClientsTab from '@/components/admin/AdminClientsTab';
import BirthdayNotificationsCard from '@/components/settings/BirthdayNotificationsCard';
import VKSettings from '@/components/settings/VKSettings';
import NotificationMonitor from '@/components/admin/NotificationMonitor';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { useNavigate } from 'react-router-dom';

interface AdminPanelTabsProps {
  settings: any;
  authProviders: any;
  colors: any;
  widgets: any[];
  users: any[];
  onToggle: (key: string) => void;
  onInputChange: (key: string, value: string) => void;
  onToggleAuthProvider: (provider: string) => void;
  onColorChange: (key: string, value: string) => void;
  onSaveColors: () => void;
  onToggleWidget: (id: number) => void;
  onMoveWidget: (id: number, direction: 'up' | 'down') => void;
  onDeleteUser: (userId: string | number) => void;
  onBlockUser: (userId: string | number, reason: string) => void;
  onUnblockUser: (userId: string | number) => void;
  onRefreshUsers?: () => void;
  onOpenPhotoBank?: (userId: string | number) => void;
}

const AdminPanelTabs = ({
  settings,
  authProviders,
  colors,
  widgets,
  users,
  onToggle,
  onInputChange,
  onToggleAuthProvider,
  onColorChange,
  onSaveColors,
  onToggleWidget,
  onMoveWidget,
  onDeleteUser,
  onBlockUser,
  onUnblockUser,
  onRefreshUsers,
  onOpenPhotoBank,
}: AdminPanelTabsProps) => {
  const navigate = useNavigate();

  return (
    <Accordion type="multiple" className="space-y-3 will-change-transform">
      <AccordionItem value="storage" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-0">
        <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
          <div className="flex items-center gap-3">
            <Icon name="Database" size={20} className="text-primary" />
            <span className="text-lg font-semibold">Хранилище и тарифы</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 sm:px-6 pb-4">
          <div className="p-3 sm:p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/50 dark:to-purple-950/50 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3 sm:gap-4">
              <div className="p-2 sm:p-3 bg-blue-500 dark:bg-blue-600 rounded-lg shrink-0">
                <Icon name="Database" className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-base sm:text-xl font-bold mb-2 text-gray-900 dark:text-gray-100 break-words">Управление хранилищем</h3>
                <p className="text-xs sm:text-sm text-muted-foreground mb-4">
                  Управление тарифными планами, квотами пользователей, статистикой загрузок и финансовой аналитикой
                </p>
                <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground mb-4">
                  <li className="flex items-start gap-2">
                    <Icon name="Check" className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                    <span>Создание и редактирование тарифов</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon name="Check" className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                    <span>Назначение квот пользователям</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon name="Check" className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                    <span>Статистика загрузок за 30 дней</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Icon name="Check" className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />
                    <span>Финансовая аналитика (доходы, расходы, прибыль)</span>
                  </li>
                </ul>
                <Button 
                  onClick={() => navigate('/admin/storage')}
                  className="w-full text-xs sm:text-sm"
                  size="default"
                >
                  <Icon name="ExternalLink" className="mr-2 h-4 w-4 shrink-0" />
                  <span className="text-center leading-tight">Открыть панель управления</span>
                </Button>
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="max-templates" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-0">
        <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
          <div className="flex items-center gap-3">
            <Icon name="MessageSquare" size={20} className="text-primary" />
            <span className="text-lg font-semibold">Шаблоны MAX сообщений</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 sm:px-6 pb-4">
          <MaxTemplates />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="sms" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-0">
        <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
          <div className="flex items-center gap-3">
            <Icon name="Smartphone" size={20} className="text-primary" />
            <span className="text-lg font-semibold">SMS уведомления</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 sm:px-6 pb-4">
          <SmsBalanceManager />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="emails" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-0">
        <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
          <div className="flex items-center gap-3">
            <Icon name="Mail" size={20} className="text-primary" />
            <span className="text-lg font-semibold">Email уведомления</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 sm:px-6 pb-4">
          <EmailNotifications />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="notification-sound" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-0">
        <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
          <div className="flex items-center gap-3">
            <Icon name="Volume2" size={20} className="text-primary" />
            <span className="text-lg font-semibold">Звук уведомлений</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 sm:px-6 pb-4">
          <NotificationSoundSettings />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="notification-monitor" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-0">
        <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
          <div className="flex items-center gap-3">
            <Icon name="Activity" size={20} className="text-primary" />
            <span className="text-lg font-semibold">Мониторинг уведомлений</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 sm:px-6 pb-4">
          <NotificationMonitor />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="general" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-0">
        <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
          <div className="flex items-center gap-3">
            <Icon name="Settings" size={20} className="text-primary" />
            <span className="text-lg font-semibold">Основные настройки</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 sm:px-6 pb-4">
          <AdminGeneralSettings
            settings={settings}
            onToggle={onToggle}
            onInputChange={onInputChange}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="auth" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-0">
        <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
          <div className="flex items-center gap-3">
            <Icon name="Key" size={20} className="text-primary" />
            <span className="text-lg font-semibold">Авторизация</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 sm:px-6 pb-4 space-y-6">
          <div className="space-y-6">
            <AdminAuthProviders
              authProviders={authProviders}
              onToggleProvider={onToggleAuthProvider}
            />
            <AuthStats />
            <TelegramVerificationAdmin />
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="appearance" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-0">
        <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
          <div className="flex items-center gap-3">
            <Icon name="Palette" size={20} className="text-primary" />
            <span className="text-lg font-semibold">Внешний вид</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 sm:px-6 pb-4">
          <AdminAppearance
            colors={colors}
            onColorChange={onColorChange}
            onSave={onSaveColors}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="widgets" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-0">
        <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
          <div className="flex items-center gap-3">
            <Icon name="Layout" size={20} className="text-primary" />
            <span className="text-lg font-semibold">Виджеты</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 sm:px-6 pb-4">
          <AdminWidgets
            widgets={widgets}
            onToggle={onToggleWidget}
            onMove={onMoveWidget}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="users" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-0">
        <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
          <div className="flex items-center gap-3">
            <Icon name="Users" size={20} className="text-primary" />
            <span className="text-lg font-semibold">Пользователи</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 sm:px-6 pb-4">
          <EnhancedAdminUsers 
            users={users} 
            onDelete={onDeleteUser}
            onBlock={onBlockUser}
            onUnblock={onUnblockUser}
            onRefresh={onRefreshUsers}
            onOpenPhotoBank={onOpenPhotoBank}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="all-clients" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-0">
        <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
          <div className="flex items-center gap-3">
            <Icon name="UserCheck" size={20} className="text-primary" />
            <span className="text-lg font-semibold">Управление клиентами</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 sm:px-6 pb-4">
          <AdminClientsTab />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="max-settings" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-0">
        <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
          <div className="flex items-center gap-3">
            <Icon name="Zap" size={20} className="text-primary" />
            <span className="text-lg font-semibold">Настройки MAX</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 sm:px-6 pb-4">
          <MaxSettings />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="birthday-notifications" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-0">
        <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
          <div className="flex items-center gap-3">
            <Icon name="Cake" size={20} className="text-primary" />
            <span className="text-lg font-semibold">Поздравления с Днём Рождения</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 sm:px-6 pb-4">
          <BirthdayNotificationsCard userId={null} />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="vk-settings" className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-0">
        <AccordionTrigger className="px-4 sm:px-6 py-4 hover:no-underline">
          <div className="flex items-center gap-3">
            <Icon name="MessageCircle" size={20} className="text-primary" />
            <span className="text-lg font-semibold">Подключение ВКонтакте</span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="px-4 sm:px-6 pb-4">
          <VKSettings userId={null} />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default AdminPanelTabs;