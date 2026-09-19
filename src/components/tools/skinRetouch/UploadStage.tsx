import { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { PRESETS, PresetKey } from '@/components/tools/skinRetouch/utils';

interface UploadStageProps {
  fileInputRef: RefObject<HTMLInputElement>;
  preset: PresetKey;
  setPreset: (p: PresetKey) => void;
  price: number | null;
  onFile: (file: File) => void;
  onOpenPicker: () => void;
}

const UploadStage = ({ fileInputRef, preset, setPreset, price, onFile, onOpenPicker }: UploadStageProps) => {
  const active = PRESETS.find((p) => p.key === preset);

  return (
    <div className="mt-3 space-y-4">
      <div>
        <p className="text-xs font-medium mb-2">Сила ретуши</p>
        <div className="grid grid-cols-3 gap-2">
          {PRESETS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPreset(p.key)}
              className={`rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors ${
                preset === p.key
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-border hover:border-primary/40'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        {active && <p className="text-[11px] text-muted-foreground mt-1.5">{active.hint}</p>}
      </div>

      <div
        className="border-2 border-dashed border-border rounded-xl p-8 sm:p-12 text-center hover:border-primary/50 transition-colors cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
      >
        <Icon name="Sparkles" size={48} className="mx-auto mb-3 text-muted-foreground" />
        <p className="font-medium text-sm sm:text-base mb-1">Выберите фото или перетащите сюда</p>
        <p className="text-xs text-muted-foreground">JPG, PNG, WEBP — до 20 МБ</p>
        {price !== null && (
          <p className="text-[11px] font-medium text-yellow-600 dark:text-yellow-500 mt-2 inline-flex items-center gap-0.5">
            {price}
            <Icon name="Zap" size={11} className="fill-current" />
            за фото
          </p>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onFile(f);
            e.target.value = '';
          }}
        />
      </div>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-border" />
        <span className="text-[11px] text-muted-foreground">или</span>
        <div className="flex-1 h-px bg-border" />
      </div>

      <Button variant="outline" className="w-full gap-2" onClick={onOpenPicker}>
        <Icon name="FolderOpen" size={18} />
        Выбрать из фотобанка
      </Button>

      <p className="text-[11px] text-muted-foreground">
        AI убирает акне, покраснения и жирный блеск. Черты лица, фигура, поза,
        одежда и фон остаются без изменений — правится только поверхность кожи.
      </p>
    </div>
  );
};

export default UploadStage;
