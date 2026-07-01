import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import { getUserTimezoneShort } from '@/utils/regionTimezone';
import DurationSelect from './DurationSelect';
import { NewMeetingDraft } from './newProjectFormTypes';

interface MeetingFormFieldsProps {
  newMeeting: NewMeetingDraft;
  updateMeeting: (patch: Partial<NewMeetingDraft>) => void;
}

const MeetingFormFields = ({ newMeeting, updateMeeting }: MeetingFormFieldsProps) => {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <div className="space-y-1 md:col-span-3">
          <Label className="text-xs">Название встречи</Label>
          <Input
            value={newMeeting.name}
            onChange={(e) => updateMeeting({ name: e.target.value })}
            placeholder="Обсуждение съёмки"
            className="text-xs h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Дата встречи *</Label>
          <Input
            type="date"
            min="2020-01-01"
            max="2099-12-31"
            value={newMeeting.meeting_date}
            onChange={(e) => updateMeeting({ meeting_date: e.target.value })}
            className="text-xs h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Время <span className="text-muted-foreground font-normal">({getUserTimezoneShort()})</span></Label>
          <Input
            type="time"
            value={newMeeting.meeting_time}
            onChange={(e) => updateMeeting({ meeting_time: e.target.value })}
            className="text-xs h-9"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Длительность (минуты)</Label>
          <DurationSelect
            value={newMeeting.duration || 60}
            onChange={(d) => updateMeeting({ duration: d })}
          />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Адрес встречи</Label>
        <Input
          type="text"
          value={newMeeting.address}
          onChange={(e) => updateMeeting({ address: e.target.value })}
          placeholder="Кафе на Тверской, Москва"
          className="text-xs h-9"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Описание</Label>
        <Textarea
          value={newMeeting.description}
          onChange={(e) => updateMeeting({ description: e.target.value })}
          placeholder="О чём встреча..."
          rows={2}
          className="text-xs"
        />
      </div>
      <div className="rounded-lg border border-border/60 p-3 space-y-1">
        <Label className="text-xs flex items-center gap-1.5">
          <Icon name="BellRing" size={13} className="text-violet-500" />
          Доп. напоминание фотографу
        </Label>
        <Input
          type="datetime-local"
          value={newMeeting.custom_reminder_at}
          onChange={(e) => updateMeeting({ custom_reminder_at: e.target.value })}
          className="text-xs h-9"
        />
        <p className="text-[10px] text-muted-foreground">
          Кроме стандартных (за сутки и за 5 часов) — придёт вам в указанное время
        </p>
      </div>
    </div>
  );
};

export default MeetingFormFields;
