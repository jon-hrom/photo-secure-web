import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Document } from '@/components/clients/ClientsTypes';

interface DocumentListItemProps {
  doc: Document;
  index: number;
  formatDate: (dateString: string) => string;
  onPreview: (doc: Document, index: number) => void;
  onDelete: (documentId: number, documentName: string) => void;
  getFileIcon: (filename: string) => string;
}

const DocumentListItem = ({
  doc,
  index,
  formatDate,
  onPreview,
  onDelete,
  getFileIcon,
}: DocumentListItemProps) => {
  return (
    <div className="border rounded-lg p-3 flex items-center justify-between hover:bg-accent/50 transition-colors">
      <div 
        className="flex items-center gap-3 flex-1 min-w-0 cursor-pointer"
        onClick={() => onPreview(doc, index)}
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
            onPreview(doc, index);
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
            onDelete(doc.id, doc.name);
          }}
        >
          <Icon name="Trash2" size={16} className="text-destructive" />
        </Button>
      </div>
    </div>
  );
};

export default DocumentListItem;
