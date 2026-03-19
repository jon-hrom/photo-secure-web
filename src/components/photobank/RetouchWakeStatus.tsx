import Icon from '@/components/ui/icon';

interface RetouchWakeStatusProps {
  waking: boolean;
  wakeStatus: string | null;
}

const RetouchWakeStatus = ({ waking, wakeStatus }: RetouchWakeStatusProps) => {
  if (!wakeStatus) return null;

  if (waking) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/50 p-4 flex items-center gap-3">
        <Icon name="Loader2" size={18} className="animate-spin text-amber-600 flex-shrink-0" />
        <span className="text-sm text-amber-800 dark:text-amber-200">{wakeStatus}</span>
      </div>
    );
  }

  const isSuccess = wakeStatus.includes('готов') || wakeStatus.includes('работает');

  return (
    <div className={`rounded-lg border p-4 flex items-center gap-3 ${
      isSuccess
        ? 'border-green-300 bg-green-50 dark:bg-green-950/50'
        : 'border-red-300 bg-red-50 dark:bg-red-950/50'
    }`}>
      <Icon
        name={isSuccess ? 'CheckCircle' : 'AlertCircle'}
        size={18}
        className={isSuccess ? 'text-green-600' : 'text-red-600'}
      />
      <span className="text-sm">{wakeStatus}</span>
    </div>
  );
};

export default RetouchWakeStatus;
