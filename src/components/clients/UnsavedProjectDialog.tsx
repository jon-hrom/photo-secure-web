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
      <DialogContent className="max-w-[95vw] sm:max-w-md mx-4" aria-describedby="unsaved-project-description">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Icon name="AlertTriangle" className="text-orange-500 flex-shrink-0" size={20} />
            <span className="leading-tight">Остались несохранённые данные проекта</span>
          </DialogTitle>
          <DialogDescription id="unsaved-project-description" className="text-sm">
            Вы начали заполнять проект для клиента, но не завершили создание
          </DialogDescription>
        </DialogHeader>
        
        <div className="py-3 sm:py-4 space-y-2 sm:space-y-3 bg-muted/50 rounded-lg p-3 sm:p-4 max-h-[50vh] overflow-y-auto">
          <div className="text-xs sm:text-sm">
            <span className="font-medium">Проект:</span> {projectData.name || '(не указано)'}
          </div>
          {projectData.budget && (
            <div className="text-xs sm:text-sm">
              <span className="font-medium">Бюджет:</span> {projectData.budget} ₽
            </div>
          )}
          {projectData.startDate && (
            <div className="text-xs sm:text-sm">
              <span className="font-medium">Дата съёмки:</span> {new Date(projectData.startDate).toLocaleDateString('ru-RU')}
            </div>
          )}
          {projectData.description && (
            <div className="text-xs sm:text-sm">
              <span className="font-medium">Описание:</span> <span className="break-words">{projectData.description}</span>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            onClick={onCancel}
            className="w-full sm:w-auto order-3 sm:order-1 text-sm h-10"
          >
            Отмена
          </Button>
          <Button
            variant="destructive"
            onClick={onClear}
            className="w-full sm:w-auto order-2 text-sm h-10"
          >
            <Icon name="Trash2" size={16} className="mr-2" />
            Очистить
          </Button>
          <Button
            onClick={onContinue}
            className="w-full sm:w-auto order-1 sm:order-3 text-sm h-10 shadow-lg"
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