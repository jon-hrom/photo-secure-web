import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { LineChart, Line, PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface DownloadLog {
  id: number;
  folder_id: number | null;
  photo_id: number | null;
  download_type: 'archive' | 'photo';
  client_ip: string;
  user_agent: string;
  downloaded_at: string;
  folder_name?: string;
  photo_name?: string;
}

interface FavoriteStats {
  client_id: number;
  client_name: string;
  favorite_date: string;
  photo_count: number;
  folder_id: number;
  folder_name: string;
}

interface Folder {
  id: number;
  folder_name: string;
  created_at: string;
}

interface DownloadStatsProps {
  userId: number;
}

const DownloadStats = ({ userId }: DownloadStatsProps) => {
  const [logs, setLogs] = useState<DownloadLog[]>([]);
  const [favorites, setFavorites] = useState<FavoriteStats[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<'line' | 'pie' | 'bar'>('line');
  const [dateFilter, setDateFilter] = useState<'7d' | '30d' | 'all'>('30d');
  const [selectedFolder, setSelectedFolder] = useState<string>('all');

  useEffect(() => {
    fetchDownloadLogs();
    fetchFolders();
  }, [userId]);

  const fetchFolders = async () => {
    try {
      const response = await fetch('https://functions.poehali.dev/ccf8ab13-a058-4ead-b6c5-6511331471bc?action=list', {
        headers: { 'X-User-Id': userId.toString() }
      });
      if (response.ok) {
        const data = await response.json();
        console.log('📂 Folders loaded:', data);
        const allFolders = data.folders || [];
        console.log('📂 All folders:', allFolders);
        const filteredFolders = allFolders
          .filter((folder: any) => !folder.folder_name?.includes('Технический брак'))
          .map((folder: any) => ({
            id: folder.id,
            folder_name: folder.folder_name,
            created_at: folder.created_at
          }));
        console.log('📂 Filtered folders:', filteredFolders);
        setFolders(filteredFolders);
      }
    } catch (error) {
      console.error('Failed to fetch folders:', error);
    }
  };

  const fetchDownloadLogs = async () => {
    setLoading(true);
    try {
      const response = await fetch('https://functions.poehali.dev/8f039074-fe37-4670-8ebf-945af5ffc925', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });

      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
        setFavorites(data.favorites || []);
      }
    } catch (error) {
      console.error('Failed to fetch download logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredLogs = () => {
    let filtered = logs;
    
    if (selectedFolder !== 'all') {
      const folderId = parseInt(selectedFolder);
      filtered = filtered.filter(log => log.folder_id === folderId);
    }
    
    if (dateFilter === 'all') return filtered;
    
    const now = new Date();
    const daysAgo = dateFilter === '7d' ? 7 : 30;
    const filterDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    return filtered.filter(log => new Date(log.downloaded_at) >= filterDate);
  };

  const filteredLogs = getFilteredLogs();

  const getFilteredFavorites = () => {
    let filtered = favorites;
    
    // Фильтр по папке
    if (selectedFolder !== 'all') {
      const folderId = parseInt(selectedFolder);
      filtered = filtered.filter(fav => fav.folder_id === folderId);
    }
    
    // Фильтр по дате
    if (dateFilter === 'all') return filtered;
    
    const now = new Date();
    const daysAgo = dateFilter === '7d' ? 7 : 30;
    const filterDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    return filtered.filter(fav => new Date(fav.favorite_date) >= filterDate);
  };

  const filteredFavorites = getFilteredFavorites();

  const getTimelineData = () => {
    const grouped = filteredLogs.reduce((acc, log) => {
      const date = new Date(log.downloaded_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      if (!acc[date]) acc[date] = { date, archives: 0, photos: 0, favorites: 0 };
      if (log.download_type === 'archive') acc[date].archives++;
      else acc[date].photos++;
      return acc;
    }, {} as Record<string, { date: string; archives: number; photos: number; favorites: number }>);

    // Добавляем избранное
    filteredFavorites.forEach(fav => {
      const date = new Date(fav.favorite_date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      if (!grouped[date]) grouped[date] = { date, archives: 0, photos: 0, favorites: 0 };
      grouped[date].favorites += fav.photo_count;
    });

    return Object.values(grouped).sort((a, b) => {
      const [dayA, monthA] = a.date.split('.').map(Number);
      const [dayB, monthB] = b.date.split('.').map(Number);
      return monthA !== monthB ? monthA - monthB : dayA - dayB;
    });
  };

  const getPieData = () => {
    const archives = filteredLogs.filter(l => l.download_type === 'archive').length;
    const photos = filteredLogs.filter(l => l.download_type === 'photo').length;
    const favoritesCount = filteredFavorites.reduce((sum, fav) => sum + fav.photo_count, 0);
    return [
      { name: 'Архивы', value: archives, color: '#3b82f6' },
      { name: 'Фото', value: photos, color: '#10b981' },
      { name: 'Избранное', value: favoritesCount, color: '#f59e0b' }
    ];
  };

  const getTopDownloads = () => {
    const folderCounts = filteredLogs
      .filter(l => l.download_type === 'archive' && l.folder_name)
      .reduce((acc, log) => {
        const key = log.folder_name!;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(folderCounts)
      .map(([name, count]) => ({ name: name.length > 20 ? name.slice(0, 20) + '...' : name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  };

  const formatDateTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatIP = (ipData: string) => {
    if (!ipData) return '—';
    
    try {
      // Пробуем распарсить JSON с геолокацией
      const geo = JSON.parse(ipData);
      if (geo.country) {
        const parts = [];
        if (geo.emoji) parts.push(geo.emoji);
        if (geo.city) parts.push(geo.city);
        if (geo.country) parts.push(geo.country);
        return parts.join(' ');
      }
    } catch {
      // Если не JSON - просто IP
    }
    
    return ipData;
  };

  const totalArchives = filteredLogs.filter(l => l.download_type === 'archive').length;
  const totalPhotos = filteredLogs.filter(l => l.download_type === 'photo').length;
  const totalFavorites = filteredFavorites.reduce((sum, fav) => sum + fav.photo_count, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Icon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <p className="text-muted-foreground">Детальная информация о загрузках клиентами</p>
        <Button onClick={fetchDownloadLogs} variant="outline" size="sm">
          <Icon name="RefreshCw" size={16} className="mr-2" />
          Обновить
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="p-3 sm:p-4 rounded-lg border bg-card">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-muted-foreground mb-1">
            <Icon name="Archive" size={18} />
            <span className="text-xs sm:text-sm whitespace-nowrap">Архивы</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-blue-500">{totalArchives}</div>
        </div>
        <div className="p-3 sm:p-4 rounded-lg border bg-card">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-muted-foreground mb-1">
            <Icon name="Image" size={18} />
            <span className="text-xs sm:text-sm whitespace-nowrap">Фото</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-emerald-500">{totalPhotos}</div>
        </div>
        <div className="p-3 sm:p-4 rounded-lg border bg-card">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-muted-foreground mb-1">
            <Icon name="Heart" size={18} />
            <span className="text-xs sm:text-sm whitespace-nowrap">Избранное</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold text-amber-500">{totalFavorites}</div>
        </div>
        <div className="p-3 sm:p-4 rounded-lg border bg-card">
          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 text-muted-foreground mb-1">
            <Icon name="Download" size={18} />
            <span className="text-xs sm:text-sm whitespace-nowrap">Всего</span>
          </div>
          <div className="text-2xl sm:text-3xl font-bold">{totalArchives + totalPhotos}</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 border-b pb-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={dateFilter === '7d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateFilter('7d')}
          >
            7 дней
          </Button>
          <Button
            variant={dateFilter === '30d' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateFilter('30d')}
          >
            30 дней
          </Button>
          <Button
            variant={dateFilter === 'all' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setDateFilter('all')}
          >
            Всё время
          </Button>
        </div>
        
        <div className="flex items-center gap-2">
          <Icon name="Folder" size={16} className="text-muted-foreground" />
          <Select value={selectedFolder} onValueChange={setSelectedFolder}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="Все папки" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все папки</SelectItem>
              {folders.map(folder => (
                <SelectItem key={folder.id} value={folder.id.toString()}>
                  {folder.folder_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-2 ml-auto">
          <Button
            variant={chartType === 'line' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartType('line')}
          >
            <Icon name="TrendingUp" size={16} />
          </Button>
          <Button
            variant={chartType === 'pie' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartType('pie')}
          >
            <Icon name="PieChart" size={16} />
          </Button>
          <Button
            variant={chartType === 'bar' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setChartType('bar')}
          >
            <Icon name="BarChart3" size={16} />
          </Button>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-6">
        <h3 className="text-lg font-semibold mb-4">График скачиваний</h3>
        {filteredLogs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-muted-foreground">
            <Icon name="LineChart" size={48} className="mb-2 opacity-50" />
            <p>Нет данных за выбранный период</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            {chartType === 'line' && (
              <LineChart data={getTimelineData()}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Legend />
                <Line type="monotone" dataKey="archives" stroke="#3b82f6" strokeWidth={2} name="Архивы" />
                <Line type="monotone" dataKey="photos" stroke="#10b981" strokeWidth={2} name="Фото" />
                <Line type="monotone" dataKey="favorites" stroke="#f59e0b" strokeWidth={2} name="Избранное" />
              </LineChart>
            )}
            {chartType === 'pie' && (
              <PieChart>
                <Pie
                  data={getPieData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getPieData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            )}
            {chartType === 'bar' && (
              <BarChart data={getTopDownloads()}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" />
                <YAxis stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px'
                  }}
                />
                <Bar dataKey="count" fill="#3b82f6" name="Скачиваний" />
              </BarChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      <div className="rounded-lg border bg-card">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">История скачиваний</h3>
          <p className="text-sm text-muted-foreground">Последние {filteredLogs.length} загрузок</p>
        </div>
        <div className="overflow-x-auto">
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
              <Icon name="Download" size={32} className="mb-2 opacity-50" />
              <p>Пока нет скачиваний</p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left p-3 font-medium text-sm">Дата и время</th>
                  <th className="text-left p-3 font-medium text-sm">Тип</th>
                  <th className="text-left p-3 font-medium text-sm">Название</th>
                  <th className="text-left p-3 font-medium text-sm">IP адрес</th>
                  <th className="text-left p-3 font-medium text-sm">Устройство</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.slice(0, 50).map((log) => (
                  <tr key={log.id} className="border-b hover:bg-muted/30 transition-colors">
                    <td className="p-3 text-sm">{formatDateTime(log.downloaded_at)}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {log.download_type === 'archive' ? (
                          <>
                            <Icon name="Archive" size={16} className="text-blue-500" />
                            <span className="text-sm">Архив</span>
                          </>
                        ) : (
                          <>
                            <Icon name="Image" size={16} className="text-emerald-500" />
                            <span className="text-sm">Фото</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-sm max-w-xs truncate">
                      {log.folder_name || log.photo_name || '—'}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground">
                      {formatIP(log.client_ip)}
                    </td>
                    <td className="p-3 text-sm text-muted-foreground max-w-xs truncate" title={log.user_agent}>
                      {log.user_agent ? (
                        log.user_agent.includes('Mobile') ? 'Мобильный' :
                        log.user_agent.includes('Windows') ? 'Windows' :
                        log.user_agent.includes('Mac') ? 'Mac' :
                        log.user_agent.includes('Linux') ? 'Linux' : 'Браузер'
                      ) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default DownloadStats;