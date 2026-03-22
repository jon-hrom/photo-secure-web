import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import type { S3File } from './types';
import { API_URL, formatBytes, isPreviewable, isRawFile, isVideoFile } from './types';

interface S3FileViewerProps {
  file: S3File;
  files: S3File[];
  realUserId: string;
  onClose: () => void;
}

const S3FileViewer = ({ file, files, realUserId, onClose }: S3FileViewerProps) => {
  const [currentFile, setCurrentFile] = useState<S3File>(file);
  const [viewUrl, setViewUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const loadPresignedUrl = useCallback(async (f: S3File) => {
    setViewUrl('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}?action=s3_presign&user_id=${realUserId}&key=${encodeURIComponent(f.key)}`);
      const data = await res.json();
      if (data.url) setViewUrl(data.url);
      else toast.error('Не удалось получить ссылку');
    } catch {
      toast.error('Ошибка сети');
    } finally {
      setLoading(false);
    }
  }, [realUserId]);

  useEffect(() => {
    loadPresignedUrl(currentFile);
  }, [currentFile, loadPresignedUrl]);

  const navigateFile = useCallback((direction: 'prev' | 'next') => {
    const idx = files.findIndex(f => f.key === currentFile.key);
    const newIdx = direction === 'prev' ? idx - 1 : idx + 1;
    if (newIdx >= 0 && newIdx < files.length) {
      setCurrentFile(files[newIdx]);
    }
  }, [currentFile, files]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowLeft') navigateFile('prev');
      else if (e.key === 'ArrowRight') navigateFile('next');
    };
    window.addEventListener('keydown', handleKey, true);
    return () => window.removeEventListener('keydown', handleKey, true);
  }, [onClose, navigateFile]);

  const currentIdx = files.findIndex(f => f.key === currentFile.key);

  return createPortal(
    <div className="fixed inset-0 z-[9999] bg-black/95 flex flex-col" style={{ pointerEvents: 'auto' }} onClick={onClose}>
      <div className="flex items-center justify-between px-3 sm:px-4 py-2 bg-black/50 shrink-0" onClick={e => e.stopPropagation()}>
        <div className="min-w-0 flex-1">
          <p className="text-white text-sm font-medium truncate">{currentFile.name}</p>
          <p className="text-white/60 text-xs">
            {formatBytes(currentFile.size)}
            {isRawFile(currentFile.name) && <span className="ml-2 bg-orange-500 text-white px-1.5 py-0.5 rounded text-[10px]">RAW</span>}
            {isVideoFile(currentFile.name) && <span className="ml-2 bg-blue-500 text-white px-1.5 py-0.5 rounded text-[10px]">VIDEO</span>}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0 ml-2">
          {viewUrl && (
            <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="text-white/70 hover:text-white p-2 transition-colors" title="Открыть в новой вкладке">
              <Icon name="ExternalLink" size={18} />
            </a>
          )}
          {viewUrl && (
            <a href={viewUrl} download={currentFile.name} className="text-white/70 hover:text-white p-2 transition-colors" title="Скачать">
              <Icon name="Download" size={18} />
            </a>
          )}
          <button className="text-white/70 hover:text-white p-2 transition-colors" onClick={onClose}>
            <Icon name="X" size={20} />
          </button>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center relative min-h-0 px-2" onClick={e => e.stopPropagation()}>
        {currentIdx > 0 && (
          <button className="absolute left-2 sm:left-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors" onClick={() => navigateFile('prev')}>
            <Icon name="ChevronLeft" size={24} />
          </button>
        )}
        {currentIdx < files.length - 1 && (
          <button className="absolute right-2 sm:right-4 z-10 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors" onClick={() => navigateFile('next')}>
            <Icon name="ChevronRight" size={24} />
          </button>
        )}

        {loading ? (
          <Icon name="Loader2" size={40} className="animate-spin text-white/50" />
        ) : !viewUrl ? (
          <p className="text-white/50 text-sm">Не удалось загрузить</p>
        ) : isPreviewable(currentFile.name) ? (
          <img src={viewUrl} alt={currentFile.name} className="max-w-full max-h-full object-contain rounded" />
        ) : isVideoFile(currentFile.name) ? (
          <video src={viewUrl} controls className="max-w-full max-h-full rounded" />
        ) : (
          <div className="text-center text-white/70">
            <Icon name="File" size={64} className="mx-auto mb-4 opacity-50" />
            <p className="text-lg font-medium mb-1">{currentFile.name}</p>
            <p className="text-sm text-white/50 mb-4">{formatBytes(currentFile.size)} • {isRawFile(currentFile.name) ? 'RAW файл' : 'Файл'}</p>
            <a href={viewUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-white/10 hover:bg-white/20 px-4 py-2 rounded-lg transition-colors">
              <Icon name="Download" size={16} />
              Скачать файл
            </a>
          </div>
        )}
      </div>

      <div className="flex items-center justify-center px-3 py-2 bg-black/50 shrink-0 text-white/40 text-xs" onClick={e => e.stopPropagation()}>
        {currentIdx + 1} / {files.length}
      </div>
    </div>,
    document.body
  );
};

export default S3FileViewer;