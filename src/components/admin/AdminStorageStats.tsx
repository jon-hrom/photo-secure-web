import { Card, CardContent } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface AdminStorageStatsProps {
  totalUsers: number;
  totalRevenue: number;
  totalStorageUsed: number;
}

export const AdminStorageStats = ({ totalUsers, totalRevenue, totalStorageUsed }: AdminStorageStatsProps) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Icon name="Users" className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Пользователей</p>
              <p className="text-2xl font-bold">{totalUsers}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Icon name="DollarSign" className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Доход</p>
              <p className="text-2xl font-bold">{totalRevenue.toLocaleString()} ₽</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Icon name="HardDrive" className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Использовано</p>
              <p className="text-2xl font-bold">{totalStorageUsed.toFixed(2)} GB</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
