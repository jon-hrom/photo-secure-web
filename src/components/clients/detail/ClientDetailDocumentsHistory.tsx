import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Document, Message } from '@/components/clients/ClientsTypes';
import { useRef } from 'react';
import { toast } from 'sonner';

interface ClientDetailDocumentsHistoryProps {
  documents: Document[];
  messages: Message[];
  formatDate: (dateString: string) => string;
  formatDateTime: (dateString: string) => string;
  tab: 'documents' | 'history';
}

const ClientDetailDocumentsHistory = ({
  documents,
  messages,
  formatDate,
  formatDateTime,
  tab,
}: ClientDetailDocumentsHistoryProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    toast.success(`Файл "${file.name}" загружен`, {
      description: 'Документ будет добавлен в карточку клиента'
    });
    
    // TODO: Implement actual file upload logic
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  if (tab === 'documents') {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle>Документы</CardTitle>
          <div className="flex gap-2">
            {/* Камера для мобильных */}
            <Button
              onClick={handleCameraClick}
              size="sm"
              variant="outline"
              className="md:hidden"
            >
              <Icon name="Camera" size={16} className="mr-2" />
              Камера
            </Button>
            
            {/* Обычная загрузка для десктопа */}
            <Button
              onClick={handleFileClick}
              size="sm"
              variant="outline"
            >
              <Icon name="Upload" size={16} className="mr-2" />
              <span className="hidden md:inline">Загрузить файл</span>
              <span className="md:hidden">Файл</span>
            </Button>
          </div>

          {/* Скрытые input для загрузки */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf,.doc,.docx"
            className="hidden"
            onChange={handleFileUpload}
          />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileUpload}
          />
        </CardHeader>
        <CardContent>
          {documents.length === 0 ? (
            <div className="text-center py-8">
              <Icon name="FileText" size={48} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">Документов пока нет</p>
              <p className="text-sm text-muted-foreground mt-1">
                Загрузите договоры, ТЗ и другие документы
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="border rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon name="FileText" size={20} className="text-primary" />
                    <div>
                      <p className="font-medium">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(doc.uploadDate)}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    <Icon name="Download" size={16} className="mr-2" />
                    Скачать
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>История взаимодействий</CardTitle>
      </CardHeader>
      <CardContent>
        {messages.length === 0 ? (
          <div className="text-center py-8">
            <Icon name="History" size={48} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">История пуста</p>
            <p className="text-sm text-muted-foreground mt-1">
              Здесь будет отображаться история общения с клиентом
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div key={msg.id} className="border rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Icon
                    name={
                      msg.type === 'email' ? 'Mail' :
                      msg.type === 'vk' ? 'MessageCircle' :
                      msg.type === 'phone' ? 'Phone' : 'Users'
                    }
                    size={16}
                    className="text-primary"
                  />
                  <span className="text-sm font-medium">{msg.author}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(msg.date)}
                  </span>
                </div>
                <p className="text-sm">{msg.content}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ClientDetailDocumentsHistory;