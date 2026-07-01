import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import MeetingCard from './MeetingCard';
import { Meeting } from '@/components/clients/dialog/MeetingService';

interface MeetingsSectionProps {
  activeMeetings: Meeting[];
  cancelledMeetings: Meeting[];
  onSave: (id: number, updates: Partial<Meeting>) => void;
  onCancel: (id: number, reason: string) => void;
  onDelete: (id: number) => void;
}

const MeetingsSection = ({
  activeMeetings,
  cancelledMeetings,
  onSave,
  onCancel,
  onDelete,
}: MeetingsSectionProps) => {
  if (activeMeetings.length === 0 && cancelledMeetings.length === 0) return null;

  return (
    <div className="mt-6 space-y-2">
      <div className="flex items-center gap-2 text-sm font-medium text-violet-600 dark:text-violet-400">
        <Icon name="Handshake" size={16} />
        Встречи
        <Badge variant="secondary" className="text-xs">{activeMeetings.length}</Badge>
      </div>
      {activeMeetings.map((m) => (
        <MeetingCard
          key={`meeting-${m.id}`}
          meeting={m}
          onSave={onSave}
          onCancel={onCancel}
          onDelete={onDelete}
        />
      ))}
      {cancelledMeetings.length > 0 && (
        <div className="pt-1 space-y-2">
          <div className="text-xs text-muted-foreground">Отменённые встречи</div>
          {cancelledMeetings.map((m) => (
            <MeetingCard
              key={`meeting-${m.id}`}
              meeting={m}
              onSave={onSave}
              onCancel={onCancel}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default MeetingsSection;
