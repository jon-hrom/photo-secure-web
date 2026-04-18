import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';

interface LogoRemoverDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LogoRemoverDialog = ({ open, onOpenChange }: LogoRemoverDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[95vw] sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg sm:text-xl">
            <Icon name="Eraser" size={22} className="text-primary" />
            Убрать лого с фото
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Инструмент в разработке — появится в ближайшем обновлении
          </DialogDescription>
        </DialogHeader>
        <div className="py-8 text-center text-muted-foreground">
          <Icon name="Loader2" size={32} className="mx-auto mb-3 animate-spin opacity-60" />
          <p className="text-sm">Подключаем AI-детекцию и кисть...</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default LogoRemoverDialog;