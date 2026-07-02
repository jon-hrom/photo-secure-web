import React, { useEffect, useState } from 'react';

const FAVORITES_URL = 'https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723';

interface FavoriteListItem {
  id: number;
  name: string;
  note: string | null;
  photo_count: number;
  created_at: string | null;
}

interface UseFavoriteListsArgs {
  code: string | undefined;
  clientId: number | undefined;
  setIsLoginModalOpen: (open: boolean) => void;
}

export function useFavoriteLists({ code, clientId, setIsLoginModalOpen }: UseFavoriteListsArgs) {
  const [isCreateListOpen, setIsCreateListOpen] = useState(false);
  const [activeFavoriteList, setActiveFavoriteList] = useState<{ id: number; name: string } | null>(null);
  const [favoriteLists, setFavoriteLists] = useState<FavoriteListItem[]>([]);
  const [viewingList, setViewingList] = useState<{ id: number; name: string } | null>(null);

  const loadFavoriteLists = React.useCallback(async () => {
    if (!code || !clientId) {
      setFavoriteLists([]);
      return;
    }
    try {
      const resp = await fetch(`${FAVORITES_URL}?action=client_lists&gallery_code=${encodeURIComponent(code)}&client_id=${clientId}`);
      const data = await resp.json();
      if (resp.ok && Array.isArray(data.lists)) setFavoriteLists(data.lists);
    } catch (e) {
      console.error('load favorite lists error', e);
    }
  }, [code, clientId]);

  useEffect(() => { loadFavoriteLists(); }, [loadFavoriteLists]);

  const handleOpenCreateList = () => {
    if (!clientId) {
      setIsLoginModalOpen(true);
      return;
    }
    setIsCreateListOpen(true);
  };

  const handleListCreated = (list: { id: number; name: string }) => {
    setActiveFavoriteList({ id: list.id, name: list.name });
    loadFavoriteLists();
  };

  const handleSubmitListSelection = async (photoIds: number[]) => {
    if (!activeFavoriteList || !clientId || !code) return;
    try {
      await fetch(FAVORITES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'add_photos_to_list',
          list_id: activeFavoriteList.id,
          gallery_code: code,
          client_id: clientId,
          photo_ids: photoIds,
        }),
      });
    } catch (e) {
      console.error('add to list error', e);
    }
    const justAddedListId = activeFavoriteList.id;
    const justAddedListName = activeFavoriteList.name;
    setActiveFavoriteList(null);
    await loadFavoriteLists();
    setViewingList({ id: justAddedListId, name: justAddedListName });
  };

  const handleOpenList = (list: { id: number; name: string }) => {
    setViewingList(list);
  };

  return {
    isCreateListOpen,
    setIsCreateListOpen,
    activeFavoriteList,
    setActiveFavoriteList,
    favoriteLists,
    viewingList,
    setViewingList,
    loadFavoriteLists,
    handleOpenCreateList,
    handleListCreated,
    handleSubmitListSelection,
    handleOpenList,
  };
}
