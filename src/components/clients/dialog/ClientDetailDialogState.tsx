import { useState, useEffect } from 'react';
import { Client } from '@/components/clients/ClientsTypes';

export const useClientDetailState = (client: Client | null, open: boolean) => {
  const tabs = ['overview', 'shooting', 'projects', 'documents', 'payments', 'messages', 'history'] as const;
  const [activeTab, setActiveTab] = useState('overview');
  const [showSwipeHint, setShowSwipeHint] = useState(false);
  const [photographerPhone, setPhotographerPhone] = useState('');
  const [photographerName, setPhotographerName] = useState('');
  const [newProject, setNewProject] = useState({ 
    name: '', 
    budget: '', 
    description: '',
    startDate: new Date().toISOString().split('T')[0],
    shootingStyleId: ''
  });
  const [newPayment, setNewPayment] = useState({ 
    amount: '', 
    method: 'card', 
    description: '', 
    projectId: '',
    date: new Date().toISOString().split('T')[0],
    splitAcrossProjects: false
  });
  const [newComment, setNewComment] = useState('');
  const [newMessage, setNewMessage] = useState({ 
    content: '', 
    type: 'phone', 
    author: '' 
  });
  const [localClient, setLocalClient] = useState(client);

  useEffect(() => {
    const fetchPhotographerData = async () => {
      try {
        const userId = localStorage.getItem('userId');
        if (!userId) return;
        
        const SETTINGS_API = 'https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0';
        const response = await fetch(`${SETTINGS_API}?userId=${userId}`);
        const data = await response.json();
        
        if (response.ok) {
          if (data.phone) {
            setPhotographerPhone(data.phone);
            setNewMessage(prev => ({ ...prev, author: data.phone }));
          }
          if (data.display_name) {
            setPhotographerName(data.display_name);
          }
        }
      } catch (error) {
        console.error('[ClientDetailDialog] Failed to fetch photographer data:', error);
      }
    };
    
    fetchPhotographerData();
  }, []);

  useEffect(() => {
    if (client) {
      console.log('[ClientDetailDialog] Client updated:', client);
      console.log('[ClientDetailDialog] Payments:', client.payments?.length);
      console.log('[ClientDetailDialog] Projects:', client.projects?.length);
      console.log('[ClientDetailDialog] Messages:', client.messages?.length);
      setLocalClient(client);
    }
  }, [client]);

  useEffect(() => {
    if (open) {
      const hasSeenHint = localStorage.getItem('clientDetailSwipeHintSeen');
      if (!hasSeenHint) {
        setShowSwipeHint(true);
        setTimeout(() => {
          setShowSwipeHint(false);
          localStorage.setItem('clientDetailSwipeHintSeen', 'true');
        }, 3500);
      }
    }
  }, [open]);

  return {
    tabs,
    activeTab,
    setActiveTab,
    showSwipeHint,
    photographerPhone,
    photographerName,
    newProject,
    setNewProject,
    newPayment,
    setNewPayment,
    newComment,
    setNewComment,
    newMessage,
    setNewMessage,
    localClient,
    setLocalClient
  };
};