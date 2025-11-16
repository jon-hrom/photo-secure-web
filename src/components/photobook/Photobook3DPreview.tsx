import { useState } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import Icon from '@/components/ui/icon';
import type { PhotobookConfig, PhotoSlot, UploadedPhoto } from './PhotobookCreator';
import { exportAsJPEG, exportAsPSD, exportAsPDF, downloadFile } from '@/utils/photobookExport';

interface Photobook3DPreviewProps {
  open: boolean;
  config: PhotobookConfig;
  spreads: Array<{ id: string; slots: PhotoSlot[] }>;
  photos: UploadedPhoto[];
  onClose: () => void;
  onOrder: () => void;
}

const Photobook3DPreview = ({
  open,
  config,
  spreads,
  photos,
  onClose,
  onOrder
}: Photobook3DPreviewProps) => {
  const [currentPage, setCurrentPage] = useState(0);
  const [acceptResponsibility, setAcceptResponsibility] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const totalPages = spreads.length * 2; // Each spread has 2 pages

  const handlePrevPage = () => {
    if (currentPage > 0 && !isAnimating) {
      setIsAnimating(true);
      setCurrentPage(prev => prev - 1);
      setTimeout(() => setIsAnimating(false), 600);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1 && !isAnimating) {
      setIsAnimating(true);
      setCurrentPage(prev => prev + 1);
      setTimeout(() => setIsAnimating(false), 600);
    }
  };

  const getPhotoUrl = (photoId?: string) => {
    return photos.find(p => p.id === photoId)?.url;
  };

  const handleDownloadJPEG = async () => {
    setIsExporting(true);
    try {
      const blob = await exportAsJPEG(spreads, photos);
      downloadFile(blob, 'photobook-jpeg.zip');
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPSD = async () => {
    setIsExporting(true);
    try {
      const blob = await exportAsPSD(spreads, photos);
      downloadFile(blob, 'photobook-psd.zip');
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadPDF = async () => {
    setIsExporting(true);
    try {
      const blob = await exportAsPDF(spreads, photos);
      downloadFile(blob, 'photobook.pdf');
    } catch (error) {
      console.error('Export error:', error);
    } finally {
      setIsExporting(false);
    }
  };

  const currentSpreadIndex = Math.floor(currentPage / 2);
  const currentSpread = spreads[currentSpreadIndex];

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
        <div className="flex flex-col h-[95vh]">
          {/* Header */}
          <div className="border-b px-6 py-3 flex items-center justify-between bg-white">
            <Tabs defaultValue="photobook" className="w-full">
              <div className="flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="photobook">Фотокнига</TabsTrigger>
                  <TabsTrigger value="pages">Страницы</TabsTrigger>
                </TabsList>
                <Button variant="ghost" size="icon" onClick={onClose}>
                  <Icon name="X" size={24} />
                </Button>
              </div>
            </Tabs>
          </div>

          {/* Main 3D View */}
          <div className="flex-1 bg-gray-100 relative overflow-hidden">
            <div className="absolute inset-0 flex items-center justify-center">
              {/* Left arrow */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-8 z-10 w-16 h-16 bg-white/80 hover:bg-white shadow-lg"
                onClick={handlePrevPage}
                disabled={currentPage === 0 || isAnimating}
              >
                <Icon name="ChevronLeft" size={32} />
              </Button>

              {/* 3D Book */}
              <div 
                className="relative transition-all duration-600 ease-in-out"
                style={{
                  width: '900px',
                  height: '600px',
                  transform: 'perspective(2000px) rotateX(15deg)',
                  transformStyle: 'preserve-3d'
                }}
              >
                {/* Book shadow */}
                <div 
                  className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-[110%] h-8 bg-black/20 blur-xl rounded-full"
                  style={{ transform: 'rotateX(90deg) translateZ(-50px)' }}
                />

                {/* Book pages */}
                <div className="relative w-full h-full bg-white shadow-2xl rounded-sm">
                  {currentSpread ? (
                    <div className="w-full h-full flex">
                      {/* Left page */}
                      <div className="w-1/2 h-full border-r-2 border-gray-300 p-8 relative overflow-hidden">
                        {currentSpread.slots.slice(0, Math.ceil(currentSpread.slots.length / 2)).map(slot => {
                          const photoUrl = getPhotoUrl(slot.photoId);
                          return photoUrl ? (
                            <img
                              key={slot.id}
                              src={photoUrl}
                              alt="Page"
                              className="absolute object-cover"
                              style={{
                                left: `${(slot.x / 1000) * 100}%`,
                                top: `${(slot.y / 600) * 100}%`,
                                width: `${(slot.width / 500) * 100}%`,
                                height: `${(slot.height / 600) * 100}%`,
                              }}
                            />
                          ) : null;
                        })}
                      </div>

                      {/* Right page */}
                      <div className="w-1/2 h-full p-8 relative overflow-hidden">
                        {currentSpread.slots.slice(Math.ceil(currentSpread.slots.length / 2)).map(slot => {
                          const photoUrl = getPhotoUrl(slot.photoId);
                          return photoUrl ? (
                            <img
                              key={slot.id}
                              src={photoUrl}
                              alt="Page"
                              className="absolute object-cover"
                              style={{
                                left: `${((slot.x - 500) / 500) * 100}%`,
                                top: `${(slot.y / 600) * 100}%`,
                                width: `${(slot.width / 500) * 100}%`,
                                height: `${(slot.height / 600) * 100}%`,
                              }}
                            />
                          ) : null;
                        })}
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-400">
                      <Icon name="BookOpen" size={64} />
                    </div>
                  )}

                  {/* Page flip animation overlay */}
                  {isAnimating && (
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-pulse" />
                  )}
                </div>

                {/* Book spine highlight */}
                <div 
                  className="absolute top-0 bottom-0 left-1/2 w-1 bg-gradient-to-r from-gray-400 via-gray-300 to-gray-400"
                  style={{ transform: 'translateX(-50%)' }}
                />
              </div>

              {/* Right arrow */}
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-8 z-10 w-16 h-16 bg-white/80 hover:bg-white shadow-lg"
                onClick={handleNextPage}
                disabled={currentPage === totalPages - 1 || isAnimating}
              >
                <Icon name="ChevronRight" size={32} />
              </Button>
            </div>

            {/* Page counter */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-sm px-6 py-2 rounded-full shadow-lg">
              <span className="text-sm font-medium">
                Страница {currentPage + 1} из {totalPages}
              </span>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t px-6 py-4 bg-white">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1">
                <Checkbox
                  id="accept-responsibility"
                  checked={acceptResponsibility}
                  onCheckedChange={(checked) => setAcceptResponsibility(checked as boolean)}
                />
                <label htmlFor="accept-responsibility" className="text-sm text-muted-foreground cursor-pointer">
                  Заказ сразу уйдет в печать: ночью, днем, на выходных — все равно. Вы принимаете на себя всю
                  ответственность за отправленные макеты, сделать отмену или заменить файлы после отправки в печать
                  будет невозможно.
                </label>
              </div>
              <div className="flex items-center gap-3 ml-6">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="lg" disabled={isExporting}>
                      <Icon name="Download" size={20} className="mr-2" />
                      {isExporting ? 'Экспорт...' : 'Скачать дизайн'}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={handleDownloadPDF}>
                      <Icon name="FileText" size={16} className="mr-2" />
                      PDF файл
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDownloadJPEG}>
                      <Icon name="Image" size={16} className="mr-2" />
                      JPEG архив (.zip)
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={handleDownloadPSD}>
                      <Icon name="Layers" size={16} className="mr-2" />
                      PSD архив (.zip)
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button
                  size="lg"
                  className="bg-yellow-400 hover:bg-yellow-500 text-black font-semibold text-lg px-8"
                  onClick={onOrder}
                  disabled={!acceptResponsibility}
                >
                  Заказать за {config.price.toLocaleString('ru-RU')} ₽
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default Photobook3DPreview;