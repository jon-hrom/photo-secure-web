import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Icon from '@/components/ui/icon';

interface Meeting {
  id: number;
  name: string;
  date: string;
  time: string;
  type: string;
}

interface DashboardMeetingsProps {
  upcomingMeetings: Meeting[];
  onMeetingClick: (clientName: string) => void;
}

const DashboardMeetings = ({ upcomingMeetings, onMeetingClick }: DashboardMeetingsProps) => {
  return (
    <Card className="shadow-lg border-2">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Icon name="Calendar" className="mr-2 text-primary" size={20} />
          <span className="text-base md:text-xl">Ближайшие встречи</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 md:space-y-3 max-h-96 overflow-y-auto pr-1 md:pr-2">
          {upcomingMeetings.length > 0 ? (
            upcomingMeetings.map((meeting) => (
              <div
                key={meeting.id}
                onClick={() => onMeetingClick(meeting.name)}
                className="flex items-center justify-between p-2 md:p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors cursor-pointer hover:shadow-md"
              >
                <div className="flex items-center space-x-2 md:space-x-3 min-w-0">
                  <div className="bg-primary/10 p-1.5 md:p-2 rounded-full flex-shrink-0">
                    <Icon name="User" size={16} className="text-primary md:w-[18px] md:h-[18px]" />
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold text-sm md:text-base truncate">{meeting.name}</p>
                    <p className="text-xs md:text-sm text-muted-foreground truncate">{meeting.type}</p>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 ml-2">
                  <p className="text-xs md:text-sm font-medium whitespace-nowrap">{meeting.date}</p>
                  <p className="text-xs md:text-sm text-muted-foreground">{meeting.time}</p>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-6 md:py-8 text-center px-4">
              <div className="bg-muted rounded-full p-3 md:p-4 mb-3 md:mb-4">
                <Icon name="CalendarX" size={24} className="text-muted-foreground md:w-8 md:h-8" />
              </div>
              <p className="text-muted-foreground mb-1 md:mb-2 text-sm md:text-base">Нет запланированных встреч</p>
              <p className="text-xs md:text-sm text-muted-foreground">Добавьте новых клиентов и назначьте встречи</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default DashboardMeetings;
