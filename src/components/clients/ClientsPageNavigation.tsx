import { useCallback, useEffect } from 'react';
import { Client } from '@/components/clients/ClientsTypes';
import { useNavigationHistory } from '@/hooks/useNavigationHistory';

interface ClientsPageNavigationProps {
  viewMode: 'list' | 'table';
  searchQuery: string;
  statusFilter: 'all' | 'active' | 'inactive';
  selectedClient: Client | null;
  clients: Client[];
  setViewMode: (mode: 'list' | 'table') => void;
  setSearchQuery: (query: string) => void;
  setStatusFilter: (filter: 'all' | 'active' | 'inactive') => void;
  setSelectedClient: (client: Client) => void;
}

interface NavigationHandlers {
  canGoBack: boolean;
  canGoForward: boolean;
  handleGoBack: () => void;
  handleGoForward: () => void;
}

export const useClientsPageNavigation = ({
  viewMode,
  searchQuery,
  statusFilter,
  selectedClient,
  clients,
  setViewMode,
  setSearchQuery,
  setStatusFilter,
  setSelectedClient,
}: ClientsPageNavigationProps): NavigationHandlers => {
  
  const navigation = useNavigationHistory();

  // Сохранение состояния при изменениях
  useEffect(() => {
    if (clients.length > 0) {
      navigation.pushState({
        viewMode,
        searchQuery,
        statusFilter,
        selectedClientId: selectedClient?.id,
      });
    }
  }, [viewMode, searchQuery, statusFilter, selectedClient?.id, clients.length, navigation]);

  // Обработчики навигации
  const handleGoBack = useCallback(() => {
    const prevState = navigation.goBack();
    if (prevState) {
      setViewMode(prevState.viewMode);
      setSearchQuery(prevState.searchQuery);
      setStatusFilter(prevState.statusFilter);
      if (prevState.selectedClientId) {
        const client = clients.find(c => c.id === prevState.selectedClientId);
        if (client) {
          setSelectedClient(client);
        }
      }
    }
  }, [navigation, setViewMode, setSearchQuery, setStatusFilter, setSelectedClient, clients]);

  const handleGoForward = useCallback(() => {
    const nextState = navigation.goForward();
    if (nextState) {
      setViewMode(nextState.viewMode);
      setSearchQuery(nextState.searchQuery);
      setStatusFilter(nextState.statusFilter);
      if (nextState.selectedClientId) {
        const client = clients.find(c => c.id === nextState.selectedClientId);
        if (client) {
          setSelectedClient(client);
        }
      }
    }
  }, [navigation, setViewMode, setSearchQuery, setStatusFilter, setSelectedClient, clients]);

  return {
    canGoBack: navigation.canGoBack,
    canGoForward: navigation.canGoForward,
    handleGoBack,
    handleGoForward,
  };
};
