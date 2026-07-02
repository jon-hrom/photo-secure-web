import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';

export interface DayEvent {
  time: string;
  ts_local: string;
  type: string | null;
  act: string | null;
  page: string | null;
  details: unknown;
  ip: string | null;
}

interface AuditDayDialogProps {
  day: string | null;
  events: DayEvent[];
  loading: boolean;
  onClose: () => void;
}

const eventIcon = (type: string | null): string => {
  if (type === 'page_view') return 'Eye';
  if (type === 'click') return 'MousePointerClick';
  if (type === 'consent') return 'ShieldCheck';
  if (type === 'payment' || type === 'renew') return 'CreditCard';
  return 'Activity';
};

const AuditDayDialog = ({ day, events, loading, onClose }: AuditDayDialogProps) => {
  return (
    <Dialog open={!!day} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="CalendarDays" size={18} className="text-primary" />
            Активность за {day}
            <span className="ml-auto text-xs text-muted-foreground font-normal">
              время UTC+4
            </span>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
          </div>
        ) : events.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">Записей нет</div>
        ) : (
          <div className="overflow-y-auto -mx-2 px-2 divide-y">
            {events.map((e, i) => (
              <div key={i} className="py-2.5 flex items-start gap-3 text-sm">
                <Icon
                  name={eventIcon(e.type)}
                  size={15}
                  className="text-muted-foreground mt-0.5 shrink-0"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-mono text-xs text-primary shrink-0">{e.time}</span>
                    <span className="truncate">{e.act || e.type}</span>
                  </div>
                  <div className="text-muted-foreground text-xs truncate">
                    {e.page ? `${e.page}` : ''}
                    {e.ip ? `${e.page ? ' · ' : ''}IP: ${e.ip}` : ''}
                  </div>
                  {e.details != null && (
                    <div className="text-muted-foreground/80 text-[11px] mt-0.5 break-words">
                      {typeof e.details === 'string' ? e.details : JSON.stringify(e.details)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AuditDayDialog;
