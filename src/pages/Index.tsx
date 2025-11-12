import { useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import Dashboard from '@/components/Dashboard';
import ClientsPage from '@/components/ClientsPage';
import PhotobookPage from '@/components/PhotobookPage';
import AuthPage from '@/components/AuthPage';
import FeaturesPage from '@/components/FeaturesPage';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const Index = () => {
  const [currentPage, setCurrentPage] = useState<'auth' | 'dashboard' | 'clients' | 'photobook' | 'features'>('auth');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState<'user' | 'admin'>('user');

  const handleAuth = (role: 'user' | 'admin') => {
    setIsAuthenticated(true);
    setUserRole(role);
    setCurrentPage('dashboard');
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setCurrentPage('auth');
  };

  if (!isAuthenticated) {
    return <AuthPage onAuth={handleAuth} />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-purple-50/30 to-blue-50/30">
      <nav className="bg-white/80 backdrop-blur-md border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Icon name="Camera" className="text-primary" size={32} />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Foto-Mix
              </h1>
            </div>
            
            <div className="flex items-center space-x-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={currentPage === 'dashboard' ? 'default' : 'ghost'}
                    className="rounded-full"
                  >
                    <Icon name="Home" size={18} className="mr-2" />
                    Главная
                    <Icon name="ChevronDown" size={16} className="ml-2" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56">
                  <DropdownMenuItem onClick={() => setCurrentPage('dashboard')}>
                    <Icon name="LayoutDashboard" size={18} className="mr-2" />
                    Дашборд
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentPage('clients')}>
                    <Icon name="Users" size={18} className="mr-2" />
                    Клиенты
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentPage('photobook')}>
                    <Icon name="Book" size={18} className="mr-2" />
                    Фотокниги
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setCurrentPage('features')}>
                    <Icon name="Sparkles" size={18} className="mr-2" />
                    Возможности сервиса
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              {userRole === 'admin' && (
                <Button
                  variant="outline"
                  className="rounded-full border-2 border-primary"
                >
                  <Icon name="Settings" size={18} className="mr-2" />
                  Админка
                </Button>
              )}
              <Button
                variant="ghost"
                onClick={handleLogout}
                className="rounded-full"
              >
                <Icon name="LogOut" size={18} />
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto px-4 py-8">
        {currentPage === 'dashboard' && <Dashboard userRole={userRole} />}
        {currentPage === 'clients' && <ClientsPage />}
        {currentPage === 'photobook' && <PhotobookPage />}
        {currentPage === 'features' && <FeaturesPage />}
      </main>
    </div>
  );
};

export default Index;