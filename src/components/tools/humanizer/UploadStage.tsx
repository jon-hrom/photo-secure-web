import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';

interface Props {
  onSubmitText: (text: string, source: string) => void;
  onSubmitFile: (file: File) => void;
  loading: boolean;
  phase: string;
}

const UploadStage = ({ onSubmitText, onSubmitFile, loading, phase }: Props) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file: File | null | undefined) => {
    if (!file) return;
    if (file.size > 15 * 1024 * 1024) {
      alert('Файл слишком большой (макс. 15 МБ)');
      return;
    }
    onSubmitFile(file);
  };

  return (
    <div className="space-y-4">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          handleFile(e.dataTransfer.files[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
          dragOver
            ? 'border-primary bg-primary/5'
            : 'border-border hover:border-primary/50 hover:bg-muted/30'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".txt,.docx,.doc,.pdf,.rtf,.odt,.md,.html,.htm"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
          disabled={loading}
        />
        <Icon name="FileUp" size={36} className="mx-auto mb-2 text-muted-foreground" />
        <p className="font-semibold mb-1">Перетащите документ сюда или нажмите</p>
        <p className="text-xs text-muted-foreground">
          TXT, DOC, DOCX, PDF, RTF, ODT, MD, HTML — до 15 МБ, до 50 000 символов
        </p>
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-border" />
        </div>
        <div className="relative flex justify-center text-xs">
          <span className="bg-background px-2 text-muted-foreground">или вставьте текст</span>
        </div>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Вставьте сюда текст, который нужно сделать человеческим…"
        className="min-h-[180px] font-mono text-sm"
        disabled={loading}
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {text.length.toLocaleString('ru')} символов
          {text.length > 30000 && (
            <span className="text-red-500 ml-2">Макс. 30 000 для обработки</span>
          )}
        </span>
        <Button
          onClick={() => onSubmitText(text.trim(), 'paste')}
          disabled={loading || text.trim().length < 50 || text.length > 30000}
        >
          <Icon name="Sparkles" size={16} className="mr-2" />
          Проанализировать
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-3 text-sm text-muted-foreground">
          <Icon name="Loader2" size={16} className="animate-spin" />
          {phase || 'Обработка…'}
        </div>
      )}
    </div>
  );
};

export default UploadStage;
