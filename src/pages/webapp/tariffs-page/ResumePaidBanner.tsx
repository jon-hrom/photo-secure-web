import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { ResumablePaid } from './types';

interface ResumePaidBannerProps {
  resumable: ResumablePaid;
  resuming: boolean;
  onResume: () => void;
}

const formatDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch {
    return iso;
  }
};

const ResumePaidBanner = ({ resumable, resuming, onResume }: ResumePaidBannerProps) => {
  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 mb-4">
      <div className="rounded-xl border-2 border-[#1DB954]/40 bg-[#1DB954]/10 dark:bg-[#1DB954]/10 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-start gap-3 flex-1">
          <div className="p-2 bg-[#1DB954]/20 rounded-lg shrink-0">
            <Icon name="RotateCcw" size={20} className="text-[#1DB954]" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-gray-900 dark:text-white">
              У вас остался оплаченный тариф «{resumable.plan_name}»
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5">
              Оплаченный период действует до {formatDate(resumable.expires_at)}. Вернитесь бесплатно —
              без повторной оплаты.
            </p>
          </div>
        </div>
        <Button
          className="bg-[#1DB954] hover:bg-[#1AA34A] text-white font-semibold w-full sm:w-auto shrink-0"
          disabled={resuming}
          onClick={onResume}
        >
          {resuming ? (
            <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
          ) : (
            <Icon name="RotateCcw" size={16} className="mr-2" />
          )}
          {resuming ? 'Возврат...' : 'Вернуться бесплатно'}
        </Button>
      </div>
    </div>
  );
};

export default ResumePaidBanner;
