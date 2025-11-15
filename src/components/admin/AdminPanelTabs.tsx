import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import AdminGeneralSettings from '@/components/admin/AdminGeneralSettings';
import AdminAppearance from '@/components/admin/AdminAppearance';
import AdminWidgets from '@/components/admin/AdminWidgets';
import EnhancedAdminUsers from '@/components/admin/EnhancedAdminUsers';
import AdminAuthProviders from '@/components/admin/AdminAuthProviders';

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
}: AdminPanelTabsProps) => {
  return (
    <Accordion type="multiple" className="space-y-4">
      <AccordionItem value="general">
        <AccordionTrigger className="text-lg font-semibold">Основные настройки</AccordionTrigger>
        <AccordionContent>
          <AdminGeneralSettings
            settings={settings}
            onToggle={onToggle}
            onInputChange={onInputChange}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="auth">
        <AccordionTrigger className="text-lg font-semibold">Авторизация</AccordionTrigger>
        <AccordionContent>
          <AdminAuthProviders
            authProviders={authProviders}
            onToggleProvider={onToggleAuthProvider}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="appearance">
        <AccordionTrigger className="text-lg font-semibold">Внешний вид</AccordionTrigger>
        <AccordionContent>
          <AdminAppearance
            colors={colors}
            onColorChange={onColorChange}
            onSave={onSaveColors}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="widgets">
        <AccordionTrigger className="text-lg font-semibold">Виджеты</AccordionTrigger>
        <AccordionContent>
          <AdminWidgets
            widgets={widgets}
            onToggle={onToggleWidget}
            onMove={onMoveWidget}
          />
        </AccordionContent>
      </AccordionItem>

      <AccordionItem value="users">
        <AccordionTrigger className="text-lg font-semibold">Пользователи</AccordionTrigger>
        <AccordionContent>
          <EnhancedAdminUsers 
            users={users} 
            onDelete={onDeleteUser}
            onBlock={onBlockUser}
            onUnblock={onUnblockUser}
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
};

export default AdminPanelTabs;