import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Document, Message } from '@/components/clients/ClientsTypes';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import funcUrls from '../../../../backend/func2url.json';

interface ClientDetailDocumentsHistoryProps {
  documents: Document[];
  messages: Message[];
  formatDate: (dateString: string) => string;
  formatDateTime: (dateString: string) => string;
  tab: 'documents' | 'history';
  clientId: number;
  onDocumentUploaded: (document: Document) => void;
  onDocumentDeleted: (documentId: number) => void;
}

const ClientDetailDocumentsHistory = ({
  documents,
  messages,
  formatDate,
  formatDateTime,
  tab,
  clientId,
  onDocumentUploaded,
  onDocumentDeleted,
}: ClientDetailDocumentsHistoryProps) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    setUploading(true);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const base64Data = base64.split(',')[1];

        const response = await fetch(funcUrls['clients'], {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': localStorage.getItem('userId') || ''
          },
          body: JSON.stringify({
            action: 'upload_document',
            clientId,
            filename: file.name,
            file: base64Data
          })
        });

        if (!response.ok) {
          throw new Error('Failed to upload file');
        }

        const data = await response.json();
        onDocumentUploaded({
          id: data.id,
          name: data.name,
          fileUrl: data.file_url,
          uploadDate: data.upload_date
        });

        toast.success(`Файл "${file.name}" загружен`);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Ошибка загрузки файла');
    } finally {
      setUploading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  };

  const handleCameraClick = () => {
    cameraInputRef.current?.click();
  };

  const handleFileClick = () => {
    fileInputRef.current?.click();
  };

  const handleDeleteDocument = async (documentId: number, documentName: string) => {
    if (!confirm(`Удалить документ "${documentName}"?`)) return;

    try {
      const response = await fetch(
        `${funcUrls['clients']}?action=delete_document&documentId=${documentId}`,
        {
          method: 'DELETE',
          headers: {
            'X-User-Id': localStorage.getItem('userId') || ''
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to delete document');
      }

      onDocumentDeleted(documentId);
      toast.success('Документ удалён');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Ошибка удаления документа');
    }
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
              disabled={uploading}
            >
              {uploading ? (
                <>
                  <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
                  Загрузка...
                </>
              ) : (
                <>
                  <Icon name="Upload" size={16} className="mr-2" />
                  <span className="hidden md:inline">Загрузить файл</span>
                  <span className="md:hidden">Файл</span>
                </>
              )}
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
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Icon name="FileText" size={20} className="text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(doc.uploadDate)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(doc.fileUrl, '_blank')}
                    >
                      <Icon name="Download" size={16} className="sm:mr-2" />
                      <span className="hidden sm:inline">Скачать</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteDocument(doc.id, doc.name)}
                    >
                      <Icon name="Trash2" size={16} className="text-destructive" />
                    </Button>
                  </div>
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