import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';

interface StorageUsage {
  usedGb: number;
  limitGb: number;
  percent: number;
}

interface PhotoBankStorageIndicatorProps {
  storageUsage: StorageUsage;
}

const PhotoBankStorageIndicator = ({ storageUsage }: PhotoBankStorageIndicatorProps) => {
  return (
    <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border-2">
      <CardContent className="pt-6">
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon name="HardDrive" size={20} className="text-primary" />
              <h3 className="font-semibold">Использование фото банка</h3>
            </div>
            <Badge variant={storageUsage.percent >= 90 ? 'destructive' : storageUsage.percent >= 70 ? 'default' : 'secondary'}>
              {storageUsage.percent.toFixed(1)}%
            </Badge>
          </div>
          <Progress 
            value={storageUsage.percent} 
            className="h-3 transition-all duration-500 ease-out"
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{storageUsage.usedGb.toFixed(2)} ГБ использовано</span>
            <span>{storageUsage.limitGb.toFixed(0)} ГБ доступно</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default PhotoBankStorageIndicator;
