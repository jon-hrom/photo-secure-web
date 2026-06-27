import { useEffect, useCallback, useRef, useState } from 'react';

interface ClientData {
  name: string;
  phone: string;
  email: string;
  address: string;
  vkProfile: string;
  vkUsername?: string;
  birthdate?: string;
  timestamp?: number;
}

interface ProjectData {
  name: string;
  budget: string;
  description: string;
  startDate: string;
  shootingStyleId: string;
  shooting_time: string;
  shooting_duration: number;
  shooting_address: string;
  hourly_rate?: string;
  photobook_count?: string;
  photobook_price?: string;
  photo_items?: { format: string; qty: string; price: string }[];
  timestamp?: number;
}

interface OpenCardData {
  clientId: number;
  clientName: string;
  timestamp: number;
}

const STORAGE_TIMEOUT = 24 * 60 * 60 * 1000;
const DRAFTS_API = 'https://functions.poehali.dev/2834d022-fea5-4fbb-9582-ed0dec4c047d?action=drafts';

type DraftType = 'client' | 'project' | 'open_card';

interface DraftRow {
  draft_type: DraftType;
  client_id: number | null;
  payload: Record<string, unknown>;
  updated_at: string;
}

interface DraftsCache {
  client: Record<string, ClientData & { timestamp: number }>;
  project: Record<string, ProjectData & { timestamp: number }>;
  open_card: Record<string, OpenCardData>;
}

const emptyCache = (): DraftsCache => ({ client: {}, project: {}, open_card: {} });

