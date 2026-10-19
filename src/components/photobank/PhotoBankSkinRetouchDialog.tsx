import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import { Props, RETOUCH_FOLDER_NAME } from '@/components/photobank/skinRetouchDialog/shared';
import { usePhotoBankSkinRetouch } from '@/components/photobank/skinRetouchDialog/usePhotoBankSkinRetouch';
import RetouchSettings from '@/components/photobank/skinRetouchDialog/RetouchSettings';
import SingleRetouchTab from '@/components/photobank/skinRetouchDialog/SingleRetouchTab';
import BatchRetouchTab from '@/components/photobank/skinRetouchDialog/BatchRetouchTab';

const PhotoBankSkinRetouchDialog = ({
  open,
  onOpenChange,
  folderId,
  folderName,
  userId,
  preselectedPhotoId,
  onRetouchComplete,
}: Props) => {
  const {
    loadingPhotos,
    preset,
    setPreset,
    eyeSharpen,
    setEyeSharpen,
    removeChin,
    setRemoveChin,
    plastic,
    setPlastic,
    price,
    tab,
    setTab,
    selectedId,
    setSelectedId,
    singleBusy,
    singleText,
    singleOriginal,
    singleResult,
    setSingleResult,
    compare,
    setCompare,
    items,
    setItems,
    batchRunning,
    cancelRef,
    retouchable,
    skippedCount,
    busy,
    runSingle,
    runBatch,
    handleOpenChange,
    doneCount,
    failedIds,
    finishedCount,
    activePreset,
  } = usePhotoBankSkinRetouch({ open, onOpenChange, folderId, userId, preselectedPhotoId, onRetouchComplete });

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl w-[calc(100%-1rem)] sm:w-full max-h-[92vh] overflow-y-auto p-4 sm:p-6 rounded-2xl sm:rounded-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Icon name="Sparkles" size={18} className="text-primary" />
            Ретушь фото
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Папка: {folderName}. Результаты сохраняются в подпапку «{RETOUCH_FOLDER_NAME}»
          </DialogDescription>
        </DialogHeader>

        <RetouchSettings
          busy={busy}
          preset={preset}
          setPreset={setPreset}
          activePreset={activePreset}
          eyeSharpen={eyeSharpen}
          setEyeSharpen={setEyeSharpen}
          removeChin={removeChin}
          setRemoveChin={setRemoveChin}
          plastic={plastic}
          setPlastic={setPlastic}
        />

        <Tabs value={tab} onValueChange={(v) => !busy && setTab(v as 'single' | 'all')} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-10 sm:h-9">
            <TabsTrigger value="single" disabled={busy} className="text-xs sm:text-sm">
              <Icon name="Image" size={14} className="mr-1.5" />
              Одно фото
            </TabsTrigger>
            <TabsTrigger value="all" disabled={busy} className="text-xs sm:text-sm">
              <Icon name="Images" size={14} className="mr-1.5" />
              Вся папка
            </TabsTrigger>
          </TabsList>

          {loadingPhotos ? (
            <div className="text-center py-8 text-muted-foreground">
              <Icon name="Loader2" size={24} className="animate-spin mx-auto mb-2" />
              <p className="text-xs sm:text-sm">Загрузка фото...</p>
            </div>
          ) : retouchable.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Icon name="ImageOff" size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs sm:text-sm">В папке нет фото для ретуши (JPG/PNG/WEBP/RAW)</p>
            </div>
          ) : (
            <>
              <TabsContent value="single" className="mt-3 space-y-3">
                <SingleRetouchTab
                  busy={busy}
                  retouchable={retouchable}
                  selectedId={selectedId}
                  setSelectedId={setSelectedId}
                  singleBusy={singleBusy}
                  singleText={singleText}
                  singleOriginal={singleOriginal}
                  singleResult={singleResult}
                  setSingleResult={setSingleResult}
                  compare={compare}
                  setCompare={setCompare}
                  price={price}
                  runSingle={runSingle}
                />
              </TabsContent>

              <TabsContent value="all" className="mt-3 space-y-3">
                <BatchRetouchTab
                  items={items}
                  setItems={setItems}
                  retouchable={retouchable}
                  skippedCount={skippedCount}
                  price={price}
                  batchRunning={batchRunning}
                  cancelRef={cancelRef}
                  doneCount={doneCount}
                  failedIds={failedIds}
                  finishedCount={finishedCount}
                  runBatch={runBatch}
                />
              </TabsContent>
            </>
          )}
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default PhotoBankSkinRetouchDialog;
