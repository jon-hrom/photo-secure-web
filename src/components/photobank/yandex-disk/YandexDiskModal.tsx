import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';
import type { DiskFolder, DiskPhoto } from './useYandexDiskPhotobank';
import { diskImageUrl } from './useYandexDiskPhotobank';
import PhotoGridViewer from '@/components/photobank/PhotoGridViewer';

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
  diskPhotos: DiskPhoto[];
  photosLoading: boolean;
  token: string;
  progress: number;
  progressTotal: number;
  progressDone: number;
  exportFolderName: string;
  onSubmitCode: (code: string) => void;
  onBrowse: (path: string) => void;
  onRunImport: (path: string, names?: string[]) => void;
}

interface ViewerPhoto {
  id: number;
  file_name: string;
  s3_url?: string;
  thumbnail_s3_url?: string;
  file_size: number;
  width: number | null;
  height: number | null;
  created_at: string;
}

const formatBytes = (bytes: number): string => {
  if (!bytes) return '—';
  const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
};

const parentPath = (path: string): string => {
  const p = path.replace(/\/+$/, '');
  if (!p || p === '') return '/';
  const idx = p.lastIndexOf('/');
  return idx <= 0 ? '/' : p.slice(0, idx);
};

export default function YandexDiskModal(props: Props) {
  const {
    open, onOpenChange, mode, step, authUrl, busy,
    diskPath, folders, photosHere, diskPhotos, photosLoading, token,
    progress, progressTotal, progressDone,
    exportFolderName, onSubmitCode, onBrowse, onRunImport,
  } = props;
  const [code, setCode] = useState('');
  const [search, setSearch] = useState('');
  const [viewIndex, setViewIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  // Сбрасываем поиск, просмотр и выбор при переходе в другую папку Диска
  useEffect(() => {
    setSearch('');
    setViewIndex(null);
    setSelected(new Set());
  }, [diskPath]);

  const toggleSelect = (name: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const allSelected = diskPhotos.length > 0 && selected.size === diskPhotos.length;
  const toggleSelectAll = () => {
    setSelected(allSelected ? new Set() : new Set(diskPhotos.map((p) => p.name)));
  };

  const filteredFolders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return folders;
    return folders.filter((f) => (f.name || '').toLowerCase().includes(q));
  }, [folders, search]);

  // Мапим фото Яндекс.Диска в формат просмотрщика фотобанка
  const viewerPhotos: ViewerPhoto[] = useMemo(
    () =>
      diskPhotos.map((p, i) => ({
        id: i,
        file_name: p.name,
        thumbnail_s3_url: diskImageUrl(p.path, token, 'preview'),
        s3_url: diskImageUrl(p.path, token, 'preview'),
        file_size: p.size || 0,
        width: null,
        height: null,
        created_at: new Date().toISOString(),
      })),
    [diskPhotos, token],
  );

  const noop = async () => {};

  const title = mode === 'import' ? 'Импорт с Яндекс.Диска' : 'Сохранить на Яндекс.Диск';

  const pasteCode = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setCode(t.trim());
    } catch { /* clipboard недоступен */ }
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={
          (step === 'browse'
            ? 'w-[calc(100vw-1.5rem)] max-w-md sm:max-w-2xl lg:max-w-3xl'
            : 'w-[calc(100vw-1.5rem)] max-w-md') +
          ' p-4 sm:p-6 max-h-[90vh] overflow-y-auto'
        }
      >
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

            {folders.length > 0 && (
              <div className="relative">
                <Icon name="Search" size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Поиск папки..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9 pr-9"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  >
                    <Icon name="X" size={16} />
                  </button>
                )}
              </div>
            )}

            <div className="max-h-[45vh] sm:max-h-[55vh] min-h-[200px] sm:min-h-[280px] overflow-y-auto border rounded-lg divide-y">
              {folders.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground text-center">Вложенных папок нет</div>
              )}
              {folders.length > 0 && filteredFolders.length === 0 && (
                <div className="p-4 text-sm text-muted-foreground text-center">Ничего не найдено</div>
              )}
              {filteredFolders.map((f) => (
                <button
                  key={f.path}
                  onClick={() => onBrowse(f.path)}
                  disabled={busy}
                  className="w-full flex items-center gap-2 p-3.5 sm:p-3 text-left hover:bg-accent active:bg-accent text-sm disabled:opacity-50 touch-manipulation"
                >
                  <Icon name="Folder" size={18} className="text-[#FC3F1D] shrink-0" />
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
            </div>

            {photosHere > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <div className="text-muted-foreground flex items-center gap-2">
                    <Icon name="Image" size={16} className="text-[#FC3F1D]" />
                    {selected.size > 0
                      ? `Выбрано: ${selected.size} из ${diskPhotos.length}`
                      : `Фото в этой папке: ${photosHere}`}
                    {photosLoading && <Icon name="Loader2" size={14} className="animate-spin" />}
                  </div>
                  {viewerPhotos.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-[#FC3F1D] hover:underline shrink-0 font-medium"
                    >
                      {allSelected ? 'Снять выбор' : 'Выбрать все'}
                    </button>
                  )}
                </div>

                {viewerPhotos.length > 0 && (
                  <div className="max-h-[40vh] overflow-y-auto rounded-lg border p-2">
                    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-1.5">
                      {viewerPhotos.map((p, i) => {
                        const name = p.file_name;
                        const isSel = selected.has(name);
                        return (
                          <div
                            key={p.id}
                            className={
                              'relative aspect-square overflow-hidden rounded-md bg-muted group touch-manipulation ' +
                              (isSel ? 'ring-2 ring-[#FC3F1D]' : '')
                            }
                          >
                            <button
                              type="button"
                              onClick={() => setViewIndex(i)}
                              className="absolute inset-0 w-full h-full"
                            >
                              <img
                                src={p.thumbnail_s3_url}
                                alt={name}
                                loading="lazy"
                                className="w-full h-full object-cover transition group-hover:scale-105 group-active:scale-105"
                              />
                              <span className="absolute inset-0 flex items-center justify-center bg-black/0 group-hover:bg-black/20 transition">
                                <Icon name="Eye" size={20} className="text-white opacity-0 group-hover:opacity-100 transition" />
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={() => toggleSelect(name)}
                              className={
                                'absolute top-1 left-1 w-6 h-6 rounded-md flex items-center justify-center border-2 transition touch-manipulation ' +
                                (isSel
                                  ? 'bg-[#FC3F1D] border-[#FC3F1D] text-white'
                                  : 'bg-black/40 border-white/80 text-transparent hover:bg-black/60')
                              }
                            >
                              <Icon name="Check" size={14} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}

            {photosHere === 0 && (
              <div className="text-sm text-muted-foreground">
                В этой папке нет фото — откройте нужную папку
              </div>
            )}

            <Button
              className="w-full bg-[#FC3F1D] hover:bg-[#e0350f] text-white"
              onClick={() => onRunImport(diskPath, selected.size > 0 ? Array.from(selected) : undefined)}
              disabled={busy || photosHere === 0}
            >
              <Icon name="Download" size={16} className="mr-2" />
              {selected.size > 0
                ? `Загрузить выбранные (${selected.size}) в фотобанк`
                : `Загрузить ${photosHere > 0 ? `${photosHere} фото ` : ''}в фотобанк`}
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

    {viewIndex !== null && viewerPhotos[viewIndex] && (
      <PhotoGridViewer
        viewPhoto={viewerPhotos[viewIndex]}
        photos={viewerPhotos}
        onClose={() => setViewIndex(null)}
        onNavigate={(dir) =>
          setViewIndex((idx) => {
            if (idx === null) return idx;
            const next = dir === 'prev' ? idx - 1 : idx + 1;
            return next >= 0 && next < viewerPhotos.length ? next : idx;
          })
        }
        onDownload={noop}
        formatBytes={formatBytes}
        downloadDisabled
        selectable
        isSelected={selected.has(viewerPhotos[viewIndex].file_name)}
        onToggleSelect={() => toggleSelect(viewerPhotos[viewIndex].file_name)}
      />
    )}
  </>
  );
}