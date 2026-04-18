import { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface UploadStageProps {
  fileInputRef: RefObject<HTMLInputElement>;
  onFile: (file: File) => void;
  onOpenPicker: () => void;
}

const UploadStage = ({ fileInputRef, onFile, onOpenPicker }: UploadStageProps) => {
  return (
    <div className="mt-3 space-y-3">
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
        <Icon name="ImagePlus" size={48} className="mx-auto mb-3 text-muted-foreground" />
        <p className="font-medium text-sm sm:text-base mb-1">Выберите фото или перетащите сюда</p>
        <p className="text-xs text-muted-foreground">JPG, PNG, WEBP — до 20 МБ</p>
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

      <Button
        variant="outline"
        className="w-full gap-2"
        onClick={onOpenPicker}
      >
        <Icon name="FolderOpen" size={18} />
        Выбрать из фотобанка
      </Button>
    </div>
  );
};

export default UploadStage;
