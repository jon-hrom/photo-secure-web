import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface EditorHeaderProps {
  onBack: () => void;
  onAutoFill: () => void;
  isDetectingFaces: boolean;
  facesDetected: boolean;
  manualMode: boolean;
  onToggleManualMode: () => void;
  onComplete: () => void;
}

const EditorHeader = ({
  onBack,
  onAutoFill,
  isDetectingFaces,
  facesDetected,
  manualMode,
  onToggleManualMode,
  onComplete
}: EditorHeaderProps) => {
  return (
    <div className="flex items-center justify-between mb-4">
      <Button variant="ghost" size="icon" onClick={onBack}>
        <Icon name="ArrowLeft" size={24} />
      </Button>
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold">Редактор коллажей</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onAutoFill}
          disabled={isDetectingFaces}
        >
          {isDetectingFaces ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></div>
              Распознавание лиц...
            </>
          ) : facesDetected ? (
            <>
              <Icon name="CheckCircle2" size={16} className="mr-1 text-green-600" />
              Готово!
            </>
          ) : (
            <>
              <Icon name="Wand2" size={16} className="mr-1" />
              Автозаполнение
            </>
          )}
        </Button>
        <Button
          variant={manualMode ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleManualMode}
          className={manualMode ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          <Icon name={manualMode ? 'Unlock' : 'Lock'} size={16} className="mr-1" />
          {manualMode ? 'Ручной режим' : 'Ручной режим'}
        </Button>
      </div>
      <Button
        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold"
        onClick={onComplete}
      >
        Завершить
      </Button>
    </div>
  );
};

export default EditorHeader;
