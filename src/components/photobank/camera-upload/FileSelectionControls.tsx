import { RefObject } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { isNativeApp } from '@/utils/capacitorCheck';
import NativeCameraCapture from '@/components/camera/NativeCameraCapture';

interface FileSelectionControlsProps {
  fileInputRef: RefObject<HTMLInputElement>;
  uploading: boolean;
  userId: string;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onScanDates: () => void;
  onNativeFilePicker: () => void;
  onNativeCapture: (cdnUrl: string, fileName: string) => void;
}

const FileSelectionControls = ({
  fileInputRef,
  uploading,
  userId,
  onFileSelect,
  onScanDates,
  onNativeFilePicker,
  onNativeCapture
}: FileSelectionControlsProps) => {
  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        multiple
        onChange={onFileSelect}
        className="hidden"
      />
      
      {!isNativeApp() ? (
        <Button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="w-full"
          size="lg"
        >
          <Icon name="Upload" className="mr-2" size={20} />
          Выбрать файлы
        </Button>
      ) : (
        <>
          <div className="space-y-3">
            <Button
              onClick={onScanDates}
              disabled={uploading}
              className="w-full"
              size="lg"
              variant="outline"
            >
              <Icon name="Calendar" className="mr-2" size={20} />
              Сканировать даты с камеры
            </Button>

            <Button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="w-full"
              size="lg"
            >
              <Icon name="Upload" className="mr-2" size={20} />
              Выбрать фото
            </Button>
          </div>

          <div className="border-t pt-4">
            <NativeCameraCapture
              userId={userId}
              onCapture={onNativeCapture}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default FileSelectionControls;