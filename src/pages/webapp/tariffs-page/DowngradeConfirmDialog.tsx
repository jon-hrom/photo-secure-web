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
import { Plan } from './types';

interface DowngradeConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  freePlan: Plan | null;
  paidPlanName?: string;
  paidExpiresAt?: string;
  processing: boolean;
  onConfirm: () => void;
}

const formatDate = (iso?: string) => {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
};

const DowngradeConfirmDialog = ({
  open,
  onOpenChange,
  freePlan,
  paidPlanName,
  paidExpiresAt,
  processing,
  onConfirm,
}: DowngradeConfirmDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Перейти на бесплатный тариф?</DialogTitle>
          <DialogDescription>
            Вы переключитесь на тариф «{freePlan?.plan_name || 'Бесплатный'}».
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-lg border border-[#1DB954]/30 bg-[#1DB954]/5 p-3 flex items-start gap-2.5">
          <Icon name="ShieldCheck" size={18} className="text-[#1DB954] shrink-0 mt-0.5" />
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {paidPlanName ? (
              <>
                Ваш платный тариф «{paidPlanName}» оплачен
                {paidExpiresAt ? ` до ${formatDate(paidExpiresAt)}` : ''}. Вы сможете{' '}
                <b>бесплатно вернуться</b> на него в любой момент до конца этого срока — платить заново не нужно.
              </>
            ) : (
              <>Платный тариф можно вернуть бесплатно до конца оплаченного срока.</>
            )}
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={processing}>
            Отмена
          </Button>
          <Button onClick={onConfirm} disabled={processing}>
            {processing ? (
              <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
            ) : (
              <Icon name="Gift" size={16} className="mr-2" />
            )}
            {processing ? 'Переключение...' : 'Перейти на бесплатный'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default DowngradeConfirmDialog;
