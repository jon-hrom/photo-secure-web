import { useMemo } from 'react';
import { enableNotificationSound } from '@/utils/notificationSound';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';
import GalleryPhotoViewer from './GalleryPhotoViewer';
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

  // Собираем все вложения чата (фото и видео) в один список —
  // полноэкранный просмотр сможет листать стрелками между ними.
  const chatPhotos = useMemo(() => {
    return api.messages
      .filter((m) => m.image_url || m.video_url)
      .map((m) => {
        const url = (m.video_url || m.image_url) as string;
        const rawName = decodeURIComponent(url.split('/').pop() || '');
        const fileName = rawName.replace(/^[0-9a-f-]{8,}_/, '').trim() || 'Файл';
        return {
          id: m.id,
          file_name: fileName,
          photo_url: url,
          thumbnail_url: m.thumbnail_url || m.image_url || undefined,
          file_size: 0,
          is_video: !!m.video_url,
        };
      });
  }, [api.messages]);

  // По URL находим id сообщения, чтобы открыть просмотрщик именно на нём.
  const initialPhotoId = useMemo(() => {
    if (!api.fullscreenImage) return 0;
    const found = api.messages.find(
      (m) => m.image_url === api.fullscreenImage || m.video_url === api.fullscreenImage,
    );
    return found ? found.id : (chatPhotos[0]?.id || 0);
  }, [api.fullscreenImage, api.messages, chatPhotos]);

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

  const viewer = api.fullscreenImage && chatPhotos.length > 0 ? (
    <GalleryPhotoViewer
      photos={chatPhotos}
      initialPhotoId={initialPhotoId}
      onClose={() => api.setFullscreenImage(null)}
    />
  ) : null;

  if (embedded) {
    return (
      <>
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
        {viewer}
      </>
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
      {viewer}
    </>
  );
}