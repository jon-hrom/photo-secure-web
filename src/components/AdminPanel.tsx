import Icon from '@/components/ui/icon';
import AdminPanelHeader from '@/components/admin/AdminPanelHeader';
import AdminPanelHistory from '@/components/admin/AdminPanelHistory';
import AdminPanelTabs from '@/components/admin/AdminPanelTabs';
import UserImpersonation from '@/components/admin/UserImpersonation';
import UserViewWrapper from '@/components/admin/UserViewWrapper';
import { useAdminPanelSettings } from '@/components/admin/AdminPanelSettings';
import { useAdminPanelUsers } from '@/components/admin/AdminPanelUsers';
import { useAdminPanelRoleManager } from '@/components/admin/AdminPanelRoleManager';
import { useAdminPanelHistory } from '@/components/admin/AdminPanelHistoryManager';

const AdminPanel = () => {
  const {
    settings,
    authProviders,
    colors,
    widgets,
    loading,
    loadSettings,
    saveSettings,
    handleToggle,
    handleInputChange,
    handleColorChange,
    handleToggleAuthProvider,
    handleSaveColors,
    moveWidget,
    toggleWidget,
  } = useAdminPanelSettings();

  const {
    users,
    loadUsers,
    deleteUser,
    blockUser,
    unblockUser,
  } = useAdminPanelUsers();

  const {
    currentRole,
    viewedUser,
    handleRoleChange,
    handleEnterUserView,
    handleExitUserView,
  } = useAdminPanelRoleManager();

  const {
    history,
    showHistory,
    setShowHistory,
    loadHistory,
    rollbackToVersion,
  } = useAdminPanelHistory();

  const handleRollback = async (historyId: number) => {
    const success = await rollbackToVersion(historyId);
    if (success) {
      await loadSettings();
      await loadHistory();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const vkUserData = localStorage.getItem('vk_user');
  const vkUser = vkUserData ? JSON.parse(vkUserData) : null;
  
  const savedSession = localStorage.getItem('authSession');
  const emailUser = savedSession ? JSON.parse(savedSession) : null;

  return (
    <div className="space-y-6">
      <AdminPanelHeader
        vkUser={vkUser}
        emailUser={emailUser}
        showHistory={showHistory}
        onToggleHistory={() => setShowHistory(!showHistory)}
        onSaveSettings={saveSettings}
        currentRole={currentRole}
        onRoleChange={handleRoleChange}
      />

      {currentRole === 'admin' && (
        <>
          <UserImpersonation
            users={users}
            onEnterUserView={handleEnterUserView}
            onExitUserView={handleExitUserView}
            isInUserView={false}
          />

          <AdminPanelHistory
            history={history}
            showHistory={showHistory}
            onRollback={handleRollback}
          />

          <AdminPanelTabs
            settings={settings}
            authProviders={authProviders}
            colors={colors}
            widgets={widgets}
            users={users}
            onToggle={handleToggle}
            onInputChange={handleInputChange}
            onToggleAuthProvider={handleToggleAuthProvider}
            onColorChange={handleColorChange}
            onSaveColors={handleSaveColors}
            onToggleWidget={toggleWidget}
            onMoveWidget={moveWidget}
            onDeleteUser={deleteUser}
            onBlockUser={blockUser}
            onUnblockUser={unblockUser}
            onRefreshUsers={loadUsers}
          />
        </>
      )}

      {currentRole === 'client' && (
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl border-2 border-primary/20 p-8 text-center">
          <div className="max-w-2xl mx-auto space-y-4">
            <div className="w-20 h-20 mx-auto bg-primary/10 rounded-full flex items-center justify-center mb-4">
              <Icon name="User" size={40} className="text-primary" />
            </div>
            <h3 className="text-2xl font-bold text-primary">Режим просмотра клиента</h3>
            <p className="text-muted-foreground text-lg">
              Вы видите интерфейс так, как его видит обычный клиент. Это позволяет тестировать и редактировать настройки с точки зрения пользователя.
            </p>
            <p className="text-sm text-muted-foreground">
              Переключитесь обратно на роль "Главный администратор" через выпадающий список выше, чтобы получить доступ к настройкам.
            </p>
          </div>
        </div>
      )}

      {currentRole === 'user_view' && viewedUser && (
        <>
          <UserViewWrapper
            viewedUser={viewedUser}
            onExit={handleExitUserView}
          />
        </>
      )}
    </div>
  );
};

export default AdminPanel;
