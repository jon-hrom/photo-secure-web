import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { Project } from '@/components/clients/ClientsTypes';
import { ShootingStyleSelector } from '@/components/clients/dialog/ShootingStyleSelector';
import { getShootingStyles } from '@/data/shootingStyles';
import { getUserTimezoneShort } from '@/utils/regionTimezone';
import DurationSelect from './DurationSelect';

interface ProjectCardProps {
  project: Project;
  isExpanded: boolean;
  selectorKey: number;
  animateKey: number;
  projectPaid: number;
  projectRemaining: number;
  statusBadge: JSX.Element;
  onToggleExpand: () => void;
  onDelete: () => void;
  onUpdateProject: (updates: Partial<Project>) => void;
  onUpdateStatus: (status: Project['status']) => void;
  onUpdateDate: (date: string) => void;
  onShootingStyleChange: (styleId: string) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

const ProjectCard = ({
  project,
  isExpanded,
  selectorKey,
  animateKey,
  projectPaid,
  projectRemaining,
  statusBadge,
  onToggleExpand,
  onDelete,
  onUpdateProject,
  onUpdateStatus,
  onUpdateDate,
  onShootingStyleChange,
  onTouchStart,
  onTouchEnd,
}: ProjectCardProps) => {
  return (
    <Card
      key={`project-card-${project.id}-${project.shootingStyleId || 'none'}`}
      className={`animate-in slide-in-from-top-4 fade-in duration-500 ${
        !project.startDate ? 'border-2 border-orange-500 bg-orange-50/50 dark:bg-orange-950/40' : ''
      }`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <CardHeader
        className="cursor-pointer hover:bg-accent/50 active:bg-accent/70 transition-colors px-3 sm:px-6 py-3 sm:py-4"
        onClick={onToggleExpand}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 flex-wrap text-base sm:text-lg">
              <Icon name={isExpanded ? "ChevronDown" : "ChevronRight"} size={20} className="shrink-0" />
              <span className="truncate">{project.name}</span>
              {statusBadge}
              {!project.startDate && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500 text-white">
                  <Icon name="CalendarX" size={12} />
                  Без даты
                </span>
              )}
            </CardTitle>
            {isExpanded && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm">
                  <span className="text-muted-foreground">Бюджет: <span className="font-medium text-foreground">{project.budget.toLocaleString('ru-RU')} ₽</span></span>
                  <span className="text-muted-foreground">Оплачено: <span key={`paid-${project.id}-${animateKey}`} className="font-medium text-green-600 dark:text-green-400 inline-block animate-in fade-in zoom-in-50 duration-500">{projectPaid.toLocaleString('ru-RU')} ₽</span></span>
                  <span className="text-muted-foreground">Осталось: <span key={`remaining-${project.id}-${animateKey}`} className="font-medium text-orange-600 dark:text-orange-400 inline-block animate-in fade-in zoom-in-50 duration-500">{projectRemaining.toLocaleString('ru-RU')} ₽</span></span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                  <Label className="text-xs text-muted-foreground shrink-0">Дата съёмки:</Label>
                  <Input
                    type="date"
                    min="2020-01-01"
                    max="2099-12-31"
                    value={(() => {
                      if (!project.startDate) return '';
                      if (typeof project.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(project.startDate)) {
                        return project.startDate;
                      }
                      try {
                        const date = new Date(project.startDate);
                        if (isNaN(date.getTime())) return '';
                        const y = date.getFullYear();
                        const m = String(date.getMonth() + 1).padStart(2, '0');
                        const d = String(date.getDate()).padStart(2, '0');
                        return `${y}-${m}-${d}`;
                      } catch {
                        return '';
                      }
                    })()}
                    onChange={(e) => {
                      e.stopPropagation();
                      onUpdateDate(e.target.value);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs h-8 w-full sm:w-40"
                  />
                </div>
                {project.shootingStyleId && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Стиль: <span className="font-medium text-foreground">
                      {getShootingStyles().find(s => s.id === project.shootingStyleId)?.name}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Удалить проект "${project.name || 'Без названия'}"?`)) {
                onDelete();
              }
            }}
            className="shrink-0"
          >
            <Icon name="Trash2" size={16} />
          </Button>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-3 max-h-[45vh] sm:max-h-[60vh] overflow-y-auto">
          {project.description && (
            <p className="text-sm text-muted-foreground">{project.description}</p>
          )}
          <div className="space-y-2">
            <Label className="text-xs">Стиль съёмки</Label>
            <ShootingStyleSelector
              key={`existing-project-${project.id}-${selectorKey}`}
              value={project.shootingStyleId}
              onChange={onShootingStyleChange}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">⏰ Время съёмки <span className="text-muted-foreground font-normal">({getUserTimezoneShort()})</span></Label>
              <Input
                type="time"
                value={project.shooting_time || ''}
                onChange={(e) => onUpdateProject({ shooting_time: e.target.value })}
                className="text-xs sm:text-sm h-10 sm:h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">⏱️ Длительность (минуты)</Label>
              <DurationSelect
                value={project.shooting_duration || 120}
                onChange={(value) => onUpdateProject({ shooting_duration: value })}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">📍 Адрес съёмки</Label>
            <Input
              value={project.shooting_address || ''}
              onChange={(e) => onUpdateProject({ shooting_address: e.target.value })}
              placeholder="Москва, Красная площадь, 1"
              className="text-xs sm:text-sm h-10 sm:h-9"
            />
          </div>
          <div className="flex gap-2">
            <Select
              value={project.status}
              onValueChange={(value) => onUpdateStatus(value as Project['status'])}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new" className="text-green-600 dark:text-green-400 font-medium focus:text-green-700 dark:focus:text-green-300 focus:bg-green-50 dark:focus:bg-green-950/30">Новый</SelectItem>
                <SelectItem value="in_progress" className="text-orange-600 dark:text-orange-400 font-medium focus:text-orange-700 dark:focus:text-orange-300 focus:bg-orange-50 dark:focus:bg-orange-950/30">В работе</SelectItem>
                <SelectItem value="completed" className="text-red-600 dark:text-red-400 font-medium focus:text-red-700 dark:focus:text-red-300 focus:bg-red-50 dark:focus:bg-red-950/30">Завершён</SelectItem>
                <SelectItem value="cancelled" className="text-muted-foreground font-medium focus:text-foreground focus:bg-muted">Отменён</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default ProjectCard;