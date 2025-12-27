import { useEffect, useCallback } from 'react';

interface ClientData {
  name: string;
  phone: string;
  email: string;
  address: string;
  vkProfile: string;
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
}

const STORAGE_KEY = 'unsaved_client_data';
const STORAGE_TIMEOUT = 24 * 60 * 60 * 1000;

export const useUnsavedClientData = (userId: string | null) => {
  const getStorageKey = useCallback(() => {
    return `${STORAGE_KEY}_${userId || 'anonymous'}`;
  }, [userId]);

  const saveClientData = useCallback((data: ClientData) => {
    if (!userId) return;
    
    const hasData = data.name || data.phone || data.email || data.address || data.vkProfile;
    
    if (hasData) {
      const dataWithTimestamp = {
        ...data,
        timestamp: Date.now()
      };
      localStorage.setItem(getStorageKey(), JSON.stringify(dataWithTimestamp));
    } else {
      localStorage.removeItem(getStorageKey());
    }
  }, [userId, getStorageKey]);

  const loadClientData = useCallback((): ClientData | null => {
    if (!userId) return null;
    
    try {
      const stored = localStorage.getItem(getStorageKey());
      if (!stored) return null;

      const data = JSON.parse(stored) as ClientData & { timestamp: number };
      
      if (data.timestamp && (Date.now() - data.timestamp > STORAGE_TIMEOUT)) {
        localStorage.removeItem(getStorageKey());
        return null;
      }

      return data;
    } catch (error) {
      console.error('[useUnsavedClientData] Error loading data:', error);
      return null;
    }
  }, [userId, getStorageKey]);

  const clearClientData = useCallback(() => {
    if (!userId) return;
    localStorage.removeItem(getStorageKey());
  }, [userId, getStorageKey]);

  const saveProjectData = useCallback((clientId: number, data: ProjectData) => {
    if (!userId) return;
    
    const hasData = data.name || data.budget || data.description;
    
    if (hasData) {
      const projectKey = `unsaved_project_${userId}_${clientId}`;
      const dataWithTimestamp = {
        ...data,
        timestamp: Date.now()
      };
      localStorage.setItem(projectKey, JSON.stringify(dataWithTimestamp));
    }
  }, [userId]);

  const loadProjectData = useCallback((clientId: number): ProjectData | null => {
    if (!userId) return null;
    
    try {
      const projectKey = `unsaved_project_${userId}_${clientId}`;
      const stored = localStorage.getItem(projectKey);
      if (!stored) return null;

      const data = JSON.parse(stored) as ProjectData & { timestamp: number };
      
      if (data.timestamp && (Date.now() - data.timestamp > STORAGE_TIMEOUT)) {
        localStorage.removeItem(projectKey);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[useUnsavedClientData] Error loading project data:', error);
      return null;
    }
  }, [userId]);

  const clearProjectData = useCallback((clientId: number) => {
    if (!userId) return;
    const projectKey = `unsaved_project_${userId}_${clientId}`;
    localStorage.removeItem(projectKey);
  }, [userId]);

  const hasAnyUnsavedProject = useCallback((): { hasUnsaved: boolean; clientId: number | null } => {
    if (!userId) return { hasUnsaved: false, clientId: null };
    
    try {
      const prefix = `unsaved_project_${userId}_`;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const stored = localStorage.getItem(key);
          if (stored) {
            const data = JSON.parse(stored) as ProjectData & { timestamp: number };
            
            if (data.timestamp && (Date.now() - data.timestamp > STORAGE_TIMEOUT)) {
              localStorage.removeItem(key);
              continue;
            }
            
            if (data.name || data.budget || data.description) {
              const clientId = parseInt(key.replace(prefix, ''));
              return { hasUnsaved: true, clientId };
            }
          }
        }
      }
      return { hasUnsaved: false, clientId: null };
    } catch (error) {
      console.error('[useUnsavedClientData] Error checking for unsaved projects:', error);
      return { hasUnsaved: false, clientId: null };
    }
  }, [userId]);

  return {
    saveClientData,
    loadClientData,
    clearClientData,
    saveProjectData,
    loadProjectData,
    clearProjectData,
    hasAnyUnsavedProject,
  };
};