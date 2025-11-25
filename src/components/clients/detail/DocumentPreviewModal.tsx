import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Document } from '@/components/clients/ClientsTypes';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';

interface DocumentPreviewModalProps {
  previewDocument: Document | null;
  documents: Document[];
  currentDocIndex: number;
  formatDate: (dateString: string) => string;
  onClose: () => void;
  onNavigate: (newIndex: number) => void;
  onDelete: (documentId: number, documentName: string) => void;
  isImage: (filename: string) => boolean;
  isPDF: (filename: string) => boolean;
}

const DocumentPreviewModal = ({
  previewDocument,
  documents,
  currentDocIndex,
  formatDate,
  onClose,
  onNavigate,
  onDelete,
  isImage,
  isPDF,
}: DocumentPreviewModalProps) => {
  const [touchStart, setTouchStart] = useState(0);
  const [touchEnd, setTouchEnd] = useState(0);

  // Клавиатурная навигация
  useEffect(() => {
    if (!previewDocument) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && currentDocIndex > 0) {
        onNavigate(currentDocIndex - 1);
      } else if (e.key === 'ArrowRight' && currentDocIndex < documents.length - 1) {
        onNavigate(currentDocIndex + 1);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [previewDocument, currentDocIndex, documents, onNavigate, onClose]);

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
      onNavigate(currentDocIndex + 1);
    }
    if (isRightSwipe && currentDocIndex > 0) {
      onNavigate(currentDocIndex - 1);
    }

    setTouchStart(0);
    setTouchEnd(0);
  };

  const handlePrevDocument = () => {
    if (currentDocIndex > 0) {
      onNavigate(currentDocIndex - 1);
    }
  };

  const handleNextDocument = () => {
    if (currentDocIndex < documents.length - 1) {
      onNavigate(currentDocIndex + 1);
    }
  };

  return (
    <Dialog open={!!previewDocument} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] w-[95vw] sm:w-full p-0 overflow-hidden bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-rose-50/80 backdrop-blur-sm">
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
                  onClick={() => onDelete(previewDocument.id, previewDocument.name)}
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
  );
};

export default DocumentPreviewModal;