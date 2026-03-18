import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Document } from '@/components/clients/ClientsTypes';
import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

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
  const [scale, setScale] = useState(1);
  const [initialDistance, setInitialDistance] = useState<number | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [lastTap, setLastTap] = useState(0);
  const [tapCount, setTapCount] = useState(0);

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

  // Сброс zoom при смене документа
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setIsDragging(false);
  }, [currentDocIndex, previewDocument]);

  // Pinch-to-zoom
  const getDistance = (touches: React.TouchList) => {
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) +
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // Начало pinch-to-zoom
      setInitialDistance(getDistance(e.touches));
      // Блокируем двойной тап при pinch
      setLastTap(0);
    } else if (e.touches.length === 1 && scale === 1) {
      // Свайп только при zoom = 1
      setTouchStart(e.targetTouches[0].clientX);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialDistance) {
      // Pinch-to-zoom
      const currentDistance = getDistance(e.touches);
      const newScale = (currentDistance / initialDistance) * scale;
      setScale(Math.min(Math.max(newScale, 1), 5)); // От 1x до 5x
      // Блокируем двойной тап при pinch
      setLastTap(0);
    } else if (e.touches.length === 1 && scale === 1) {
      setTouchEnd(e.targetTouches[0].clientX);
    }
  };

  const handleTouchEnd = () => {
    if (initialDistance) {
      setInitialDistance(null);
      // Блокируем клик после pinch
      setLastTap(0);
      return;
    }

    if (!touchStart || !touchEnd || scale > 1) return;
    
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

  const handleZoomIn = () => {
    setScale(prev => Math.min(prev + 0.5, 5));
  };

  const handleZoomOut = () => {
    setScale(prev => Math.max(prev - 0.5, 1));
  };

  const handleResetZoom = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  // Перетаскивание изображения
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Перетаскивание touch
  const handleImageTouchStart = (e: React.TouchEvent) => {
    if (scale > 1 && e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({ 
        x: e.touches[0].clientX - position.x, 
        y: e.touches[0].clientY - position.y 
      });
    }
  };

  const handleImageTouchMove = (e: React.TouchEvent) => {
    if (isDragging && scale > 1 && e.touches.length === 1) {
      setPosition({
        x: e.touches[0].clientX - dragStart.x,
        y: e.touches[0].clientY - dragStart.y
      });
      // Если было движение, отменяем клик
      setLastTap(0);
    }
  };

  const handleImageTouchEnd = () => {
    const wasDragging = isDragging;
    setIsDragging(false);
    
    // Если было перетаскивание, не обрабатываем двойной тап
    if (wasDragging) {
      return;
    }
    
    // Обработка двойного тапа
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (lastTap && now - lastTap < DOUBLE_TAP_DELAY) {
      // Двойной тап обнаружен!
      if (scale === 1) {
        // Увеличиваем
        setScale(2.5);
      } else {
        // Уменьшаем
        setScale(1);
        setPosition({ x: 0, y: 0 });
      }
      setLastTap(0);
    } else {
      // Первый тап
      setLastTap(now);
    }
  };

  // Двойное нажатие для zoom
  const handleDoubleClick = () => {
    if (scale === 1) {
      setScale(2.5);
    } else {
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  };

  const handleImageClick = (e: React.MouseEvent) => {
    // Игнорируем клики при перетаскивании
    if (isDragging) {
      return;
    }

    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (lastTap && now - lastTap < DOUBLE_TAP_DELAY) {
      // Двойное нажатие обнаружено
      e.preventDefault();
      e.stopPropagation();
      handleDoubleClick();
      // Полностью сбрасываем таймер после выполнения действия
      setLastTap(0);
    } else {
      // Первое нажатие - запускаем таймер
      setLastTap(now);
      // Автоматически сбрасываем таймер через DOUBLE_TAP_DELAY, если не было второго тапа
      setTimeout(() => {
        setLastTap(prev => {
          // Сбрасываем только если не было обновления (т.е. не было второго тапа)
          if (prev === now) {
            return 0;
          }
          return prev;
        });
      }, DOUBLE_TAP_DELAY);
    }
  };

  return (
    <Dialog open={!!previewDocument} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] w-[95vw] sm:w-full p-0 overflow-hidden bg-gradient-to-br from-purple-50/80 via-pink-50/60 to-rose-50/80 dark:from-purple-950/40 dark:via-pink-950/40 dark:to-rose-950/40 backdrop-blur-sm">
        <VisuallyHidden>
          <DialogTitle>Просмотр документа</DialogTitle>
        </VisuallyHidden>
        {previewDocument && (
          <div className="flex flex-col h-full">
            {/* Заголовок */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 sm:p-4 border-b">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold truncate text-sm sm:text-base">{previewDocument.name}</h3>
                <p className="text-xs text-muted-foreground">{formatDate(previewDocument.uploadDate)}</p>
              </div>
              <div className="flex gap-1 sm:gap-2 flex-wrap">
                {isImage(previewDocument.name) && (
                  <div className="flex gap-1 border-r pr-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleZoomOut}
                      disabled={scale <= 1}
                      className="h-7 w-7 p-0"
                    >
                      <Icon name="Minus" size={14} />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleResetZoom}
                      disabled={scale === 1}
                      className="h-7 w-auto px-2 text-xs font-mono"
                    >
                      {Math.round(scale * 100)}%
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleZoomIn}
                      disabled={scale >= 5}
                      className="h-7 w-7 p-0"
                    >
                      <Icon name="Plus" size={14} />
                    </Button>
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(previewDocument.fileUrl, '_blank')}
                  className="h-7 w-7 sm:w-auto p-0 sm:px-3"
                >
                  <Icon name="Download" size={14} className="sm:mr-2" />
                  <span className="hidden sm:inline text-xs">Скачать</span>
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onDelete(previewDocument.id, previewDocument.name)}
                  className="h-7 w-7 p-0"
                >
                  <Icon name="Trash2" size={14} className="text-destructive" />
                </Button>
              </div>
            </div>

            {/* Контент предпросмотра */}
            <div 
              className="flex-1 overflow-auto bg-muted/30 relative min-h-[250px] max-h-[55vh]"
              onTouchStart={handleTouchStart}
              onTouchMove={handleTouchMove}
              onTouchEnd={handleTouchEnd}
            >
              {isImage(previewDocument.name) ? (
                <div 
                  className="flex items-center justify-center h-full p-2 sm:p-4 overflow-hidden relative"
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                >
                  {scale === 1 ? (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs sm:text-sm px-4 py-2 rounded-full pointer-events-none z-10 animate-pulse">
                      👆 Двойное нажатие для увеличения
                    </div>
                  ) : (
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1.5 rounded-full pointer-events-none z-10">
                      🔍 {Math.round(scale * 100)}% · Перетащите для просмотра
                    </div>
                  )}
                  <img 
                    src={previewDocument.fileUrl} 
                    alt={previewDocument.name}
                    className="max-w-full max-h-[50vh] object-contain rounded select-none"
                    style={{ 
                      transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
                      cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                      transformOrigin: 'center center',
                      transition: isDragging ? 'none' : 'transform 0.2s ease'
                    }}
                    onMouseDown={handleMouseDown}
                    onDoubleClick={handleDoubleClick}
                    onTouchStart={handleImageTouchStart}
                    onTouchMove={handleImageTouchMove}
                    onTouchEnd={handleImageTouchEnd}
                    draggable={false}
                  />
                </div>
              ) : isPDF(previewDocument.name) ? (
                <iframe
                  src={previewDocument.fileUrl}
                  className="w-full h-full min-h-[250px] max-h-[55vh]"
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