export const useUnsavedClientData = (userId: string | null) => {
  const [cache, setCache] = useState<DraftsCache>(emptyCache());
  const cacheRef = useRef<DraftsCache>(emptyCache());
  const saveTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  cacheRef.current = cache;

  const apiRequest = useCallback(async (method: string, body?: Record<string, unknown>) => {
    if (!userId) return null;
    try {
      const res = await fetch(DRAFTS_API, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!res.ok) return null;
      return await res.json();
    } catch (e) {
      console.error('[useUnsavedClientData] API error', e);
      return null;
    }
  }, [userId]);

  const reloadDrafts = useCallback(async () => {
    if (!userId) return;
    const data = await apiRequest('GET');
    if (!Array.isArray(data)) return;
    const next = emptyCache();
    for (const row of data as DraftRow[]) {
      const ts = new Date(row.updated_at).getTime() || Date.now();
      if (Date.now() - ts > STORAGE_TIMEOUT) continue;
      if (row.draft_type === 'client') {
        next.client['0'] = { ...(row.payload || {}), timestamp: ts };
      } else if (row.draft_type === 'project' && row.client_id) {
        next.project[String(row.client_id)] = { ...(row.payload || {}), timestamp: ts };
      } else if (row.draft_type === 'open_card' && row.client_id) {
        next.open_card[String(row.client_id)] = { ...(row.payload || {}), timestamp: ts } as OpenCardData;
      }
    }
    setCache(next);
  }, [userId, apiRequest]);

  useEffect(() => {
    if (userId) {
      reloadDrafts();
    } else {
      setCache(emptyCache());
    }
  }, [userId, reloadDrafts]);

  // Перезагрузка при возврате во вкладку
  useEffect(() => {
    if (!userId) return;
    const onFocus = () => reloadDrafts();
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [userId, reloadDrafts]);

  const debouncedSave = useCallback((key: string, fn: () => Promise<unknown>) => {
    if (saveTimers.current[key]) {
      clearTimeout(saveTimers.current[key]);
    }
    saveTimers.current[key] = setTimeout(() => {
      fn();
    }, 600);
  }, []);

  // ===== CLIENT DRAFT =====
  const saveClientData = useCallback((data: ClientData) => {
    if (!userId) return;
    const hasData = data.name || data.phone || data.email || data.address || data.vkProfile;
    if (hasData) {
      const ts = Date.now();
      setCache(prev => ({ ...prev, client: { '0': { ...data, timestamp: ts } } }));
      debouncedSave('client_0', () =>
        apiRequest('POST', { draft_type: 'client', client_id: 0, payload: data })
      );
    } else {
      setCache(prev => ({ ...prev, client: {} }));
      debouncedSave('client_0', () =>
        apiRequest('DELETE', { draft_type: 'client', client_id: 0 })
      );
    }
  }, [userId, apiRequest, debouncedSave]);

  const loadClientData = useCallback((): ClientData | null => {
    if (!userId) return null;
    const d = cacheRef.current.client['0'];
    if (!d) return null;
    if (d.timestamp && Date.now() - d.timestamp > STORAGE_TIMEOUT) return null;
    return d;
    // cache в зависимостях, чтобы потребители реагировали на изменения
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, cache]);

  const clearClientData = useCallback(() => {
    if (!userId) return;
    if (saveTimers.current['client_0']) {
      clearTimeout(saveTimers.current['client_0']);
      delete saveTimers.current['client_0'];
    }
    setCache(prev => ({ ...prev, client: {} }));
    apiRequest('DELETE', { draft_type: 'client', client_id: 0 });
  }, [userId, apiRequest]);

  // ===== PROJECT DRAFT =====
  const saveProjectData = useCallback((clientId: number, data: ProjectData) => {
    if (!userId) return;
    const hasData = data.name || data.budget || data.description;
    if (!hasData) return;
    const ts = Date.now();
    setCache(prev => ({
      ...prev,
      project: { ...prev.project, [String(clientId)]: { ...data, timestamp: ts } },
    }));
    debouncedSave(`project_${clientId}`, () =>
      apiRequest('POST', { draft_type: 'project', client_id: clientId, payload: data })
    );
  }, [userId, apiRequest, debouncedSave]);

  const loadProjectData = useCallback((clientId: number): ProjectData | null => {
    if (!userId) return null;
    const d = cacheRef.current.project[String(clientId)];
    if (!d) return null;
    if (d.timestamp && Date.now() - d.timestamp > STORAGE_TIMEOUT) return null;
    return d;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, cache]);

  const clearProjectData = useCallback((clientId: number) => {
    if (!userId) return;
    const key = `project_${clientId}`;
    if (saveTimers.current[key]) {
      clearTimeout(saveTimers.current[key]);
      delete saveTimers.current[key];
    }
    setCache(prev => {
      const nextProject = { ...prev.project };
      delete nextProject[String(clientId)];
      return { ...prev, project: nextProject };
    });
    apiRequest('DELETE', { draft_type: 'project', client_id: clientId });
  }, [userId, apiRequest]);

  const hasAnyUnsavedProject = useCallback((): { hasUnsaved: boolean; clientId: number | null } => {
    if (!userId) return { hasUnsaved: false, clientId: null };
    const entries = Object.entries(cacheRef.current.project);
    for (const [cid, data] of entries) {
      if (data.timestamp && Date.now() - data.timestamp > STORAGE_TIMEOUT) continue;
      if (data.name || data.budget || data.description) {
        return { hasUnsaved: true, clientId: parseInt(cid, 10) };
      }
    }
    return { hasUnsaved: false, clientId: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, cache]);

  // ===== OPEN CARD =====
  const saveOpenCardData = useCallback((clientId: number, clientName: string) => {
    if (!userId) return;
    const payload: OpenCardData = { clientId, clientName, timestamp: Date.now() };
    setCache(prev => ({
      ...prev,
      open_card: { ...prev.open_card, [String(clientId)]: payload },
    }));
    debouncedSave(`open_${clientId}`, () =>
      apiRequest('POST', { draft_type: 'open_card', client_id: clientId, payload })
    );
  }, [userId, apiRequest, debouncedSave]);

  const clearOpenCardData = useCallback((clientId: number) => {
    if (!userId) return;
    const key = `open_${clientId}`;
    if (saveTimers.current[key]) {
      clearTimeout(saveTimers.current[key]);
      delete saveTimers.current[key];
    }
    setCache(prev => {
      const next = { ...prev.open_card };
      delete next[String(clientId)];
      return { ...prev, open_card: next };
    });
    apiRequest('DELETE', { draft_type: 'open_card', client_id: clientId });
  }, [userId, apiRequest]);

  const hasAnyOpenCard = useCallback((): { hasOpen: boolean; clientId: number | null; clientName: string | null } => {
    if (!userId) return { hasOpen: false, clientId: null, clientName: null };
    const entries = Object.values(cacheRef.current.open_card);
    for (const data of entries) {
      if (data.timestamp && Date.now() - data.timestamp > STORAGE_TIMEOUT) continue;
      return { hasOpen: true, clientId: data.clientId, clientName: data.clientName };
    }
    return { hasOpen: false, clientId: null, clientName: null };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, cache]);

  return {
    saveClientData,
    loadClientData,
    clearClientData,
    saveProjectData,
    loadProjectData,
    clearProjectData,
    hasAnyUnsavedProject,
    saveOpenCardData,
    clearOpenCardData,
    hasAnyOpenCard,
    reloadDrafts,
  };
};