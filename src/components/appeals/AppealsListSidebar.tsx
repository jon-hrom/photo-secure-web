import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import Icon from '@/components/ui/icon';
import { Appeal, GroupedAppeals } from './types';

interface AppealsListSidebarProps {
  appeals: Appeal[];
  showArchived: boolean;
  selectedAppeal: Appeal | null;
  expandedUser: string | null;
  loading: boolean;
  onToggleArchive: (show: boolean) => void;
  onSelectAppeal: (appeal: Appeal) => void;
  onToggleUserExpanded: (userIdentifier: string) => void;
  onMarkAsRead: (appealId: number) => void;
  onMarkAllAsRead: (userIdentifier: string) => void;
  groupAppealsByUser: (appeals: Appeal[]) => GroupedAppeals[];
  formatDate: (dateString: string) => string;
}

const AppealsListSidebar = ({
  appeals,
  showArchived,
  selectedAppeal,
  expandedUser,
  loading,
  onToggleArchive,
  onSelectAppeal,
  onToggleUserExpanded,
  onMarkAsRead,
  onMarkAllAsRead,
  groupAppealsByUser,
  formatDate,
}: AppealsListSidebarProps) => {
  const filteredAppeals = appeals.filter(a => 
    showArchived ? a.is_archived : !a.is_archived
  );
  const grouped = groupAppealsByUser(filteredAppeals);

  return (
    <>
      <div className="flex items-center gap-2 mb-3 px-1">
        <Button
          variant={showArchived ? 'outline' : 'default'}
          size="sm"
          onClick={() => onToggleArchive(false)}
          className="text-xs"
        >
          <Icon name="Inbox" size={14} className="mr-1" />
          Активные
        </Button>
        <Button
          variant={showArchived ? 'default' : 'outline'}
          size="sm"
          onClick={() => onToggleArchive(true)}
          className="text-xs"
        >
          <Icon name="Archive" size={14} className="mr-1" />
          Архив
        </Button>
      </div>

      <ScrollArea className={`h-full pr-0 sm:pr-3 ${
        selectedAppeal ? 'hidden sm:block' : 'block'
      }`}>
        <div className="space-y-2">
          {appeals.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Icon name="Inbox" size={48} className="mx-auto mb-4 opacity-30" />
              <p>Нет обращений</p>
            </div>
          ) : (
            grouped.map((group) => (
              <div key={group.userIdentifier} className="border rounded-lg overflow-hidden">
                <div
                  onClick={() => {
                    if (expandedUser === group.userIdentifier) {
                      onToggleUserExpanded('');
                    } else {
                      onToggleUserExpanded(group.userIdentifier);
                    }
                  }}
                  className={`p-3 cursor-pointer transition-colors ${
                    group.unreadCount > 0
                      ? 'bg-amber-50 hover:bg-amber-100 border-l-4 border-l-amber-400'
                      : 'bg-gray-50 hover:bg-gray-100'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <Icon 
                        name={expandedUser === group.userIdentifier ? 'ChevronDown' : 'ChevronRight'} 
                        size={16}
                        className="shrink-0"
                      />
                      <Icon 
                        name={group.isBlocked ? 'ShieldAlert' : 'User'} 
                        size={16} 
                        className={`shrink-0 ${group.isBlocked ? 'text-red-600' : 'text-blue-600'}`}
                      />
                      <span className="font-semibold text-xs sm:text-sm truncate">
                        {group.userEmail || group.userIdentifier}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {group.unreadCount > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {group.unreadCount}
                        </Badge>
                      )}
                      <Badge variant="outline" className="text-xs">
                        {group.totalCount}
                      </Badge>
                    </div>
                  </div>
                </div>

                {expandedUser === group.userIdentifier && (
                  <div className="border-t">
                    <div className="p-2 bg-muted/50 flex items-center gap-1 border-b">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          onMarkAllAsRead(group.userIdentifier);
                        }}
                        disabled={loading || group.unreadCount === 0}
                        className="h-7 text-xs"
                      >
                        <Icon name="CheckCheck" size={12} className="mr-1" />
                        Все прочитано
                      </Button>
                    </div>
                    {group.appeals.map((appeal) => (
                      <div
                        key={appeal.id}
                        onClick={() => {
                          onSelectAppeal(appeal);
                          if (!appeal.is_read) {
                            onMarkAsRead(appeal.id);
                          }
                        }}
                        className={`p-3 cursor-pointer transition-colors border-b last:border-b-0 ${
                          selectedAppeal?.id === appeal.id
                            ? 'bg-blue-100'
                            : !appeal.is_read
                            ? 'bg-amber-50 hover:bg-amber-100'
                            : 'bg-white hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start justify-between mb-1">
                          <p className="text-xs sm:text-sm text-muted-foreground line-clamp-2 flex-1">
                            {appeal.message}
                          </p>
                          {!appeal.is_read && (
                            <Badge variant="destructive" className="text-xs ml-2 shrink-0">Новое</Badge>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{formatDate(appeal.created_at)}</span>
                          {appeal.admin_response && (
                            <Badge variant="outline" className="text-xs">
                              <Icon name="CheckCheck" size={10} className="mr-1" />
                              Отвечено
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </>
  );
};

export default AppealsListSidebar;
