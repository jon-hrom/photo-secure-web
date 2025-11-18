import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';

interface AdminPanelHistoryProps {
  history: any[];
  showHistory: boolean;
  onRollback: (historyId: number) => void;
}

const AdminPanelHistory = ({ history, showHistory, onRollback }: AdminPanelHistoryProps) => {
  const [selectedItem, setSelectedItem] = useState<any>(null);

  if (!showHistory || history.length === 0) {
    return null;
  }

  const formatChangeData = (changeData: any) => {
    if (!changeData) return null;

    try {
      const data = typeof changeData === 'string' ? JSON.parse(changeData) : changeData;
      
      return (
        <div className="space-y-4">
          {data.settings && Object.keys(data.settings).length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Icon name="Settings" size={16} />
                Настройки ({Object.keys(data.settings).length})
              </h4>
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                {Object.entries(data.settings).map(([key, value]: [string, any]) => (
                  <div key={key} className="flex justify-between items-start gap-4 text-sm">
                    <span className="font-medium text-muted-foreground">{key}:</span>
                    <span className="text-right font-mono">
                      {typeof value === 'boolean' ? (value ? '✓ Включено' : '✗ Выключено') : String(value)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.colors && Object.keys(data.colors).length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Icon name="Palette" size={16} />
                Цвета ({Object.keys(data.colors).length})
              </h4>
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                {Object.entries(data.colors).map(([key, value]: [string, any]) => (
                  <div key={key} className="flex justify-between items-center gap-4 text-sm">
                    <span className="font-medium text-muted-foreground">{key}:</span>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-8 h-8 rounded border-2 border-border"
                        style={{ backgroundColor: value }}
                      />
                      <span className="font-mono">{value}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.widgets && data.widgets.length > 0 && (
            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2">
                <Icon name="Grid3x3" size={16} />
                Виджеты ({data.widgets.length})
              </h4>
              <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                {data.widgets.map((widget: any, idx: number) => (
                  <div key={idx} className="text-sm">
                    <span className="font-medium">{widget.widget_name || widget.name}</span>
                    {' - '}
                    <span className={widget.enabled ? 'text-green-600' : 'text-muted-foreground'}>
                      {widget.enabled ? 'Включен' : 'Выключен'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    } catch (error) {
      return (
        <div className="bg-muted/50 rounded-lg p-3">
          <pre className="text-xs overflow-auto">{JSON.stringify(changeData, null, 2)}</pre>
        </div>
      );
    }
  };

  return (
    <>
      <Card>
        <CardContent className="pt-6">
          <h3 className="text-lg font-semibold mb-4">История изменений</h3>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {history.map((item) => (
              <div
                key={item.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl bg-card gap-3 hover:bg-muted/50 transition-colors cursor-pointer"
                onClick={() => setSelectedItem(item)}
              >
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    <Icon name="FileText" size={16} className="text-muted-foreground" />
                    <p className="text-sm font-medium">
                      Версия #{item.id}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-2">
                    <Icon name="Clock" size={12} />
                    {new Date(item.createdAt || item.changed_at).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </p>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-1">
                      {item.description}
                    </p>
                  )}
                  {item.changed_by && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Icon name="User" size={12} />
                      {item.changed_by}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRollback(item.id);
                  }}
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

      <Dialog open={!!selectedItem} onOpenChange={(open) => !open && setSelectedItem(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="History" size={20} />
              Детали изменений - Версия #{selectedItem?.id}
            </DialogTitle>
            <DialogDescription>
              Просмотр всех изменений в этой версии
            </DialogDescription>
          </DialogHeader>

          {selectedItem && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Дата и время</p>
                  <p className="font-medium">
                    {new Date(selectedItem.createdAt || selectedItem.changed_at).toLocaleString('ru-RU', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </p>
                </div>
                
                {selectedItem.changed_by && (
                  <div>
                    <p className="text-muted-foreground">Изменил</p>
                    <p className="font-medium">{selectedItem.changed_by}</p>
                  </div>
                )}

                {selectedItem.change_type && (
                  <div>
                    <p className="text-muted-foreground">Тип изменения</p>
                    <p className="font-medium capitalize">{selectedItem.change_type}</p>
                  </div>
                )}

                {selectedItem.description && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Описание</p>
                    <p className="font-medium">{selectedItem.description}</p>
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <h3 className="font-semibold mb-3">Изменённые данные:</h3>
                {formatChangeData(selectedItem.change_data || selectedItem.changeData)}
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setSelectedItem(null)}
            >
              Закрыть
            </Button>
            <Button 
              onClick={() => {
                if (selectedItem) {
                  onRollback(selectedItem.id);
                  setSelectedItem(null);
                }
              }}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Icon name="RotateCcw" size={16} className="mr-2" />
              Откатить на эту версию
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AdminPanelHistory;
