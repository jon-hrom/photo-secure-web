import { useState, useEffect } from 'react';
import { Client, Booking } from '@/components/clients/ClientsTypes';
import { useUnsavedClientData } from '@/hooks/useUnsavedClientData';

export const useClientsDialogs = (userId?: string | null, clients?: Client[]) => {
  const { saveClientData, loadClientData, clearClientData, loadProjectData, clearProjectData, hasAnyUnsavedProject, saveOpenCardData, clearOpenCardData, hasAnyOpenCard } = useUnsavedClientData(userId);
  
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isUnsavedDataDialogOpen, setIsUnsavedDataDialogOpen] = useState(false);
  const [isUnsavedProjectDialogOpen, setIsUnsavedProjectDialogOpen] = useState(false);
  const [unsavedProjectClientId, setUnsavedProjectClientId] = useState<number | null>(null);
  const [pendingClient, setPendingClient] = useState<Client | null>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isBookingDialogOpen, setIsBookingDialogOpen] = useState(false);
  const [isBookingDetailsOpen, setIsBookingDetailsOpen] = useState(false);
  const [isMessageDialogOpen, setIsMessageDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isExportDialogOpen, setIsExportDialogOpen] = useState(false);
  const [isCountdownOpen, setIsCountdownOpen] = useState(false);
  
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<Booking | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [messageTab, setMessageTab] = useState<'vk' | 'email'>('vk');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('active');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const [newClient, setNewClient] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    vkProfile: '',
  });

  useEffect(() => {
    if (userId) {
      const saved = loadClientData();
      if (saved) {
        setNewClient({
          name: saved.name || '',
          phone: saved.phone || '',
          email: saved.email || '',
          address: saved.address || '',
          vkProfile: saved.vkProfile || '',
        });
      }
    }
  }, [userId, loadClientData]);

  useEffect(() => {
    if (userId && (newClient.name || newClient.phone || newClient.email)) {
      saveClientData(newClient);
    }
  }, [newClient, userId, saveClientData]);

  const [newBooking, setNewBooking] = useState({
    time: '',
    title: '',
    description: '',
    notificationEnabled: true,
    notificationTime: 24,
  });

  const [vkMessage, setVkMessage] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');

  const timeSlots = [
    '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30',
    '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00',
  ];

  const openEditDialog = (client: Client) => {
    setEditingClient({ ...client });
    setIsEditDialogOpen(true);
  };

  const openBookingDialog = (client: Client) => {
    setSelectedClient(client);
    setIsBookingDialogOpen(true);
  };

  const openMessageDialog = (client: Client) => {
    setSelectedClient(client);
    setIsMessageDialogOpen(true);
  };

  const openDetailDialog = (client: Client) => {
    setSelectedClient(client);
    setIsDetailDialogOpen(true);
  };

  const handleOpenAddDialog = () => {
    const savedClient = loadClientData();
    const { hasUnsaved, clientId } = hasAnyUnsavedProject();
    
    if (savedClient && (savedClient.name || savedClient.phone || savedClient.email)) {
      setIsUnsavedDataDialogOpen(true);
    } else if (hasUnsaved && clientId) {
      setUnsavedProjectClientId(clientId);
      setIsUnsavedProjectDialogOpen(true);
    } else {
      setIsAddDialogOpen(true);
    }
  };

  const handleOpenClientWithProjectCheck = (client: Client) => {
    const saved = loadProjectData(client.id);
    if (saved && (saved.name || saved.budget || saved.description)) {
      setUnsavedProjectClientId(client.id);
      setPendingClient(client);
      setIsUnsavedProjectDialogOpen(true);
    } else {
      setSelectedClient(client);
      setIsDetailDialogOpen(true);
    }
  };

  const handleContinueWithSavedProject = () => {
    setIsUnsavedProjectDialogOpen(false);
    if (pendingClient) {
      setSelectedClient(pendingClient);
      setIsDetailDialogOpen(true);
      setUnsavedProjectClientId(null);
      setPendingClient(null);
    } else if (unsavedProjectClientId && clients) {
      const client = clients.find(c => c.id === unsavedProjectClientId);
      if (client) {
        setSelectedClient(client);
        setIsDetailDialogOpen(true);
      }
      setUnsavedProjectClientId(null);
    }
  };

  const handleClearSavedProject = () => {
    if (unsavedProjectClientId) {
      clearProjectData(unsavedProjectClientId);
    }
    setIsUnsavedProjectDialogOpen(false);
    if (pendingClient) {
      setSelectedClient(pendingClient);
      setIsDetailDialogOpen(true);
      setUnsavedProjectClientId(null);
      setPendingClient(null);
    } else if (unsavedProjectClientId && clients) {
      const client = clients.find(c => c.id === unsavedProjectClientId);
      if (client) {
        setSelectedClient(client);
        setIsDetailDialogOpen(true);
      }
      setUnsavedProjectClientId(null);
    }
  };

  const handleContinueWithSavedData = () => {
    setIsUnsavedDataDialogOpen(false);
    setIsAddDialogOpen(true);
  };

  const handleClearSavedData = () => {
    clearClientData();
    setNewClient({
      name: '',
      phone: '',
      email: '',
      address: '',
      vkProfile: '',
    });
    setIsUnsavedDataDialogOpen(false);
    setIsAddDialogOpen(true);
  };

  const handleClientCreated = () => {
    clearClientData();
    setNewClient({
      name: '',
      phone: '',
      email: '',
      address: '',
      vkProfile: '',
    });
  };

  const hasUnsavedClientData = () => {
    const saved = loadClientData();
    const { hasUnsaved } = hasAnyUnsavedProject();
    const { hasOpen } = hasAnyOpenCard();
    const result = (saved ? (saved.name || saved.phone || saved.email || false) : false) || hasUnsaved || hasOpen;
    return result;
  };

  const hasUnsavedProjectData = (clientId: number) => {
    const saved = loadProjectData(clientId);
    return saved ? (saved.name || saved.budget || saved.description || false) : false;
  };

  return {
    isAddDialogOpen,
    setIsAddDialogOpen,
    isUnsavedDataDialogOpen,
    setIsUnsavedDataDialogOpen,
    isUnsavedProjectDialogOpen,
    setIsUnsavedProjectDialogOpen,
    unsavedProjectClientId,
    isEditDialogOpen,
    setIsEditDialogOpen,
    isBookingDialogOpen,
    setIsBookingDialogOpen,
    isBookingDetailsOpen,
    setIsBookingDetailsOpen,
    isMessageDialogOpen,
    setIsMessageDialogOpen,
    isDetailDialogOpen,
    setIsDetailDialogOpen,
    selectedClient,
    setSelectedClient,
    editingClient,
    setEditingClient,
    selectedBooking,
    setSelectedBooking,
    selectedDate,
    setSelectedDate,
    messageTab,
    setMessageTab,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    viewMode,
    setViewMode,
    newClient,
    setNewClient,
    newBooking,
    setNewBooking,
    vkMessage,
    setVkMessage,
    emailSubject,
    setEmailSubject,
    emailBody,
    setEmailBody,
    timeSlots,
    openEditDialog,
    openBookingDialog,
    openMessageDialog,
    openDetailDialog,
    isExportDialogOpen,
    setIsExportDialogOpen,
    isCountdownOpen,
    setIsCountdownOpen,
    handleOpenAddDialog,
    handleContinueWithSavedData,
    handleClearSavedData,
    handleClientCreated,
    loadClientData,
    hasUnsavedClientData,
    handleOpenClientWithProjectCheck,
    handleContinueWithSavedProject,
    handleClearSavedProject,
    loadProjectData,
    hasUnsavedProjectData,
    hasAnyUnsavedProject,
    saveOpenCardData,
    clearOpenCardData,
    hasAnyOpenCard,
  };
};