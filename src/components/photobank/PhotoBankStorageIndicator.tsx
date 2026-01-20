import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';
import { Link } from 'react-router-dom';

interface StorageUsage {
  usedGb: number;
  limitGb: number;
  percent: number;
}

interface PhotoBankStorageIndicatorProps {
  storageUsage: StorageUsage;
  onStorageFull?: () => void;
}

const PhotoBankStorageIndicator = ({ storageUsage, onStorageFull }: PhotoBankStorageIndicatorProps) => {
  const getStorageColor = () => {
    if (storageUsage.percent >= 100) return 'destructive';
    if (storageUsage.percent >= 80) return 'destructive';
    if (storageUsage.percent >= 60) return 'default';
    return 'secondary';
  };

  const getProgressColor = () => {
    if (storageUsage.percent >= 100) return 'bg-red-600';
    if (storageUsage.percent >= 80) return 'bg-red-500';
    if (storageUsage.percent >= 60) return 'bg-yellow-500';
    return 'bg-blue-500';
  };

  const getStorageStatus = () => {
    if (storageUsage.percent >= 100) {
      return {
        icon: 'AlertCircle',
        text: 'Хранилище заполнено!',
        color: 'text-red-600'
      };
    }
    if (storageUsage.percent >= 80) {
      return {
        icon: 'AlertTriangle',
        text: 'Хранилище почти заполнено',
        color: 'text-red-500'
      };
    }
    if (storageUsage.percent >= 60) {
      return {
        icon: 'AlertTriangle',
        text: 'Хранилище заполнено более чем на 60%',
        color: 'text-yellow-600'
      };
    }
    return {
      icon: 'HardDrive',
      text: 'Использование фото банка',
      color: 'text-primary'
    };
  };

  const status = getStorageStatus();

  return (
    <Card className={`border-2 ${storageUsage.percent >= 100 ? 'bg-red-50 border-red-300' : storageUsage.percent >= 80 ? 'bg-red-50 border-red-200' : storageUsage.percent >= 60 ? 'bg-yellow-50 border-yellow-200' : 'bg-gradient-to-r from-blue-50 to-purple-50'}`}>
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name={status.icon as any} size={20} className={status.color} />
              <h3 className={`font-semibold ${status.color}`}>{status.text}</h3>
            </div>
            <Badge variant={getStorageColor()}>
              {storageUsage.percent.toFixed(1)}%
            </Badge>
          </div>
          
          <Progress 
            value={Math.min(storageUsage.percent, 100)} 
            indicatorColor={getProgressColor()}
            className="h-3 transition-all duration-500 ease-out"
          />
          
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{storageUsage.usedGb.toFixed(2)} ГБ использовано</span>
            <span>{Math.floor(storageUsage.limitGb)} ГБ доступно</span>
          </div>

          {storageUsage.percent >= 100 && (
            <div className="mt-4 p-4 bg-red-100 border border-red-300 rounded-lg">
              <div className="flex items-start gap-3">
                <Icon name="Ban" size={24} className="text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-semibold text-red-900">
                    Загрузка фото приостановлена
                  </p>
                  <p className="text-sm text-red-800">
                    Объём хранилища заполнен на 100%. Для продолжения работы необходимо перейти на тарифный план с большим объёмом фото банка.
                  </p>
                  <Link 
                    to="/tariffs" 
                    className="inline-flex items-center gap-2 text-sm font-medium text-red-700 hover:text-red-900 underline"
                  >
                    Перейти к тарифам
                    <Icon name="ArrowRight" size={16} />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {storageUsage.percent >= 80 && storageUsage.percent < 100 && (
            <div className="mt-4 p-3 bg-orange-100 border border-orange-300 rounded-lg">
              <div className="flex items-start gap-2">
                <Icon name="AlertTriangle" size={20} className="text-orange-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-orange-900">
                    Хранилище почти заполнено. Рекомендуем перейти на тариф с большим объёмом.{' '}
                    <Link to="/tariffs" className="font-medium underline hover:text-orange-700">
                      Выбрать тариф
                    </Link>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PhotoBankStorageIndicator;