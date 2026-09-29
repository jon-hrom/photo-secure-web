import { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

interface UploadStageProps {
  fileInputRef: RefObject<HTMLInputElement>;
  price: number | null;
  onFile: (file: File) => void;
  onOpenPicker: () => void;
}

const UploadStage = ({ fileInputRef, price, onFile, onOpenPicker }: UploadStageProps) => {

  return (
    <div className="mt-3 space-y-4">
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
        После загрузки фото вы настроите силу ретуши, пластику и кисть «Похудеть» —
        обработка начнётся только по кнопке «Ретушь».
      </p>
    </div>
  );
};

export default UploadStage;
