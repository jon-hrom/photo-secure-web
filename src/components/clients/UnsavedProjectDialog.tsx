import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface UnsavedProjectDialogProps {
  open: boolean;
  onContinue: () => void;
  onClear: () => void;
  onCancel: () => void;
  projectData: {
    name: string;
    budget: string;
    description: string;
    startDate: string;
  } | null;
}

const UnsavedProjectDialog = ({ open, onContinue, onClear, onCancel, projectData }: UnsavedProjectDialogProps) => {
  if (!projectData) return null;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onCancel()}>
      <DialogContent className="max-w-md" aria-describedby="unsaved-project-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="AlertTriangle" className="text-orange-500" size={24} />
            Остались несохранённые данные проекта
          </DialogTitle>
          <DialogDescription id="unsaved-project-description">
            Вы начали заполнять данные проекта, но не завершили создание
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-4 space-y-3 bg-muted/50 rounded-lg p-4">
          <div className="text-sm">
            <span className="font-medium">Проект:</span> {projectData.name || '(не указано)'}
          </div>
          {projectData.budget && (
            <div className="text-sm">
              <span className="font-medium">Бюджет:</span> {projectData.budget} ₽
            </div>
          )}
          {projectData.startDate && (
            <div className="text-sm">
              <span className="font-medium">Дата съёмки:</span> {new Date(projectData.startDate).toLocaleDateString('ru-RU')}
            </div>
          )}
          {projectData.description && (
            <div className="text-sm">
              <span className="font-medium">Описание:</span> {projectData.description}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full sm:w-auto"
          >
            Отмена
          </Button>
          <Button
            variant="destructive"
            onClick={onClear}
            className="w-full sm:w-auto"
          >
            <Icon name="Trash2" size={16} className="mr-2" />
            Очистить
          </Button>
          <Button
            onClick={onContinue}
            className="w-full sm:w-auto"
          >
            <Icon name="Play" size={16} className="mr-2" />
            Продолжить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UnsavedProjectDialog;
