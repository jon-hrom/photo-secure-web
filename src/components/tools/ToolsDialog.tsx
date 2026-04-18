import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';

interface ToolsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenLogoRemover: () => void;
}

interface ToolCardProps {
  icon: string;
  title: string;
  description: string;
  onClick: () => void;
  gradient: string;
}

const ToolCard = ({ icon, title, description, onClick, gradient }: ToolCardProps) => (
  <button
    onClick={onClick}
    className="group relative overflow-hidden rounded-xl border border-border bg-card hover:shadow-lg hover:scale-[1.02] transition-all duration-300 text-left p-4 sm:p-5"
  >
    <div className={`absolute inset-0 bg-gradient-to-br ${gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
    <div className="relative z-10 flex items-start gap-3 sm:gap-4">
      <div className={`p-2.5 sm:p-3 rounded-lg bg-gradient-to-br ${gradient} shadow-md flex-shrink-0 group-hover:scale-110 transition-transform duration-300`}>
        <Icon name={icon} size={22} className="text-white sm:w-6 sm:h-6" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-bold text-sm sm:text-base text-foreground mb-1">{title}</h3>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{description}</p>
      </div>
      <Icon name="ChevronRight" size={18} className="text-muted-foreground flex-shrink-0 group-hover:translate-x-1 transition-transform duration-300" />
    </div>
  </button>
);

const ToolsDialog = ({ open, onOpenChange, onOpenLogoRemover }: ToolsDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Icon name="Wrench" size={22} className="text-primary" />
            Инструменты
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Полезные AI-инструменты для работы с фотографиями
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 mt-2">
          <ToolCard
            icon="Eraser"
            title="Убрать лого с фото"
            description="AI найдёт и сотрёт водяные знаки, логотипы, надписи. Можно доработать кистью."
            gradient="from-purple-500 to-pink-500"
            onClick={() => {
              onOpenChange(false);
              onOpenLogoRemover();
            }}
          />

          <div className="rounded-xl border border-dashed border-border p-4 sm:p-5 text-center text-muted-foreground">
            <Icon name="Plus" size={22} className="mx-auto mb-2 opacity-50" />
            <p className="text-xs sm:text-sm">Скоро здесь появятся новые инструменты</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ToolsDialog;