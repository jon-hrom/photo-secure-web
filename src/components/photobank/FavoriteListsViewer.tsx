import { useCallback, useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';

const FAVORITES_URL = 'https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723';

interface FavoriteList {
  id: number;
  name: string;
  note: string | null;
  created_at: string | null;
  client_id: number | null;
  client_name: string | null;
  client_phone: string | null;
  photo_count: number;
}

interface FavoriteListsViewerProps {
  parentFolderId: number;
  userId: number;
}

export default function FavoriteListsViewer({ parentFolderId, userId }: FavoriteListsViewerProps) {
  const [lists, setLists] = useState<FavoriteList[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [photoIdsMap, setPhotoIdsMap] = useState<Record<number, number[]>>({});
  const [photosLoading, setPhotosLoading] = useState<Record<number, boolean>>({});

  const fetchLists = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(
        `${FAVORITES_URL}?action=photographer_lists&parent_folder_id=${parentFolderId}`,
        { headers: { 'X-User-Id': userId.toString() } }
      );
      if (!res.ok) {
        setLists([]);
        return;
      }
      const data = await res.json();
      setLists(data.lists || []);
    } catch {
      setLists([]);
    } finally {
      setLoading(false);
    }
  }, [parentFolderId, userId]);

  useEffect(() => {
    fetchLists();
  }, [fetchLists]);

  const toggleExpand = async (listId: number) => {
    if (expandedId === listId) {
      setExpandedId(null);
      return;
    }
    setExpandedId(listId);
    if (photoIdsMap[listId]) return;
    setPhotosLoading((p) => ({ ...p, [listId]: true }));
    try {
      const res = await fetch(`${FAVORITES_URL}?action=list_photos&list_id=${listId}`);
      const data = await res.json();
      setPhotoIdsMap((p) => ({ ...p, [listId]: data.photo_ids || [] }));
    } catch {
      setPhotoIdsMap((p) => ({ ...p, [listId]: [] }));
    } finally {
      setPhotosLoading((p) => ({ ...p, [listId]: false }));
    }
  };

  if (loading) return null;
  if (lists.length === 0) return null;

  return (
    <div className="space-y-3 mb-4">
      <div className="flex items-center gap-2 px-1">
        <Icon name="Star" size={18} className="text-yellow-500" />
        <h3 className="text-sm font-semibold text-foreground">Списки избранного клиентов</h3>
        <span className="text-xs text-muted-foreground">({lists.length})</span>
      </div>

      {lists.map((list) => {
        const isExpanded = expandedId === list.id;
        const photoIds = photoIdsMap[list.id] || [];
        return (
          <div
            key={list.id}
            className="rounded-xl border border-border bg-card/50 hover:bg-card transition-colors"
          >
            <button
              onClick={() => toggleExpand(list.id)}
              className="w-full flex items-start gap-3 p-3 sm:p-4 text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-yellow-500/10 flex items-center justify-center flex-shrink-0">
                <Icon name="Star" size={18} className="text-yellow-500" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium text-sm truncate">{list.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/15 text-yellow-700 dark:text-yellow-300 font-medium">
                    Список
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
                  {list.client_name && (
                    <span className="flex items-center gap-1">
                      <Icon name="User" size={12} />
                      {list.client_name}
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Icon name="Image" size={12} />
                    {list.photo_count} фото
                  </span>
                  {list.created_at && (
                    <span>{new Date(list.created_at).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  )}
                </div>
                {list.note && (
                  <div className="mt-2 text-xs text-foreground/80 bg-yellow-500/5 rounded-md px-2 py-1.5 border-l-2 border-yellow-500/60 whitespace-pre-wrap">
                    {list.note}
                  </div>
                )}
              </div>
              <Icon
                name="ChevronDown"
                size={18}
                className={`flex-shrink-0 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`}
              />
            </button>

            {isExpanded && (
              <div className="px-3 sm:px-4 pb-3 sm:pb-4 border-t border-border pt-3">
                {photosLoading[list.id] ? (
                  <div className="flex items-center justify-center py-4">
                    <Icon name="Loader2" size={18} className="animate-spin text-muted-foreground" />
                  </div>
                ) : photoIds.length === 0 ? (
                  <div className="text-xs text-muted-foreground py-2">Клиент ещё не добавил фото в список</div>
                ) : (
                  <div className="text-xs text-muted-foreground">
                    В списке {photoIds.length} фото. ID: {photoIds.slice(0, 20).join(', ')}{photoIds.length > 20 ? '…' : ''}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
