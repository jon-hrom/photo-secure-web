import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import AdminGeneralSettings from '@/components/admin/AdminGeneralSettings';
import AdminAppearance from '@/components/admin/AdminAppearance';
import AdminWidgets from '@/components/admin/AdminWidgets';
import EnhancedAdminUsers from '@/components/admin/EnhancedAdminUsers';
import AdminAuthProviders from '@/components/admin/AdminAuthProviders';
import EmailNotifications from '@/components/admin/EmailNotifications';
import NotificationSoundSettings from '@/components/admin/NotificationSoundSettings';
import SmsBalanceManager from '@/components/admin/SmsBalanceManager';
import MaxTemplates from '@/components/admin/MaxTemplates';
import MaxSettings from '@/components/admin/MaxSettings';
import AdminClientsTab from '@/components/admin/AdminClientsTab';
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
    <Accordion type="multiple" className="space-y-4">
      <AccordionItem value="storage">
        <AccordionTrigger className="text-lg font-semibold text-gray-900 dark:text-gray-100">Хранилище и тарифы</AccordionTrigger>
        <AccordionContent>
          <div className="p-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-950/50 dark:to-purple-950/50 rounded-lg border-2 border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-blue-500 dark:bg-blue-600 rounded-lg">
                <Icon name="Database" className="h-8 w-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-2 text-gray-900 dark:text-gray-100">Управление хранилищем</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Управление тарифными планами, квотами пользователей, статистикой загрузок и финансовой аналитикой
                </p>
                <ul className="space-y-2 text-sm text-muted-foreground mb-4">
                  <li className="flex items-center gap-2">
                    <Icon name="Check" className="h-4 w-4 text-green-600" />
                    Создание и редактирование тарифов
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon name="Check" className="h-4 w-4 text-green-600" />
                    Назначение квот пользователям
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon name="Check" className="h-4 w-4 text-green-600" />
                    Статистика загрузок за 30 дней
                  </li>
                  <li className="flex items-center gap-2">
                    <Icon name="Check" className="h-4 w-4 text-green-600" />
                    Финансовая аналитика (доходы, расходы, прибыль)
                  </li>
                </ul>
                <Button 
                  onClick={() => navigate('/admin/storage')}
                  className="w-full sm:w-auto"
                  size="lg"
                >
                  <Icon name="ExternalLink" className="mr-2 h-5 w-5" />
                  Открыть панель управления хранилищем
                </Button>
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="max-templates">
        <AccordionTrigger className="text-lg font-semibold text-gray-900 dark:text-gray-100">Шаблоны MAX сообщений</AccordionTrigger>
        <AccordionContent>
          <MaxTemplates />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="sms">
        <AccordionTrigger className="text-lg font-semibold text-gray-900 dark:text-gray-100">SMS уведомления</AccordionTrigger>
        <AccordionContent>
          <SmsBalanceManager />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="emails">
        <AccordionTrigger className="text-lg font-semibold text-gray-900 dark:text-gray-100">Email уведомления</AccordionTrigger>
        <AccordionContent>
          <EmailNotifications />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="notification-sound">
        <AccordionTrigger className="text-lg font-semibold text-gray-900 dark:text-gray-100">Звук уведомлений</AccordionTrigger>
        <AccordionContent>
          <NotificationSoundSettings />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="general">
        <AccordionTrigger className="text-lg font-semibold text-gray-900 dark:text-gray-100">Основные настройки</AccordionTrigger>
        <AccordionContent>
          <AdminGeneralSettings
            settings={settings}
            onToggle={onToggle}
            onInputChange={onInputChange}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="auth">
        <AccordionTrigger className="text-lg font-semibold text-gray-900 dark:text-gray-100">Авторизация</AccordionTrigger>
        <AccordionContent>
          <AdminAuthProviders
            authProviders={authProviders}
            onToggleProvider={onToggleAuthProvider}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="appearance">
        <AccordionTrigger className="text-lg font-semibold text-gray-900 dark:text-gray-100">Внешний вид</AccordionTrigger>
        <AccordionContent>
          <AdminAppearance
            colors={colors}
            onColorChange={onColorChange}
            onSave={onSaveColors}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="widgets">
        <AccordionTrigger className="text-lg font-semibold text-gray-900 dark:text-gray-100">Виджеты</AccordionTrigger>
        <AccordionContent>
          <AdminWidgets
            widgets={widgets}
            onToggle={onToggleWidget}
            onMove={onMoveWidget}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="users">
        <AccordionTrigger className="text-lg font-semibold text-gray-900 dark:text-gray-100">Пользователи</AccordionTrigger>
        <AccordionContent>
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

      <AccordionItem value="all-clients">
        <AccordionTrigger className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          <div className="flex items-center gap-2">
            <Icon name="Users" size={20} />
            Управление клиентами
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <AdminClientsTab />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="max-settings">
        <AccordionTrigger className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          <div className="flex items-center gap-2">
            <Icon name="Settings" size={20} />
            Настройки MAX (Единая система)
          </div>
        </AccordionTrigger>
        <AccordionContent>
          <MaxSettings />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default AdminPanelTabs;