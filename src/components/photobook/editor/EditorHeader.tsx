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
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-2 md:mb-4 gap-2">
      <Button variant="ghost" size="icon" onClick={onBack} className="md:mb-0">
        <Icon name="ArrowLeft" size={20} />
      </Button>
      <div className="flex flex-wrap items-center gap-2 flex-1">
        <h2 className="text-base md:text-xl font-bold">Редактор коллажей</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={onAutoFill}
          disabled={isDetectingFaces}
          className="text-xs md:text-sm"
        >
          {isDetectingFaces ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 md:h-4 md:w-4 border-b-2 border-purple-600 mr-1"></div>
              <span className="hidden md:inline">Распознавание лиц...</span>
              <span className="md:hidden">Ищем...</span>
            </>
          ) : facesDetected ? (
            <>
              <Icon name="CheckCircle2" size={14} className="mr-1 text-green-600" />
              Готово!
            </>
          ) : (
            <>
              <Icon name="Wand2" size={14} className="mr-1" />
              <span className="hidden md:inline">Автозаполнение</span>
              <span className="md:hidden">Авто</span>
            </>
          )}
        </Button>
        <Button
          variant={manualMode ? 'default' : 'outline'}
          size="sm"
          onClick={onToggleManualMode}
          className={`text-xs md:text-sm ${manualMode ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
        >
          <Icon name={manualMode ? 'Unlock' : 'Lock'} size={14} className="mr-1" />
          <span className="hidden md:inline">{manualMode ? 'Ручной режим' : 'Ручной режим'}</span>
          <span className="md:hidden">Ручной</span>
        </Button>
      </div>
      <Button
        className="bg-purple-600 hover:bg-purple-700 text-white font-semibold text-sm w-full md:w-auto"
        onClick={onComplete}
        size="sm"
      >
        Завершить
      </Button>
    </div>
  );
};

export default EditorHeader;