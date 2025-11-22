import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Document, Message } from '@/components/clients/ClientsTypes';
import { useRef, useState, useEffect } from 'react';
import { toast } from 'sonner';
import funcUrls from '../../../../backend/func2url.json';
import { Dialog, DialogContent } from '@/components/ui/dialog';

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
  const [isDragging, setIsDragging] = useState(false);
  const [previewDocument, setPreviewDocument] = useState<Document | null>(null);
  const [currentDocIndex, setCurrentDocIndex] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  // Клавиатурная навигация
  useEffect(() => {
    if (!previewDocument) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentDocIndex > 0) {
        const newIndex = currentDocIndex - 1;
        setCurrentDocIndex(newIndex);
        setPreviewDocument(documents[newIndex]);
      } else if (e.key === 'ArrowRight' && currentDocIndex < documents.length - 1) {
        const newIndex = currentDocIndex + 1;
        setCurrentDocIndex(newIndex);
        setPreviewDocument(documents[newIndex]);
      } else if (e.key === 'Escape') {
        setPreviewDocument(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewDocument, currentDocIndex, documents]);

  const uploadFile = async (file: File) => {
    setUploading(true);
    console.log('[ClientDetailDocumentsHistory] Starting upload:', file.name);

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const base64 = e.target?.result as string;
        const base64Data = base64.split(',')[1];

        console.log('[ClientDetailDocumentsHistory] Sending to backend:', {
          clientId,
          filename: file.name,
          fileSize: base64Data.length
        });

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

        console.log('[ClientDetailDocumentsHistory] Response status:', response.status);

        if (!response.ok) {
          const errorText = await response.text();
          console.error('[ClientDetailDocumentsHistory] Upload failed:', errorText);
          throw new Error('Failed to upload file');
        }

        const data = await response.json();
        console.log('[ClientDetailDocumentsHistory] Upload success:', data);

        const newDocument: Document = {
          id: data.id,
          name: data.name,
          fileUrl: data.file_url,
          uploadDate: data.upload_date
        };

        console.log('[ClientDetailDocumentsHistory] Calling onDocumentUploaded with:', newDocument);
        onDocumentUploaded(newDocument);

        toast.success(`Файл "${file.name}" загружен`);
      };

      reader.readAsDataURL(file);
    } catch (error) {
      console.error('[ClientDetailDocumentsHistory] Upload error:', error);
      toast.error('Ошибка загрузки файла');
    } finally {
      setUploading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    await uploadFile(files[0]);
    
    if (event.target) {
      event.target.value = '';
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
      setPreviewDocument(null);
      toast.success('Документ удалён');
    } catch (error) {
      console.error('Delete error:', error);
      toast.error('Ошибка удаления документа');
    }
  };

  const handlePreviewDocument = (doc: Document, index: number) => {
    setPreviewDocument(doc);
    setCurrentDocIndex(index);
  };

  const handlePrevDocument = () => {
    if (currentDocIndex > 0) {
      const newIndex = currentDocIndex - 1;
      setCurrentDocIndex(newIndex);
      setPreviewDocument(documents[newIndex]);
    }
  };

  const handleNextDocument = () => {
    if (currentDocIndex < documents.length - 1) {
      const newIndex = currentDocIndex + 1;
      setCurrentDocIndex(newIndex);
      setPreviewDocument(documents[newIndex]);
    }
  };

  const isImage = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext || '');
  };

  const isPDF = (filename: string) => {
    return filename.toLowerCase().endsWith('.pdf');
  };

  const getFileIcon = (filename: string) => {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (isImage(filename)) return 'Image';
    if (isPDF(filename)) return 'FileText';
    if (['doc', 'docx'].includes(ext || '')) return 'FileText';
    if (['xls', 'xlsx'].includes(ext || '')) return 'Sheet';
    return 'File';
  };

  // Свайп для мобильных
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe && currentDocIndex < documents.length - 1) {
      handleNextDocument();
    }
    if (isRightSwipe && currentDocIndex > 0) {
      handlePrevDocument();
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      await uploadFile(files[0]);
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
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt"
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
        <CardContent
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={isDragging ? 'border-2 border-dashed border-primary rounded-lg bg-primary/5' : ''}
        >
          {documents.length === 0 ? (
            <div className="text-center py-8 px-4">
              <Icon name="FileText" size={48} className="mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground font-medium mb-2">Документов пока нет</p>
              <p className="text-sm text-muted-foreground">
                Перетащите файл в эту область,<br />
                сфотографируйте или загрузите договоры, ТЗ<br />
                и другие документы через кнопки выше
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {documents.map((doc, index) => (
                <div key={doc.id} className="border rounded-lg p-3 flex items-center justify-between hover:bg-accent/50 transition-colors">
                  <div 
                    className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
                    onClick={() => handlePreviewDocument(doc, index)}
                  >
                    <Icon name={getFileIcon(doc.name)} size={20} className="text-primary flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{doc.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(doc.uploadDate)}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePreviewDocument(doc, index);
                      }}
                    >
                      <Icon name="Eye" size={16} className="sm:mr-2" />
                      <span className="hidden sm:inline">Просмотр</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(doc.fileUrl, '_blank');
                      }}
                    >
                      <Icon name="Download" size={16} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteDocument(doc.id, doc.name);
                      }}
                    >
                      <Icon name="Trash2" size={16} className="text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>

        {/* Модальное окно предпросмотра */}
        <Dialog open={!!previewDocument} onOpenChange={(open) => !open && setPreviewDocument(null)}>
          <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw] sm:w-full p-0 overflow-hidden">
            {previewDocument && (
              <div className="flex flex-col h-full">
                {/* Заголовок */}
                <div className="flex items-center justify-between p-3 sm:p-4 border-b">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate text-sm sm:text-base">{previewDocument.name}</h3>
                    <p className="text-xs text-muted-foreground">{formatDate(previewDocument.uploadDate)}</p>
                  </div>
                  <div className="flex gap-1 sm:gap-2 ml-2 sm:ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(previewDocument.fileUrl, '_blank')}
                      className="h-8 w-8 sm:w-auto p-0 sm:px-3"
                    >
                      <Icon name="Download" size={16} className="sm:mr-2" />
                      <span className="hidden sm:inline">Скачать</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteDocument(previewDocument.id, previewDocument.name)}
                      className="h-8 w-8 p-0"
                    >
                      <Icon name="Trash2" size={16} className="text-destructive" />
                    </Button>
                  </div>
                </div>

                {/* Контент предпросмотра */}
                <div 
                  className="flex-1 overflow-auto bg-muted/30 relative min-h-[400px] sm:min-h-[600px]"
                  onTouchStart={handleTouchStart}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  {isImage(previewDocument.name) ? (
                    <div className="flex items-center justify-center h-full p-2 sm:p-4">
                      <img 
                        src={previewDocument.fileUrl} 
                        alt={previewDocument.name}
                        className="max-w-full max-h-full object-contain rounded touch-pinch-zoom"
                        style={{ touchAction: 'pinch-zoom' }}
                      />
                    </div>
                  ) : isPDF(previewDocument.name) ? (
                    <iframe
                      src={previewDocument.fileUrl}
                      className="w-full h-full min-h-[400px] sm:min-h-[600px]"
                      title={previewDocument.name}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full p-4 sm:p-8 text-center">
                      <Icon name="FileText" size={48} className="text-muted-foreground mb-3 sm:mb-4" />
                      <p className="text-sm sm:text-base text-muted-foreground mb-2">Предпросмотр недоступен для этого типа файла</p>
                      <p className="text-xs sm:text-sm text-muted-foreground mb-3 sm:mb-4 max-w-xs truncate">{previewDocument.name}</p>
                      <Button onClick={() => window.open(previewDocument.fileUrl, '_blank')} size="sm">
                        <Icon name="Download" size={16} className="mr-2" />
                        Скачать файл
                      </Button>
                    </div>
                  )}

                  {/* Кнопки навигации */}
                  {documents.length > 1 && (
                    <>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 shadow-lg h-10 w-10 sm:h-12 sm:w-12 opacity-90 hover:opacity-100"
                        onClick={handlePrevDocument}
                        disabled={currentDocIndex === 0}
                      >
                        <Icon name="ChevronLeft" size={20} className="sm:w-6 sm:h-6" />
                      </Button>
                      <Button
                        variant="secondary"
                        size="icon"
                        className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 shadow-lg h-10 w-10 sm:h-12 sm:w-12 opacity-90 hover:opacity-100"
                        onClick={handleNextDocument}
                        disabled={currentDocIndex === documents.length - 1}
                      >
                        <Icon name="ChevronRight" size={20} className="sm:w-6 sm:h-6" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Счётчик документов */}
                {documents.length > 1 && (
                  <div className="p-2 border-t bg-background text-center text-sm text-muted-foreground">
                    {currentDocIndex + 1} из {documents.length}
                  </div>
                )}
              </div>
            )}
          </DialogContent>
        </Dialog>
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