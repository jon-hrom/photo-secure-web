import { useAppeals } from './appeals/useAppeals';
import { useFloatingDrag } from './appeals/useFloatingDrag';
import FloatingButton from './appeals/FloatingButton';
import AppealsDialog from './appeals/AppealsDialog';

interface FloatingAppealsButtonProps {
  userId: number;
  isAdmin: boolean;
  onClickOverride?: () => void;
  extraUnread?: number;
  onOpenTickets?: () => void;
  openSignal?: number;
}

const FloatingAppealsButton = ({ userId, isAdmin, onClickOverride, extraUnread = 0, onOpenTickets, openSignal }: FloatingAppealsButtonProps) => {
  const {
    appeals,
    showDialog,
    setShowDialog,
    unreadCount,
    loading,
    responseText,
    setResponseText,
    selectedAppeal,
    setSelectedAppeal,
    expandedUser,
    setExpandedUser,
    showArchived,
    setShowArchived,
    markAsRead,
    sendResponse,
    decideRegistration,
    formatDate,
    groupAppealsByUser,
    archiveAppeal,
    deleteAppeal,
    markAllAsRead,
  } = useAppeals({ userId, isAdmin, openSignal });

  const { isDragging, position, handleMouseDown } = useFloatingDrag();

  const handleClick = () => {
    if (!isDragging) {
      if (onClickOverride) {
        onClickOverride();
      } else {
        setShowDialog(true);
      }
    }
  };

  if (!isAdmin) {
    console.log('[APPEALS_BTN] Not rendering - isAdmin:', isAdmin);
    return null;
  }

  return (
    <>
      <FloatingButton
        isDragging={isDragging}
        position={position}
        badgeCount={unreadCount + extraUnread}
        onMouseDown={handleMouseDown}
        onClick={handleClick}
      />

      <AppealsDialog
        showDialog={showDialog}
        setShowDialog={setShowDialog}
        appeals={appeals}
        unreadCount={unreadCount}
        extraUnread={extraUnread}
        onOpenTickets={onOpenTickets}
        showArchived={showArchived}
        selectedAppeal={selectedAppeal}
        expandedUser={expandedUser}
        loading={loading}
        responseText={responseText}
        setShowArchived={setShowArchived}
        setSelectedAppeal={setSelectedAppeal}
        setExpandedUser={setExpandedUser}
        setResponseText={setResponseText}
        markAsRead={markAsRead}
        markAllAsRead={markAllAsRead}
        archiveAppeal={archiveAppeal}
        deleteAppeal={deleteAppeal}
        sendResponse={sendResponse}
        decideRegistration={decideRegistration}
        groupAppealsByUser={groupAppealsByUser}
        formatDate={formatDate}
      />
    </>
  );
};

export default FloatingAppealsButton;
