import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface RetouchActionButtonsProps {
  previewSrc: string;
  testingRetouch: boolean;
  currentPreviewPhotoId?: number;
  autoMode: boolean;
  saving: boolean;
  onTestRetouch: () => void;
  onSave: () => void;
  onReset: () => void;
}

const RetouchActionButtons = ({
  previewSrc,
  testingRetouch,
  currentPreviewPhotoId,
  autoMode,
  saving,
  onTestRetouch,
  onSave,
  onReset,
}: RetouchActionButtonsProps) => {
  return (
    <div className="space-y-1.5 pt-1">
      {previewSrc && (
        <Button
          onClick={onTestRetouch}
          disabled={testingRetouch || !currentPreviewPhotoId}
          variant="outline"
          className="w-full h-8 text-xs border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/30"
        >
          {testingRetouch ? (
            <Icon name="Loader2" size={14} className="mr-1.5 animate-spin" />
          ) : (
            <Icon name="Sparkles" size={14} className="mr-1.5" />
          )}
          {testingRetouch ? 'Обработка...' : autoMode ? 'Тест авто-ретуши' : 'Тест на фото'}
        </Button>
      )}
      <div className="flex gap-2">
        <Button
          onClick={onSave}
          disabled={saving}
          className="flex-1 bg-rose-600 hover:bg-rose-700 text-white h-8 text-xs"
        >
          {saving ? (
            <Icon name="Loader2" size={14} className="mr-1.5 animate-spin" />
          ) : (
            <Icon name="Check" size={14} className="mr-1.5" />
          )}
          {autoMode ? 'Сохранить авто' : 'Применить'}
        </Button>
        <Button variant="outline" onClick={onReset} className="h-8 text-xs">
          <Icon name="RotateCcw" size={12} className="mr-1" />
          Сброс
        </Button>
      </div>
    </div>
  );
};

export default RetouchActionButtons;
