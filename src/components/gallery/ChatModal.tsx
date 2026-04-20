import { enableNotificationSound } from '@/utils/notificationSound';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';
import FullscreenImage from './FullscreenImage';
import MessageContextMenu from './chat/MessageContextMenu';
import ChatSelectionBar from './chat/ChatSelectionBar';
import ChatModalLayout from './chat/ChatModalLayout';
import { useChatApi, type GalleryPhoto } from './chat/useChatApi';

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  clientId: number;
  photographerId: number;
  senderType: 'client' | 'photographer';
  clientName?: string;
  photographerName?: string;
  embedded?: boolean;
  onMessageSent?: () => void;
  timezone?: string;
  galleryPhotos?: GalleryPhoto[];
}

export default function ChatModal({
  isOpen,
  onClose,
  clientId,
  photographerId,
  senderType,
  clientName,
  photographerName,
  embedded = false,
  onMessageSent,
  timezone,
  galleryPhotos = []
}: ChatModalProps) {
  const api = useChatApi({
    isOpen,
    clientId,
    photographerId,
    senderType,
    galleryPhotos,
    onMessageSent,
  });

  if (!isOpen) return null;

  const title = senderType === 'photographer' ? clientName || 'Чат с клиентом' : 'ЧАТ С ФОТОГРАФОМ';

  const selectionBar = api.selectionMode ? (
    <ChatSelectionBar
      selectedCount={api.selectedIds.size}
      onExit={api.exitSelectionMode}
      onSelectAll={api.selectAll}
      onBulkCopy={api.handleBulkCopy}
      onBulkRemove={api.handleBulkRemove}
    />
  ) : null;

  const listProps = {
    messages: api.messages,
    loading: api.loading,
    senderType,
    onImageClick: api.setFullscreenImage,
    isOpponentTyping: api.isOpponentTyping,
    clientName,
    photographerName,
    timezone,
    galleryPhotos: api.resolvedPhotos,
    selectionMode: api.selectionMode,
    selectedIds: api.selectedIds,
    onToggleSelect: api.toggleSelect,
    onOpenMenu: api.handleOpenMenu,
    onJumpToMessage: api.jumpToMessage,
    highlightedId: api.highlightedId,
  };

  const input = (
    <ChatInput
      newMessage={api.newMessage}
      onMessageChange={api.handleInputChange}
      onSend={api.sendMessage}
      onKeyPress={api.handleKeyPress}
      selectedImages={api.selectedImages}
      onImageSelect={api.handleImageSelect}
      onImageRemove={api.handleImageRemove}
      sending={api.sending}
      onFocus={enableNotificationSound}
      variant={embedded ? 'embedded' : 'default'}
      replyTo={api.replyBanner}
      onCancelReply={() => api.setReplyTo(null)}
      editingId={api.editingId}
      onCancelEdit={() => { api.setEditingId(null); api.setNewMessage(''); }}
    />
  );

  const contextMenu = api.menuState && api.activeMessage && (
    <MessageContextMenu
      x={api.menuState.x}
      y={api.menuState.y}
      canEdit={api.activeMessage.sender_type === senderType && !api.activeMessage.image_url && !api.activeMessage.video_url}
      canRemoveForAll={api.activeMessage.sender_type === senderType}
      hasText={!!api.activeMessage.message}
      onClose={() => api.setMenuState(null)}
      onAction={api.handleAction}
    />
  );

  if (embedded) {
    return (
      <ChatModalLayout
        embedded
        title={title}
        onClose={onClose}
        selectionBar={selectionBar}
        input={input}
        containerRef={api.messageContainerRef}
      >
        <ChatMessageList variant="embedded" {...listProps} ref={api.messagesEndRef} />
        {contextMenu}
      </ChatModalLayout>
    );
  }

  return (
    <>
      <ChatModalLayout
        embedded={false}
        title={title}
        onClose={onClose}
        onBackdropClick={onClose}
        selectionBar={selectionBar}
        input={input}
        containerRef={api.messageContainerRef}
      >
        <ChatMessageList variant="default" {...listProps} ref={api.messagesEndRef} />
      </ChatModalLayout>

      {contextMenu}

      {api.fullscreenImage && (
        <FullscreenImage
          imageUrl={api.fullscreenImage}
          onClose={() => api.setFullscreenImage(null)}
        />
      )}
    </>
  );
}
