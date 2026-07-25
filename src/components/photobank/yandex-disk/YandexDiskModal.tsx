import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';
import type { DiskFolder } from './useYandexDiskPhotobank';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: 'import' | 'export';
  step: 'auth' | 'browse' | 'progress';
  authUrl: string;
  busy: boolean;
  diskPath: string;
  folders: DiskFolder[];
  photosHere: number;
  progress: number;
  progressTotal: number;
  progressDone: number;
  exportFolderName: string;
  onSubmitCode: (code: string) => void;
  onBrowse: (path: string) => void;
  onRunImport: (path: string) => void;
}

const parentPath = (path: string): string => {
  const p = path.replace(/\/+$/, '');
  if (!p || p === '') return '/';
  const idx = p.lastIndexOf('/');
  return idx <= 0 ? '/' : p.slice(0, idx);
};

export default function YandexDiskModal(props: Props) {
  const {
    open, onOpenChange, mode, step, authUrl, busy,
    diskPath, folders, photosHere, progress, progressTotal, progressDone,
    exportFolderName, onSubmitCode, onBrowse, onRunImport,
  } = props;
  const [code, setCode] = useState('');

  const title = mode === 'import' ? 'Импорт с Яндекс.Диска' : 'Сохранить на Яндекс.Диск';

  const pasteCode = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setCode(t.trim());
    } catch { /* clipboard недоступен */ }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="HardDrive" size={20} className="text-[#FC3F1D]" />
            {title}
          </DialogTitle>
        </DialogHeader>

        {step === 'auth' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {mode === 'import'
                ? 'Подключите ваш Яндекс.Диск, чтобы выбрать папку и загрузить из неё фото в фотобанк.'
                : `Подключите ваш Яндекс.Диск, чтобы сохранить папку «${exportFolderName}».`}
            </p>
            <ol className="text-sm space-y-1 list-decimal list-inside text-muted-foreground">
              <li>Откройте окно Яндекса и разрешите доступ</li>
              <li>Скопируйте код подтверждения</li>
              <li>Вставьте его в поле ниже</li>
            </ol>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => window.open(authUrl, '_blank', 'width=700,height=700')}
              disabled={!authUrl}
            >
              <Icon name="ExternalLink" size={16} className="mr-2" />
              Открыть окно Яндекса
            </Button>
            <div className="flex gap-2">
              <Input
                placeholder="Код подтверждения"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <Button variant="outline" onClick={pasteCode} type="button">Вставить</Button>
            </div>
            <Button
              className="w-full bg-[#FC3F1D] hover:bg-[#e0350f] text-white"
              onClick={() => onSubmitCode(code)}
              disabled={busy || !code.trim()}
            >
              {busy ? 'Подключение...' : (mode === 'import' ? 'Подключить и выбрать папку' : 'Подключить и сохранить')}
            </Button>
          </div>
        )}

        {step === 'browse' && mode === 'import' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm">
              <Button
                variant="ghost" size="sm"
                onClick={() => onBrowse(parentPath(diskPath))}
                disabled={busy || diskPath === '/'}
                className="h-8 px-2"
              >
                <Icon name="ArrowUp" size={16} />
              </Button>
              <span className="truncate text-muted-foreground">
                {diskPath === '/' ? 'Яндекс.Диск' : diskPath}
              </span>
            </div>

            <div className="max-h-64 overflow-y-auto border rounded-lg divide-y">
              {folders.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground text-center">Вложенных папок нет</div>
              )}
              {folders.map((f) => (
                <button
                  key={f.path}
                  onClick={() => onBrowse(f.path)}
                  disabled={busy}
                  className="w-full flex items-center gap-2 p-3 text-left hover:bg-accent text-sm disabled:opacity-50"
                >
                  <Icon name="Folder" size={18} className="text-[#FC3F1D] shrink-0" />
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
            </div>

            <div className="text-sm text-muted-foreground">
              {photosHere > 0
                ? `В этой папке фото: ${photosHere}`
                : 'В этой папке нет фото — откройте нужную папку'}
            </div>

            <Button
              className="w-full bg-[#FC3F1D] hover:bg-[#e0350f] text-white"
              onClick={() => onRunImport(diskPath)}
              disabled={busy || photosHere === 0}
            >
              <Icon name="Download" size={16} className="mr-2" />
              Загрузить {photosHere > 0 ? `${photosHere} фото ` : ''}в фотобанк
            </Button>
          </div>
        )}

        {step === 'progress' && (
          <div className="space-y-4 py-2">
            <p className="text-sm text-center text-muted-foreground">
              {mode === 'import' ? 'Загружаем фото в фотобанк...' : 'Отправляем фото на Яндекс.Диск...'}
            </p>
            <Progress value={progress} />
            <p className="text-sm text-center font-medium">
              {progressDone} из {progressTotal} фото ({progress}%)
            </p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
