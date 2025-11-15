import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AdminGeneralSettings from '@/components/admin/AdminGeneralSettings';
import AdminAppearance from '@/components/admin/AdminAppearance';
import AdminWidgets from '@/components/admin/AdminWidgets';
import AdminUsers from '@/components/admin/AdminUsers';
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
  onDeleteUser: (userId: number) => void;
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
}: AdminPanelTabsProps) => {
  return (
    <Tabs defaultValue="general" className="space-y-6">
      <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5 gap-2">
        <TabsTrigger value="general" className="text-xs sm:text-sm">Основные</TabsTrigger>
        <TabsTrigger value="auth" className="text-xs sm:text-sm">Авторизация</TabsTrigger>
        <TabsTrigger value="appearance" className="text-xs sm:text-sm">Внешний вид</TabsTrigger>
        <TabsTrigger value="widgets" className="text-xs sm:text-sm">Виджеты</TabsTrigger>
        <TabsTrigger value="users" className="text-xs sm:text-sm">Пользователи</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <AdminGeneralSettings
          settings={settings}
          onToggle={onToggle}
          onInputChange={onInputChange}
        />
      </TabsContent>

      <TabsContent value="auth">
        <AdminAuthProviders
          authProviders={authProviders}
          onToggleProvider={onToggleAuthProvider}
        />
      </TabsContent>

      <TabsContent value="appearance">
        <AdminAppearance
          colors={colors}
          onColorChange={onColorChange}
          onSave={onSaveColors}
        />
      </TabsContent>

      <TabsContent value="widgets">
        <AdminWidgets
          widgets={widgets}
          onToggle={onToggleWidget}
          onMove={onMoveWidget}
        />
      </TabsContent>

      <TabsContent value="users">
        <AdminUsers users={users} onDelete={onDeleteUser} />
      </TabsContent>
    </Tabs>
  );
};

export default AdminPanelTabs;