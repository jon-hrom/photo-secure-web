import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';

interface Widget {
  id: number;
  name: string;
  enabled: boolean;
  order: number;
}

interface AdminWidgetsProps {
  widgets: Widget[];
  onMove: (id: number, direction: 'up' | 'down') => void;
  onToggle: (id: number) => void;
}

const AdminWidgets = ({ widgets, onMove, onToggle }: AdminWidgetsProps) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <Card>
      <CardHeader 
        className="cursor-pointer hover:bg-accent/50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Управление виджетами</CardTitle>
            <CardDescription>Настройка отображения виджетов на дашборде</CardDescription>
          </div>
          <Icon 
            name={isExpanded ? 'ChevronUp' : 'ChevronDown'} 
            className="text-muted-foreground" 
          />
        </div>
      </CardHeader>
      {isExpanded && <CardContent>
        <div className="space-y-3">
          {widgets.map((widget) => (
            <div
              key={widget.id}
              className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border rounded-xl bg-card gap-3"
            >
              <div className="flex items-center gap-3 flex-1">
                <Icon name="LayoutGrid" size={20} className="text-muted-foreground" />
                <span className="font-medium text-sm sm:text-base">{widget.name}</span>
              </div>
              
              <div className="flex items-center gap-2 justify-between sm:justify-start">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onMove(widget.id, 'up')}
                    disabled={widget.order === 1}
                    className="h-8 w-8 p-0"
                  >
                    <Icon name="ChevronUp" size={16} />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onMove(widget.id, 'down')}
                    disabled={widget.order === widgets.length}
                    className="h-8 w-8 p-0"
                  >
                    <Icon name="ChevronDown" size={16} />
                  </Button>
                </div>
                
                <Switch
                  checked={widget.enabled}
                  onCheckedChange={() => onToggle(widget.id)}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>}
    </Card>
  );
};

export default AdminWidgets;