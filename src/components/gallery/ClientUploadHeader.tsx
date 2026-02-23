import Icon from '@/components/ui/icon';
import { UploadStep } from './useClientUploadState';

interface ClientUploadHeaderProps {
  step: UploadStep;
  activeFolderName: string;
  headerBg: string;
  hoverBtn: string;
  onBack: () => void;
  onClose: () => void;
}

export default function ClientUploadHeader({
  step,
  activeFolderName,
  headerBg,
  hoverBtn,
  onBack,
  onClose,
}: ClientUploadHeaderProps) {
  const getStepTitle = () => {
    if (step === 'folders') return 'Загрузить фото';
    if (step === 'create') return 'Новая папка';
    if (step === 'rename') return 'Переименовать папку';
    if (step === 'view') return activeFolderName;
    return `"${activeFolderName}"`;
  };

  return (
    <div className={`sticky top-0 z-10 px-4 sm:px-6 py-4 border-b ${headerBg} flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        {step !== 'folders' && (
          <button
            onClick={onBack}
            className={`p-1.5 rounded-lg transition-colors ${hoverBtn}`}
          >
            <Icon name="ArrowLeft" size={20} />
          </button>
        )}
        <h2 className="text-lg font-semibold">{getStepTitle()}</h2>
      </div>
      <button onClick={onClose} className={`p-2 rounded-lg transition-colors ${hoverBtn}`}>
        <Icon name="X" size={20} />
      </button>
    </div>
  );
}
