import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface AdminPanelHistoryProps {
  history: any[];
  showHistory: boolean;
  onRollback: (historyId: number) => void;
}

const AdminPanelHistory = ({ history, showHistory, onRollback }: AdminPanelHistoryProps) => {
  if (!showHistory || history.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardContent className="pt-6">
        <h3 className="text-lg font-semibold mb-4">История изменений</h3>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {history.map((item) => (
            <div
              key={item.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl bg-card gap-3"
            >
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium">
                  Версия #{item.id}
                </p>
                <p className="text-xs text-muted-foreground">
                  {new Date(item.changed_at).toLocaleString('ru-RU')}
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRollback(item.id)}
                className="w-full sm:w-auto"
              >
                <Icon name="RotateCcw" size={16} className="mr-2" />
                Откатить
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default AdminPanelHistory;
