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
  const [showChat, setShowChat] = useState(false);

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
      
      // Автоматически выбираем первого клиента если есть
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
    <>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[80vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          {/* Заголовок */}
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-2">
              <Icon name="MessagesSquare" size={24} className="text-blue-600" />
              <h2 className="text-xl font-semibold">Сообщения клиентов</h2>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <Icon name="X" size={20} />
            </Button>
          </div>

          {/* Контент */}
          <div className="flex-1 flex overflow-hidden">
            {/* Список клиентов */}
            <div className="w-80 border-r flex flex-col">
              <div className="p-3 border-b bg-gray-50">
                <p className="text-sm text-muted-foreground">
                  Клиентов: {clients.length}
                </p>
              </div>
              
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center h-32">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  </div>
                ) : clients.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                    <Icon name="Users" size={32} className="mb-2 opacity-50" />
                    <p className="text-sm">Нет клиентов</p>
                  </div>
                ) : (
                  clients.map(client => (
                    <button
                      key={client.id}
                      onClick={() => {
                        setSelectedClientId(client.id);
                        setShowChat(true);
                      }}
                      className={`w-full p-4 text-left border-b hover:bg-gray-50 transition-colors ${
                        selectedClientId === client.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
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
                        <Icon name="ChevronRight" size={16} className="flex-shrink-0 text-gray-400" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>

            {/* Область для чата */}
            <div className="flex-1 flex items-center justify-center bg-gray-50">
              {!selectedClient ? (
                <div className="text-center text-muted-foreground">
                  <Icon name="MessageCircle" size={48} className="mx-auto mb-3 opacity-30" />
                  <p>Выберите клиента для начала общения</p>
                </div>
              ) : (
                <div className="w-full h-full flex flex-col">
                  <div className="p-4 border-b bg-white">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                        <Icon name="User" size={20} className="text-blue-600" />
                      </div>
                      <div>
                        <p className="font-medium">{selectedClient.name}</p>
                        <p className="text-sm text-muted-foreground">{selectedClient.phone}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1 p-4 text-center text-muted-foreground">
                    <p className="mb-4">Чат откроется в отдельном окне</p>
                    <Button onClick={() => setShowChat(true)}>
                      <Icon name="MessageSquare" size={16} className="mr-2" />
                      Открыть чат
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Модалка чата */}
      {showChat && selectedClient && (
        <ChatModal
          isOpen={showChat}
          onClose={() => {
            setShowChat(false);
            loadClients(); // Обновляем счетчики после закрытия чата
          }}
          clientId={selectedClient.id}
          photographerId={photographerId}
          senderType="photographer"
          clientName={selectedClient.name}
        />
      )}
    </>
  );
}
