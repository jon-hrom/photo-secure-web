import Icon from '@/components/ui/icon';
import { Switch } from '@/components/ui/switch';

interface FeaturesTabProps {
  clientUploadEnabled: boolean;
  onClientUploadChange: (enabled: boolean) => void;
}

export default function FeaturesTab({ clientUploadEnabled, onClientUploadChange }: FeaturesTabProps) {
  return (
    <div className="space-y-4">
      <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center flex-shrink-0">
              <Icon name="Upload" size={20} className="text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="font-medium text-gray-900 dark:text-white text-sm">Загрузка фото клиентом</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Клиент сможет загружать свои фото через общую ссылку. Он создаст папку со своим именем, чтобы вы не запутались, где ваши фото, а где его.
              </p>
            </div>
          </div>
          <Switch
            checked={clientUploadEnabled}
            onCheckedChange={onClientUploadChange}
          />
        </div>

        {clientUploadEnabled && (
          <div className="ml-13 pl-3 border-l-2 border-blue-200 dark:border-blue-800 space-y-2">
            <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
              <Icon name="FolderPlus" size={14} className="mt-0.5 flex-shrink-0 text-blue-500" />
              <span>Клиент обязательно создаёт папку и даёт ей имя</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
              <Icon name="Shield" size={14} className="mt-0.5 flex-shrink-0 text-green-500" />
              <span>Папки клиентов отделены от ваших фото</span>
            </div>
            <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
              <Icon name="Smartphone" size={14} className="mt-0.5 flex-shrink-0 text-purple-500" />
              <span>Работает на телефоне, планшете и компьютере</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
