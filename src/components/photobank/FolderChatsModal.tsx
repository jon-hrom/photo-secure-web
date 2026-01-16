import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import ChatModal from '@/components/gallery/ChatModal';

interface Client {
  id: number;
  name: string;
  phone: string;
  unread_count: number;
  last_message?: string;
  last_message_time?: string;
}

interface FolderChatsModalProps {
  isOpen: boolean;
  onClose: () => void;
  folderId: number;
  photographerId: number;
}

export default function FolderChatsModal({ 
  isOpen, 
  onClose, 
  folderId, 
  photographerId 
}: FolderChatsModalProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const loadClients = async () => {
    try {
      setLoading(true);
      const userId = sessionStorage.getItem('userId');
      
      const response = await fetch(
        `https://functions.poehali.dev/cf469a8f-506f-4b38-98b3-731c22c5c836?folder_id=${folderId}`,
        {
          headers: {
            'X-User-Id': userId || ''
          }
        }
      );
      
      if (!response.ok) throw new Error('Ошибка загрузки клиентов');
      
      const data = await response.json();
      setClients(data.clients || []);
      
      if (data.clients && data.clients.length > 0) {
        setSelectedClientId(data.clients[0].id);
      }
    } catch (error) {
      console.error('Error loading clients:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadClients();
    }
  }, [isOpen, folderId]);

  const selectedClient = clients.find(c => c.id === selectedClientId);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex" onClick={onClose}>
      <div 
        className="bg-background w-full h-full md:m-4 md:rounded-xl shadow-2xl flex flex-col overflow-hidden md:max-w-7xl md:mx-auto" 
        onClick={(e) => e.stopPropagation()}
      >
        {/* Заголовок */}
        <div className="flex items-center justify-between p-4 border-b bg-background">
          <div className="flex items-center gap-3">
            <Icon name="MessagesSquare" size={24} className="text-primary" />
            <div>
              <h2 className="text-xl font-semibold">Сообщения клиентов</h2>
              <p className="text-sm text-muted-foreground">Клиентов: {clients.length}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <Icon name="X" size={20} />
          </Button>
        </div>

        {/* Контент */}
        <div className="flex-1 flex overflow-hidden">
          {/* Список клиентов - скрывается на мобильных если выбран клиент */}
          <div className={`
            w-full md:w-80 border-r flex flex-col bg-background
            ${selectedClient ? 'hidden md:flex' : 'flex'}
          `}>
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : clients.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-32 text-muted-foreground p-4">
                  <Icon name="Users" size={32} className="mb-2 opacity-50" />
                  <p className="text-sm text-center">Нет клиентов с сообщениями</p>
                </div>
              ) : (
                clients.map(client => (
                  <button
                    key={client.id}
                    onClick={() => setSelectedClientId(client.id)}
                    className={`w-full p-4 text-left border-b hover:bg-muted transition-colors ${
                      selectedClientId === client.id ? 'bg-muted border-l-4 border-l-primary' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium truncate">{client.name}</p>
                          {client.unread_count > 0 && (
                            <span className="inline-flex items-center justify-center px-2 py-0.5 text-xs font-medium text-white bg-yellow-600 rounded-full">
                              {client.unread_count}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mb-1">{client.phone}</p>
                        {client.last_message && (
                          <p className="text-sm text-muted-foreground truncate">
                            {client.last_message}
                          </p>
                        )}
                      </div>
                      <Icon name="ChevronRight" size={16} className="flex-shrink-0 text-muted-foreground" />
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Область чата - полный экран на мобильных */}
          <div className={`
            flex-1 flex flex-col bg-muted/30
            ${selectedClient ? 'flex' : 'hidden md:flex'}
          `}>
            {!selectedClient ? (
              <div className="flex-1 flex items-center justify-center text-center text-muted-foreground p-4">
                <div>
                  <Icon name="MessageCircle" size={48} className="mx-auto mb-3 opacity-30" />
                  <p>Выберите клиента для начала общения</p>
                </div>
              </div>
            ) : (
              <>
                {/* Кнопка назад на мобильных */}
                <div className="md:hidden border-b bg-background p-4">
                  <button 
                    onClick={() => setSelectedClientId(null)}
                    className="flex items-center gap-2 text-primary"
                  >
                    <Icon name="ChevronLeft" size={20} />
                    <span>Назад к списку</span>
                  </button>
                </div>

                {/* Встроенный чат */}
                <div className="flex-1 overflow-hidden relative">
                  <ChatModal
                    isOpen={true}
                    onClose={() => {
                      setSelectedClientId(null);
                      loadClients();
                    }}
                    clientId={selectedClient.id}
                    photographerId={photographerId}
                    senderType="photographer"
                    clientName={selectedClient.name}
                    embedded={true}
                  />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
