import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Appeal, GroupedAppeals } from './types';
import AppealsListSidebar from './AppealsListSidebar';
import AppealDetail from './AppealDetail';

interface AppealsDialogProps {
  showDialog: boolean;
  setShowDialog: (open: boolean) => void;
  appeals: Appeal[];
  unreadCount: number;
  extraUnread: number;
  onOpenTickets?: () => void;
  showArchived: boolean;
  selectedAppeal: Appeal | null;
  expandedUser: string | null;
  loading: boolean;
  responseText: string;
  setShowArchived: (value: boolean) => void;
  setSelectedAppeal: (appeal: Appeal | null) => void;
  setExpandedUser: (value: string | null) => void;
  setResponseText: (value: string) => void;
  markAsRead: (appealId: number) => void;
  markAllAsRead: (userIdentifier: string) => void;
  archiveAppeal: (appealId: number) => void;
  deleteAppeal: (appealId: number) => void;
  sendResponse: (appeal: Appeal, mode?: 'email' | 'chat') => void;
  decideRegistration: (appeal: Appeal, approve: boolean) => void;
  groupAppealsByUser: (appeals: Appeal[]) => GroupedAppeals[];
  formatDate: (dateString: string) => string;
}

const AppealsDialog = ({
  showDialog,
  setShowDialog,
  appeals,
  unreadCount,
  extraUnread,
  onOpenTickets,
  showArchived,
  selectedAppeal,
  expandedUser,
  loading,
  responseText,
  setShowArchived,
  setSelectedAppeal,
  setExpandedUser,
  setResponseText,
  markAsRead,
  markAllAsRead,
  archiveAppeal,
  deleteAppeal,
  sendResponse,
  decideRegistration,
  groupAppealsByUser,
  formatDate,
}: AppealsDialogProps) => {
  return (
    <Dialog open={showDialog} onOpenChange={setShowDialog}>
      <DialogContent className="max-w-5xl h-[92vh] max-h-[92vh] overflow-hidden sm:max-w-[95vw] flex flex-col">
        <DialogHeader className="border-b pb-3">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2 sm:gap-3 text-base sm:text-xl">
              <Icon name="Mail" size={24} className="text-blue-600 sm:hidden" />
              <Icon name="Mail" size={28} className="text-blue-600 hidden sm:block" />
              <span className="hidden sm:inline">Обращения пользователей</span>
              <span className="sm:hidden">Обращения</span>
              {unreadCount > 0 && (
                <Badge variant="destructive" className="text-xs sm:text-sm px-2 sm:px-3 py-1">
                  {unreadCount}
                </Badge>
              )}
            </DialogTitle>
            <div className="flex items-center gap-2">
              {onOpenTickets && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setShowDialog(false); onOpenTickets(); }}
                  className="h-9 gap-1.5 relative"
                >
                  <Icon name="LifeBuoy" size={16} className="text-primary" />
                  <span className="hidden sm:inline">Тикеты поддержки</span>
                  <span className="sm:hidden">Тикеты</span>
                  {extraUnread > 0 && (
                    <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-[11px] h-5 min-w-5 flex items-center justify-center">
                      {extraUnread}
                    </Badge>
                  )}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowDialog(false)}
                className="sm:hidden h-8 w-8 p-0"
              >
                <Icon name="X" size={20} />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 h-[calc(90vh-140px)]">
          <div className="flex flex-col min-h-0 overflow-hidden">
            <AppealsListSidebar
              appeals={appeals}
              showArchived={showArchived}
              selectedAppeal={selectedAppeal}
              expandedUser={expandedUser}
              loading={loading}
              onToggleArchive={setShowArchived}
              onSelectAppeal={setSelectedAppeal}
              onToggleUserExpanded={setExpandedUser}
              onMarkAsRead={markAsRead}
              onMarkAllAsRead={markAllAsRead}
              groupAppealsByUser={groupAppealsByUser}
              formatDate={formatDate}
            />
          </div>

          <div className={`border-l-0 sm:border-l sm:border-border sm:pl-4 min-h-0 overflow-hidden ${
            selectedAppeal ? 'block' : 'hidden sm:block'
          }`}>
            <AppealDetail
              selectedAppeal={selectedAppeal}
              responseText={responseText}
              loading={loading}
              onBack={() => setSelectedAppeal(null)}
              onMarkAsRead={markAsRead}
              onArchive={archiveAppeal}
              onDelete={deleteAppeal}
              onResponseChange={setResponseText}
              onSendResponse={sendResponse}
              onApproveRegistration={(a) => decideRegistration(a, true)}
              onRejectRegistration={(a) => decideRegistration(a, false)}
              formatDate={formatDate}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AppealsDialog;
