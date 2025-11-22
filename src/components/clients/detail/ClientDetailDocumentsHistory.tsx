import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Document, Message } from '@/components/clients/ClientsTypes';
import { useRef, useState } from 'react';
import { toast } from 'sonner';
import funcUrls from '../../../../backend/func2url.json';
import DocumentListItem from './DocumentListItem';
import DocumentPreviewModal from './DocumentPreviewModal';
import MessageHistory from './MessageHistory';

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

  const handleNavigatePreview = (newIndex: number) => {
    setCurrentDocIndex(newIndex);
    setPreviewDocument(documents[newIndex]);
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
                <DocumentListItem
                  key={doc.id}
                  doc={doc}
                  index={index}
                  formatDate={formatDate}
                  onPreview={handlePreviewDocument}
                  onDelete={handleDeleteDocument}
                  getFileIcon={getFileIcon}
                />
              ))}
            </div>
          )}
        </CardContent>

        <DocumentPreviewModal
          previewDocument={previewDocument}
          documents={documents}
          currentDocIndex={currentDocIndex}
          formatDate={formatDate}
          onClose={() => setPreviewDocument(null)}
          onNavigate={handleNavigatePreview}
          onDelete={handleDeleteDocument}
          isImage={isImage}
          isPDF={isPDF}
        />
      </Card>
    );
  }

  return <MessageHistory messages={messages} formatDateTime={formatDateTime} />;
};

export default ClientDetailDocumentsHistory;
