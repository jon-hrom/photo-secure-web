import Icon from '@/components/ui/icon';
import { GallerySubfolder } from '../GalleryGrid';

interface GallerySubfolderGridProps {
  subfolders: GallerySubfolder[];
  isDarkBg: boolean;
  textColor: string;
  secondaryText: string;
  onOpenSubfolder?: (subfolder: GallerySubfolder) => void;
}

export default function GallerySubfolderGrid({
  subfolders,
  isDarkBg,
  textColor,
  secondaryText,
  onOpenSubfolder,
}: GallerySubfolderGridProps) {
  if (!subfolders.length) return null;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-4">
      {subfolders.map((sf) => (
        <button
          key={sf.id}
          onClick={() => onOpenSubfolder?.(sf)}
          className="flex items-center gap-3 p-3 rounded-xl transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] text-left"
          style={{
            background: isDarkBg ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.9)',
            border: `1px solid ${isDarkBg ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)'}`,
            boxShadow: isDarkBg ? 'none' : '0 1px 3px rgba(0,0,0,0.06)'
          }}
        >
          <div className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: isDarkBg ? 'rgba(99,102,241,0.2)' : '#eef2ff' }}>
            <Icon name={sf.has_password ? 'FolderLock' : 'Folder'} size={20}
              style={{ color: isDarkBg ? '#a5b4fc' : '#6366f1' }} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate" style={{ color: textColor }}>{sf.folder_name}</p>
            <p className="text-xs" style={{ color: secondaryText }}>{sf.photo_count} фото</p>
          </div>
        </button>
      ))}
    </div>
  );
}
