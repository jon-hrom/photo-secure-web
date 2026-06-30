import { useState, useEffect, useCallback } from 'react';
import Icon from '@/components/ui/icon';
import GalleryPhotoViewer from '@/components/gallery/GalleryPhotoViewer';
import type { Photo } from '@/pages/gallery/GalleryGrid';

const FAVORITES_URL = 'https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723';

interface FavoriteListViewProps {
  listId: number;
  listName: string;
  shortCode: string;
  clientId: number;
  galleryPhotos: Photo[];
  onBack: () => void;
  onAddMore: () => void;
  onListDeleted: () => void;
  onListRenamed: (newName: string) => void;
  bgStyles?: React.CSSProperties;
  isDarkBg?: boolean;
  textColor?: string;
  downloadPhoto?: (photo: Photo) => void;
  downloadDisabled?: boolean;
  coverSelectEnabled?: boolean;
  vignetteSelectEnabled?: boolean;
}

export default function FavoriteListView({
  listId,
  listName,
  shortCode,
  clientId,
  galleryPhotos,
  onBack,
  onAddMore,
  onListDeleted,
  onListRenamed,
  bgStyles = {},
  isDarkBg = false,
  textColor = '#111827',
  downloadPhoto,
  downloadDisabled = false,
  coverSelectEnabled = false,
  vignetteSelectEnabled = false,
}: FavoriteListViewProps) {
  const [photoIds, setPhotoIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewerPhotoId, setViewerPhotoId] = useState<number | null>(null);
  const [removing, setRemoving] = useState<Set<number>>(new Set());
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(listName);
  const [savingName, setSavingName] = useState(false);
  const [coverPhotoId, setCoverPhotoId] = useState<number | null>(null);
  const [vignettePhotoId, setVignettePhotoId] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState<'cover' | 'vignette' | null>(null);
  const [pendingSelection, setPendingSelection] = useState<number | null>(null);
  const [savingMarker, setSavingMarker] = useState(false);

  const loadPhotos = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${FAVORITES_URL}?action=list_photos&list_id=${listId}`);
      const data = await resp.json();
      if (resp.ok && Array.isArray(data.photo_ids)) {
        setPhotoIds(data.photo_ids);
        setCoverPhotoId(data.cover_photo_id ?? null);
        setVignettePhotoId(data.vignette_photo_id ?? null);
      }
    } catch (e) {
      console.error('load list photos error', e);
    } finally {
      setLoading(false);
    }
  }, [listId]);

  const startSelection = (type: 'cover' | 'vignette') => {
    setSelectionMode(type);
    setPendingSelection(type === 'cover' ? coverPhotoId : vignettePhotoId);
    setMenuOpen(false);
  };

  const cancelSelection = () => {
    setSelectionMode(null);
    setPendingSelection(null);
  };

  const confirmSelection = async () => {
    if (!selectionMode) return;
    setSavingMarker(true);
    try {
      const resp = await fetch(FAVORITES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'set_list_marker',
          list_id: listId,
          gallery_code: shortCode,
          client_id: clientId,
          marker_type: selectionMode,
          photo_id: pendingSelection,
        }),
      });
      if (resp.ok) {
        if (selectionMode === 'cover') setCoverPhotoId(pendingSelection);
        else setVignettePhotoId(pendingSelection);
        setSelectionMode(null);
        setPendingSelection(null);
      }
    } catch (e) {
      console.error('set marker error', e);
    } finally {
      setSavingMarker(false);
    }
  };

  useEffect(() => { loadPhotos(); }, [loadPhotos]);

  const photos = photoIds
    .map(id => galleryPhotos.find(p => p.id === id))
    .filter((p): p is Photo => !!p);

  const secondaryText = isDarkBg ? 'rgba(255,255,255,0.55)' : 'rgba(107,114,128,1)';

  const handleRemovePhoto = async (photoId: number) => {
    if (removing.has(photoId)) return;
    setRemoving(prev => new Set(prev).add(photoId));
    try {
      const resp = await fetch(FAVORITES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_photo_from_list',
          list_id: listId,
          gallery_code: shortCode,
          client_id: clientId,
          photo_id: photoId,
        }),
      });
      if (resp.ok) {
        setPhotoIds(prev => prev.filter(id => id !== photoId));
      }
    } catch (e) {
      console.error('remove photo error', e);
    } finally {
      setRemoving(prev => {
        const next = new Set(prev);
        next.delete(photoId);
        return next;
      });
    }
  };

  const handleDeleteList = async () => {
    if (!confirm(`Удалить список «${listName}»?`)) return;
    try {
      const resp = await fetch(FAVORITES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_list',
          list_id: listId,
          gallery_code: shortCode,
          client_id: clientId,
        }),
      });
      if (resp.ok) onListDeleted();
    } catch (e) {
      console.error('delete list error', e);
    }
  };

  const handleRename = async () => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === listName) {
      setRenaming(false);
      setNewName(listName);
      return;
    }
    setSavingName(true);
    try {
      const resp = await fetch(FAVORITES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'rename_list',
          list_id: listId,
          gallery_code: shortCode,
          client_id: clientId,
          name: trimmed,
        }),
      });
      if (resp.ok) {
        onListRenamed(trimmed);
        setRenaming(false);
      }
    } catch (e) {
      console.error('rename error', e);
    } finally {
      setSavingName(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ ...bgStyles, paddingTop: 'env(safe-area-inset-top, 0px)' }}>
      <div
        className="sticky top-0 z-30 flex items-center gap-2 px-3 py-3"
        style={{ background: isDarkBg ? 'rgba(0,0,0,0.7)' : 'rgba(249,250,251,0.9)', backdropFilter: 'blur(10px)' }}
      >
        <button
          onClick={onBack}
          className="flex items-center justify-center w-9 h-9 rounded-full transition-colors flex-shrink-0"
          style={{ background: isDarkBg ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}
        >
          <Icon name="ArrowLeft" size={18} style={{ color: textColor }} />
        </button>
        <div className="flex-1 min-w-0">
          {renaming ? (
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleRename(); if (e.key === 'Escape') { setRenaming(false); setNewName(listName); } }}
                autoFocus
                maxLength={255}
                className="flex-1 px-2 py-1 rounded text-sm outline-none"
                style={{
                  background: isDarkBg ? 'rgba(255,255,255,0.1)' : '#ffffff',
                  color: textColor,
                  border: `1px solid ${isDarkBg ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)'}`,
                }}
              />
              <button
                onClick={handleRename}
                disabled={savingName}
                className="px-3 py-1 rounded text-xs font-medium bg-purple-500 text-white active:bg-purple-700"
              >
                {savingName ? '...' : 'OK'}
              </button>
              <button
                onClick={() => { setRenaming(false); setNewName(listName); }}
                className="px-2 py-1 rounded text-xs"
                style={{ color: secondaryText }}
              >
                Отмена
              </button>
            </div>
          ) : (
            <>
              <h2 className="font-semibold text-base leading-tight flex items-center gap-1.5 truncate" style={{ color: textColor }}>
                <Icon name="Star" size={16} className="text-yellow-500 flex-shrink-0" />
                <span className="truncate">{listName}</span>
              </h2>
              {!loading && (
                <p className="text-xs" style={{ color: secondaryText }}>
                  {photos.length} {photos.length === 1 ? 'фото' : 'фото'}
                </p>
              )}
            </>
          )}
        </div>
        {!renaming && (
          <>
            <button
              onClick={onAddMore}
              className="flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-medium bg-purple-500 text-white active:bg-purple-700 flex-shrink-0"
            >
              <Icon name="Plus" size={14} />
              <span className="hidden sm:inline">Добавить</span>
            </button>
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="flex items-center justify-center w-9 h-9 rounded-full"
                style={{ background: isDarkBg ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }}
              >
                <Icon name="MoreVertical" size={16} style={{ color: textColor }} />
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
                  <div
                    className="absolute right-0 mt-2 rounded-lg shadow-xl overflow-hidden z-50"
                    style={{
                      minWidth: 200,
                      background: isDarkBg ? '#1f1f3a' : '#ffffff',
                      border: isDarkBg ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.08)',
                    }}
                  >
                    <button
                      onClick={() => { setMenuOpen(false); setRenaming(true); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-black/5"
                      style={{ color: textColor }}
                    >
                      <Icon name="Pencil" size={14} />
                      <span>Переименовать</span>
                    </button>
                    <button
                      onClick={() => { setMenuOpen(false); handleDeleteList(); }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 text-sm hover:bg-red-500/10 text-red-500"
                    >
                      <Icon name="Trash2" size={14} />
                      <span>Удалить список</span>
                    </button>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>

      {!loading && photos.length > 0 && !selectionMode && (coverSelectEnabled || vignetteSelectEnabled) && (
        <div className="flex items-center gap-2 px-3 pt-3">
          {coverSelectEnabled && (
            <button
              onClick={() => startSelection('cover')}
              className="flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-medium flex-1 justify-center transition-colors"
              style={{
                background: coverPhotoId ? '#8b5cf6' : (isDarkBg ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'),
                color: coverPhotoId ? '#ffffff' : textColor,
              }}
            >
              <Icon name="Image" size={15} />
              <span>Обложка{coverPhotoId ? ' ✓' : ''}</span>
            </button>
          )}
          {vignetteSelectEnabled && (
            <button
              onClick={() => startSelection('vignette')}
              className="flex items-center gap-1.5 px-3 h-9 rounded-full text-xs font-medium flex-1 justify-center transition-colors"
              style={{
                background: vignettePhotoId ? '#8b5cf6' : (isDarkBg ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)'),
                color: vignettePhotoId ? '#ffffff' : textColor,
              }}
            >
              <Icon name="Sparkles" size={15} />
              <span>Виньетка{vignettePhotoId ? ' ✓' : ''}</span>
            </button>
          )}
        </div>
      )}

      {selectionMode && (
        <div
          className="sticky z-20 flex items-center gap-2 px-3 py-2.5"
          style={{
            top: 'calc(env(safe-area-inset-top, 0px) + 60px)',
            background: isDarkBg ? 'rgba(20,20,40,0.95)' : 'rgba(243,244,246,0.97)',
            backdropFilter: 'blur(10px)',
          }}
        >
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate" style={{ color: textColor }}>
              {selectionMode === 'cover' ? 'Выберите фото для обложки' : 'Выберите фото для виньетки'}
            </p>
            <p className="text-xs" style={{ color: secondaryText }}>
              {pendingSelection ? 'Фото выбрано' : 'Нажмите на фото'}
            </p>
          </div>
          <button
            onClick={cancelSelection}
            className="px-3 h-9 rounded-full text-xs font-medium flex-shrink-0"
            style={{ background: isDarkBg ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)', color: textColor }}
          >
            Отмена
          </button>
          <button
            onClick={confirmSelection}
            disabled={savingMarker}
            className="flex items-center gap-1.5 px-4 h-9 rounded-full text-xs font-medium bg-purple-500 text-white active:bg-purple-700 flex-shrink-0 disabled:opacity-60"
          >
            {savingMarker ? <Icon name="Loader2" size={14} className="animate-spin" /> : <Icon name="Check" size={14} />}
            <span>Подтвердить</span>
          </button>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-24">
          <Icon name="Loader2" size={32} className="animate-spin" style={{ color: textColor, opacity: 0.5 }} />
        </div>
      )}

      {!loading && photos.length === 0 && (
        <div className="flex flex-col items-center justify-center py-32 gap-3 px-6 text-center">
          <Icon name="Star" size={40} style={{ color: textColor, opacity: 0.3 }} />
          <p className="text-sm" style={{ color: secondaryText }}>В списке пока нет фото</p>
          <button
            onClick={onAddMore}
            className="mt-2 flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium bg-purple-500 text-white active:bg-purple-700"
          >
            <Icon name="Plus" size={16} />
            Добавить фото
          </button>
        </div>
      )}

      {!loading && photos.length > 0 && (
        <div
          className="columns-2 sm:columns-3 md:columns-4 px-2 pt-4 pb-8"
          style={{ columnGap: '8px' }}
        >
          {photos.map((photo) => {
            const isPending = selectionMode && pendingSelection === photo.id;
            const isCover = coverPhotoId === photo.id;
            const isVignette = vignettePhotoId === photo.id;
            return (
            <div
              key={photo.id}
              className="relative group rounded-lg overflow-hidden cursor-pointer break-inside-avoid touch-manipulation"
              style={{
                marginBottom: '8px',
                background: isDarkBg ? 'rgba(255,255,255,0.06)' : '#f3f4f6',
                outline: isPending ? '3px solid #8b5cf6' : 'none',
                outlineOffset: isPending ? '-3px' : '0',
              }}
              onClick={() => {
                if (selectionMode) {
                  setPendingSelection(prev => prev === photo.id ? null : photo.id);
                } else {
                  setViewerPhotoId(photo.id);
                }
              }}
            >
              <img
                src={photo.thumbnail_url || photo.photo_url}
                alt={photo.file_name}
                className="w-full h-auto"
                loading="lazy"
              />
              {selectionMode && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/20">
                  {isPending && (
                    <div className="flex items-center justify-center rounded-full bg-purple-500" style={{ width: 36, height: 36 }}>
                      <Icon name="Check" size={20} className="text-white" />
                    </div>
                  )}
                </div>
              )}
              {!selectionMode && (isCover || isVignette) && (
                <div className="absolute top-1.5 left-1.5 flex flex-col gap-1">
                  {isCover && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500 text-white text-[10px] font-medium">
                      <Icon name="Image" size={10} /> Обложка
                    </span>
                  )}
                  {isVignette && (
                    <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500 text-white text-[10px] font-medium">
                      <Icon name="Sparkles" size={10} /> Виньетка
                    </span>
                  )}
                </div>
              )}
              {!selectionMode && (
                <div className="absolute top-1.5 right-1.5 flex flex-col gap-1.5">
                  <button
                    onClick={(e) => { e.stopPropagation(); handleRemovePhoto(photo.id); }}
                    disabled={removing.has(photo.id)}
                    className="flex items-center justify-center rounded-full bg-black/60 backdrop-blur-sm hover:bg-red-500 transition-colors touch-manipulation"
                    style={{ width: 28, height: 28 }}
                    title="Убрать из списка"
                  >
                    {removing.has(photo.id)
                      ? <Icon name="Loader2" size={13} className="text-white animate-spin" />
                      : <Icon name="X" size={14} className="text-white" />
                    }
                  </button>
                </div>
              )}
              {!selectionMode && !downloadDisabled && downloadPhoto && (
                <button
                  onClick={(e) => { e.stopPropagation(); downloadPhoto(photo); }}
                  className="absolute bottom-1.5 right-1.5 flex items-center justify-center rounded-full bg-black/50 backdrop-blur-sm hover:bg-blue-500 transition-colors touch-manipulation"
                  style={{ width: 22, height: 22 }}
                  title="Скачать"
                >
                  <Icon name="Download" size={11} className="text-white" />
                </button>
              )}
            </div>
            );
          })}
        </div>
      )}

      {viewerPhotoId !== null && (
        <GalleryPhotoViewer
          photos={photos}
          initialPhotoId={viewerPhotoId}
          onClose={() => setViewerPhotoId(null)}
          onDownload={downloadPhoto ? (photo) => downloadPhoto(photo as Photo) : undefined}
          downloadDisabled={downloadDisabled}
        />
      )}
    </div>
  );
}