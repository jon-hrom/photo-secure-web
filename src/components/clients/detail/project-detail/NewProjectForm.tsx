import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { ShootingStyleSelector } from '@/components/clients/dialog/ShootingStyleSelector';
import { getUserTimezoneShort } from '@/utils/regionTimezone';
import DurationSelect from './DurationSelect';

interface NewProjectData {
  name: string;
  budget: string;
  description: string;
  startDate: string;
  shootingStyleId?: string;
  shooting_time?: string;
  shooting_duration?: number;
  shooting_address?: string;
  add_to_calendar?: boolean;
}

interface NewProjectFormProps {
  isOpen: boolean;
  onToggle: () => void;
  newProject: NewProjectData;
  setNewProject: (project: any) => void;
  handleAddProject: () => void;
}

const NewProjectForm = ({
  isOpen,
  onToggle,
  newProject,
  setNewProject,
  handleAddProject,
}: NewProjectFormProps) => {
  if (!isOpen) {
    return (
      <Button
        variant="outline"
        className="w-full h-12 border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all"
        onClick={onToggle}
      >
        <Icon name="Plus" size={18} className="mr-2" />
        Добавить новую услугу
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3 cursor-pointer hover:bg-accent/50 transition-colors" onClick={onToggle}>
        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
          <Icon name="ChevronDown" size={18} />
          Добавить новую услугу
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 py-3 pb-20 max-h-[60vh] md:max-h-none overflow-y-auto md:overflow-visible">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Название проекта *</Label>
            <Input
              value={newProject.name}
              onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
              placeholder="Свадебная фотосессия"
              className="text-xs h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Бюджет (₽) *</Label>
            <Input
              type="number"
              value={newProject.budget}
              onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })}
              placeholder="50000"
              className="text-xs h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Дата съёмки</Label>
            <Input
              type="date"
              value={newProject.startDate}
              onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
              className="text-xs h-9"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Время съёмки <span className="text-muted-foreground font-normal">({getUserTimezoneShort()})</span></Label>
            <Input
              type="time"
              value={newProject.shooting_time || ''}
              onChange={(e) => setNewProject({ ...newProject, shooting_time: e.target.value })}
              className="text-xs h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Длительность (минуты)</Label>
            <DurationSelect
              value={newProject.shooting_duration || 120}
              onChange={(value) => setNewProject({ ...newProject, shooting_duration: value })}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Адрес съёмки</Label>
            <Input
              type="text"
              value={newProject.shooting_address || ''}
              onChange={(e) => setNewProject({ ...newProject, shooting_address: e.target.value })}
              placeholder="Парк Горького, Москва"
              className="text-xs h-9"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Стиль съёмки</Label>
          <ShootingStyleSelector
            key="new-project-style"
            value={newProject.shootingStyleId}
            onChange={(styleId) => setNewProject({ ...newProject, shootingStyleId: styleId })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Описание</Label>
          <Textarea
            value={newProject.description}
            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
            placeholder="Детали проекта..."
            rows={2}
            className="text-xs"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="add_to_calendar"
            checked={newProject.add_to_calendar || false}
            onCheckedChange={(checked) => setNewProject({ ...newProject, add_to_calendar: checked as boolean })}
          />
          <Label
            htmlFor="add_to_calendar"
            className="text-xs cursor-pointer flex items-center gap-2"
          >
            <Icon name="Calendar" size={14} />
            Добавить в Google Calendar
          </Label>
        </div>
        <div className="h-16"></div>
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t md:static md:border-0 md:p-0">
          <Button onClick={() => { handleAddProject(); onToggle(); }} className="w-full md:w-auto h-11 md:h-9 text-sm md:text-xs shadow-lg md:shadow-none">
            <Icon name="Plus" size={16} className="mr-2" />
            Создать услугу
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NewProjectForm;
