import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

interface AuthStat {
  source: string;
  total_logins: number;
  last_24h: number;
  last_7days: number;
  last_30days: number;
}

interface RecentLogin {
  id: number;
  email: string;
  display_name: string | null;
  source: string;
  last_login: string;
  created_at: string;
}

const AuthStats = () => {
  const [stats, setStats] = useState<AuthStat[]>([]);
  const [recentLogins, setRecentLogins] = useState<RecentLogin[]>([]);
  const [loading, setLoading] = useState(true);
  const [isExpanded, setIsExpanded] = useState(true);

  const providerInfo: Record<string, { name: string; icon: string; color: string }> = {
    telegram: { name: 'Telegram', icon: 'MessageCircle', color: 'bg-[#0088cc] text-white' },
    google: { name: 'Google', icon: 'Globe', color: 'bg-blue-500 text-white' },
    vk: { name: 'VK', icon: 'Users', color: 'bg-blue-600 text-white' },
    yandex: { name: 'Яндекс', icon: 'Shield', color: 'bg-red-500 text-white' },
    email: { name: 'Email', icon: 'Mail', color: 'bg-gray-600 text-white' },
  };

  const loadStats = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/2c981efa-3001-4ac8-b510-25b60979e8e2');
      const data = await response.json();
      
      if (data.stats) {
        setStats(data.stats);
      }
      
      if (data.recent_logins) {
        setRecentLogins(data.recent_logins);
      }
    } catch (error) {
      console.error('Error loading auth stats:', error);
      toast.error('Не удалось загрузить статистику авторизаций');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    // +4 часа к UTC
    const moscowDate = new Date(date.getTime() + (4 * 60 * 60 * 1000));
    
    const day = moscowDate.getDate().toString().padStart(2, '0');
    const month = (moscowDate.getMonth() + 1).toString().padStart(2, '0');
    const year = moscowDate.getFullYear();
    const hours = moscowDate.getHours().toString().padStart(2, '0');
    const minutes = moscowDate.getMinutes().toString().padStart(2, '0');
    
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  };

  const getProviderBadge = (source: string) => {
    const info = providerInfo[source] || { name: source, icon: 'User', color: 'bg-gray-500 text-white' };
    return (
      <Badge className={`${info.color} flex items-center gap-1 px-2 py-1`}>
        <Icon name={info.icon as any} size={14} />
        {info.name}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Общая статистика */}
      <Card>
        <CardHeader 
          className="cursor-pointer hover:bg-accent/50 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Icon name="BarChart3" className="text-primary" />
                Статистика авторизаций
              </CardTitle>
              <CardDescription>
                Общая статистика входов по провайдерам
              </CardDescription>
            </div>
            <Icon 
              name={isExpanded ? 'ChevronUp' : 'ChevronDown'} 
              className="text-muted-foreground" 
            />
          </div>
        </CardHeader>
        {isExpanded && (
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.map((stat) => {
                const info = providerInfo[stat.source] || { name: stat.source, icon: 'User', color: 'bg-gray-500' };
                return (
                  <Card key={stat.source} className="border-2">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-4 mb-4">
                        <div className={`p-3 rounded-full ${info.color}`}>
                          <Icon name={info.icon as any} size={24} className="text-white" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">{info.name}</h3>
                          <p className="text-sm text-muted-foreground">Провайдер входа</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">Всего входов:</span>
                          <span className="font-bold text-lg">{stat.total_logins}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">За 24 часа:</span>
                          <span className="font-semibold">{stat.last_24h}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">За 7 дней:</span>
                          <span className="font-semibold">{stat.last_7days}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">За 30 дней:</span>
                          <span className="font-semibold">{stat.last_30days}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </CardContent>
        )}
      </Card>

      {/* Последние авторизации */}
      {isExpanded && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="Clock" className="text-primary" />
              Последние авторизации
            </CardTitle>
            <CardDescription>
              История последних 100 входов (время указано +4 UTC)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Пользователь</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Провайдер</TableHead>
                    <TableHead>Последний вход</TableHead>
                    <TableHead>Дата регистрации</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentLogins.map((login) => (
                    <TableRow key={login.id}>
                      <TableCell className="font-medium">
                        {login.display_name || 'Без имени'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {login.email || 'Нет email'}
                      </TableCell>
                      <TableCell>
                        {getProviderBadge(login.source)}
                      </TableCell>
                      <TableCell className="text-sm">
                        {login.last_login ? formatDate(login.last_login) : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatDate(login.created_at)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AuthStats;
