import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Icon from '@/components/ui/icon';
import { enableNotificationSound } from '@/utils/notificationSound';
import ChatMessageList from './ChatMessageList';
import ChatInput from './ChatInput';
import FullscreenImage from './FullscreenImage';
import MessageContextMenu from './chat/MessageContextMenu';
import { copyTextToBuffer } from './chat/clipboardBuffer';
import type { ChatAction, ChatMessageData } from './chat/types';

type Message = ChatMessageData;

interface GalleryPhoto {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
}

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

const CHAT_API = 'https://functions.poehali.dev/a083483c-6e5e-4fbc-a120-e896c9bf0a86';

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
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedImages, setSelectedImages] = useState<{dataUrl: string; fileName: string; file?: File}[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [isOpponentTyping, setIsOpponentTyping] = useState(false);
  const [loadedPhotos, setLoadedPhotos] = useState<GalleryPhoto[]>([]);

  // новая функциональность
  const [menuState, setMenuState] = useState<{ id: number; x: number; y: number } | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [highlightedId, setHighlightedId] = useState<number | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageContainerRef = useRef<HTMLDivElement>(null);
  const previousMessageCountRef = useRef<number>(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resolvedPhotos = galleryPhotos.length > 0 ? galleryPhotos : loadedPhotos;

  useEffect(() => {
    if (isOpen && galleryPhotos.length === 0 && clientId && photographerId) {
      fetch(`https://functions.poehali.dev/e3fad9a4-861a-401e-b4d2-0cd9dd4d7671?client_id=${clientId}&photographer_id=${photographerId}`)
        .then(r => r.json())
        .then(data => {
          if (data.photos) setLoadedPhotos(data.photos);
        })
        .catch(() => {});
    }
  }, [isOpen, clientId, photographerId, galleryPhotos.length]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadMessages = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const response = await fetch(
        `${CHAT_API}?client_id=${clientId}&photographer_id=${photographerId}&viewer_type=${senderType}`
      );
      if (!response.ok) throw new Error('Ошибка загрузки сообщений');
      const data = await response.json();
      const newMessages: Message[] = data.messages || [];
      previousMessageCountRef.current = newMessages.length;
      setMessages(newMessages);
      if (!silent) setTimeout(scrollToBottom, 100);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [clientId, photographerId, senderType]);

  const markAsRead = useCallback(async () => {
    try {
      const oppositeType = senderType === 'client' ? 'photographer' : 'client';
      await fetch(`${CHAT_API}?action=mark_read&client_id=${clientId}&photographer_id=${photographerId}&sender_type=${oppositeType}`);
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  }, [clientId, photographerId, senderType]);

  const updateTypingStatus = useCallback(async (isTyping: boolean) => {
    try {
      await fetch(`${CHAT_API}?action=typing&client_id=${clientId}&photographer_id=${photographerId}&sender_type=${senderType}&is_typing=${isTyping}`);
    } catch (error) {
      console.error('Error updating typing status:', error);
    }
  }, [clientId, photographerId, senderType]);

  const checkOpponentTyping = useCallback(async () => {
    try {
      const response = await fetch(`${CHAT_API}?action=check_typing&client_id=${clientId}&photographer_id=${photographerId}&sender_type=${senderType}`);
      const data = await response.json();
      setIsOpponentTyping(data.is_typing || false);
    } catch (error) {
      console.error('Error checking typing status:', error);
    }
  }, [clientId, photographerId, senderType]);

  const handleInputChange = (value: string) => {
    setNewMessage(value);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (value.trim().length > 0) {
      updateTypingStatus(true);
      typingTimeoutRef.current = setTimeout(() => updateTypingStatus(false), 3000);
    } else {
      updateTypingStatus(false);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const newImages: {dataUrl: string; fileName: string; file?: File}[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.type.startsWith('video/');
      const maxSize = isVideo ? Infinity : 50 * 1024 * 1024;
      if (file.size > maxSize) {
        alert(`Файл ${file.name} слишком большой. Максимальный размер: 50 МБ`);
        continue;
      }
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });
      newImages.push({ dataUrl, fileName: file.name, file });
    }
    setSelectedImages(prev => [...prev, ...newImages]);
  };

  const sendMessage = async () => {
    if ((!newMessage.trim() && selectedImages.length === 0 && !editingId) || sending) return;

    // Режим редактирования
    if (editingId) {
      if (!newMessage.trim()) return;
      try {
        setSending(true);
        const url = `${CHAT_API}?action=edit_message&client_id=${clientId}&photographer_id=${photographerId}&viewer_type=${senderType}&message_id=${editingId}&new_text=${encodeURIComponent(newMessage.trim())}`;
        const resp = await fetch(url);
        if (!resp.ok) throw new Error('edit failed');
        setEditingId(null);
        setNewMessage('');
        await loadMessages(true);
      } catch (e) {
        console.error(e);
        alert('Не удалось отредактировать сообщение');
      } finally {
        setSending(false);
      }
      return;
    }

    try {
      setSending(true);
      const base64Images: string[] = [];
      const fileNames: string[] = [];
      if (selectedImages.length > 0) {
        for (const img of selectedImages) {
          base64Images.push(img.dataUrl);
          fileNames.push(img.fileName);
        }
      }
      const body: Record<string, unknown> = {
        client_id: clientId,
        photographer_id: photographerId,
        message: newMessage.trim(),
        sender_type: senderType,
      };
      if (replyTo) body.reply_to_id = replyTo.id;
      if (base64Images.length > 0) {
        body.images_base64 = base64Images;
        body.file_names = fileNames;
      }
      const response = await fetch(CHAT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Ошибка отправки сообщения');
      setNewMessage('');
      setSelectedImages([]);
      setReplyTo(null);
      await loadMessages();
      if (onMessageSent) onMessageSent();
    } catch (error) {
      console.error('Error sending message:', error);
      alert('Ошибка при отправке сообщения');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleImageRemove = (index: number) => {
    setSelectedImages(prev => prev.filter((_, i) => i !== index));
  };

  // Открытие контекстного меню
  const handleOpenMenu = useCallback((id: number, pos: { x: number; y: number }) => {
    setMenuState({ id, x: pos.x, y: pos.y });
  }, []);

  const activeMessage = useMemo(
    () => (menuState ? messages.find(m => m.id === menuState.id) : null),
    [menuState, messages]
  );

  // Прыжок к исходному сообщению при клике на reply-превью
  const jumpToMessage = useCallback((id: number) => {
    const el = messageContainerRef.current?.querySelector(`[data-message-id="${id}"]`);
    if (el) {
      (el as HTMLElement).scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedId(id);
      setTimeout(() => setHighlightedId(null), 1500);
    }
  }, []);

  const toggleSelect = useCallback((id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
  };

  const removeMessages = async (ids: number[], forAll: boolean) => {
    if (ids.length === 0) return;
    const action = forAll ? 'remove_for_all' : 'remove_for_me';
    try {
      const url = `${CHAT_API}?action=${action}&client_id=${clientId}&photographer_id=${photographerId}&viewer_type=${senderType}&message_ids=${ids.join(',')}`;
      const resp = await fetch(url);
      if (!resp.ok) throw new Error('remove failed');
      await loadMessages(true);
    } catch (e) {
      console.error(e);
      alert('Не удалось удалить сообщения');
    }
  };

  const handleAction = async (action: ChatAction) => {
    const target = activeMessage;
    setMenuState(null);
    if (!target) return;

    switch (action) {
      case 'reply':
        setEditingId(null);
        setReplyTo(target);
        break;
      case 'edit':
        setReplyTo(null);
        setEditingId(target.id);
        setNewMessage(target.message || '');
        break;
      case 'copy':
        await copyTextToBuffer(target.message || '');
        break;
      case 'remove_me':
        await removeMessages([target.id], false);
        break;
      case 'remove_all':
        if (confirm('Удалить сообщение у всех?')) {
          await removeMessages([target.id], true);
        }
        break;
      case 'select':
        setSelectionMode(true);
        setSelectedIds(new Set([target.id]));
        break;
      case 'forward': {
        const text = target.message || '';
        if (text) {
          setNewMessage((prev) => (prev ? `${prev}\n\n${text}` : `📩 ${text}`));
        }
        break;
      }
      case 'pin':
        alert('Закрепление сообщений скоро появится');
        break;
    }
  };

  const handleBulkCopy = async () => {
    const ids = Array.from(selectedIds);
    const texts = messages
      .filter(m => ids.includes(m.id) && m.message)
      .map(m => m.message)
      .join('\n\n');
    if (texts) await copyTextToBuffer(texts);
    exitSelectionMode();
  };

  const handleBulkRemove = async (forAll: boolean) => {
    const ids = Array.from(selectedIds);
    if (forAll && !confirm('Удалить выбранные сообщения у всех?')) return;
    // для "у всех" отдаём только свои
    const eligibleIds = forAll
      ? messages.filter(m => ids.includes(m.id) && m.sender_type === senderType).map(m => m.id)
      : ids;
    await removeMessages(eligibleIds, forAll);
    exitSelectionMode();
  };

  useEffect(() => {
    if (isOpen) {
      enableNotificationSound();
      loadMessages();
      markAsRead();
      const interval = setInterval(() => {
        loadMessages(true);
        markAsRead();
        checkOpponentTyping();
      }, 6000);
      return () => {
        clearInterval(interval);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        updateTypingStatus(false);
      };
    }
  }, [isOpen, clientId, photographerId, loadMessages, markAsRead, checkOpponentTyping, updateTypingStatus]);

  if (!isOpen) return null;

  const replyBanner = replyTo
    ? { id: replyTo.id, text: replyTo.message || (replyTo.image_url ? 'Вложение' : ''), sender_type: replyTo.sender_type }
    : null;

  const selectionBar = selectionMode && (
    <div className="flex items-center gap-1 p-2 border-b bg-blue-50 dark:bg-blue-950/40">
      <button
        type="button"
        onClick={exitSelectionMode}
        className="p-2 rounded hover:bg-black/5"
        aria-label="Выйти из режима выбора"
      >
        <Icon name="X" size={18} />
      </button>
      <span className="text-sm font-medium flex-1">Выбрано: {selectedIds.size}</span>
      <button
        type="button"
        onClick={() => setSelectedIds(new Set(messages.map(m => m.id)))}
        className="p-2 rounded hover:bg-black/5"
        title="Выбрать все"
      >
        <Icon name="CheckSquare" size={18} />
      </button>
      <button
        type="button"
        onClick={handleBulkCopy}
        disabled={selectedIds.size === 0}
        className="p-2 rounded hover:bg-black/5 disabled:opacity-40"
        title="Скопировать"
      >
        <Icon name="Copy" size={18} />
      </button>
      <button
        type="button"
        onClick={() => handleBulkRemove(false)}
        disabled={selectedIds.size === 0}
        className="p-2 rounded hover:bg-black/5 disabled:opacity-40 text-red-600"
        title="Удалить у себя"
      >
        <Icon name="Trash2" size={18} />
      </button>
      <button
        type="button"
        onClick={() => handleBulkRemove(true)}
        disabled={selectedIds.size === 0}
        className="p-2 rounded hover:bg-black/5 disabled:opacity-40 text-red-600"
        title="Удалить у всех"
      >
        <Icon name="Trash" size={18} />
      </button>
    </div>
  );

  const listProps = {
    messages,
    loading,
    senderType,
    onImageClick: setFullscreenImage,
    isOpponentTyping,
    clientName,
    photographerName,
    timezone,
    galleryPhotos: resolvedPhotos,
    selectionMode,
    selectedIds,
    onToggleSelect: toggleSelect,
    onOpenMenu: handleOpenMenu,
    onJumpToMessage: jumpToMessage,
    highlightedId,
  };

  if (embedded) {
    return (
      <div className="w-full h-full flex flex-col bg-background">
        <div className="hidden md:flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Icon name="MessageCircle" size={24} className="text-primary" />
            <h2 className="text-xl font-semibold">
              {senderType === 'photographer' ? clientName || 'Чат с клиентом' : 'ЧАТ С ФОТОГРАФОМ'}
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 hover:bg-muted rounded-full transition-colors touch-manipulation"
          >
            <Icon name="X" size={20} className="text-muted-foreground" />
          </button>
        </div>

        {selectionBar}

        <div
          ref={messageContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-3 bg-muted/30"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <ChatMessageList variant="embedded" {...listProps} ref={messagesEndRef} />
        </div>

        <ChatInput
          newMessage={newMessage}
          onMessageChange={handleInputChange}
          onSend={sendMessage}
          onKeyPress={handleKeyPress}
          selectedImages={selectedImages}
          onImageSelect={handleImageSelect}
          onImageRemove={handleImageRemove}
          sending={sending}
          onFocus={enableNotificationSound}
          variant="embedded"
          replyTo={replyBanner}
          onCancelReply={() => setReplyTo(null)}
          editingId={editingId}
          onCancelEdit={() => { setEditingId(null); setNewMessage(''); }}
        />

        {menuState && activeMessage && (
          <MessageContextMenu
            x={menuState.x}
            y={menuState.y}
            canEdit={activeMessage.sender_type === senderType && !activeMessage.image_url && !activeMessage.video_url}
            canRemoveForAll={activeMessage.sender_type === senderType}
            hasText={!!activeMessage.message}
            onClose={() => setMenuState(null)}
            onAction={handleAction}
          />
        )}
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-900 rounded-t-lg sm:rounded-lg shadow-xl w-full max-w-2xl h-[90vh] sm:max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ maxHeight: 'calc(100vh - env(safe-area-inset-top))' }}
      >
        <div className="flex items-center justify-between p-3 sm:p-4 border-b dark:border-gray-800 safe-top">
          <div className="flex items-center gap-2">
            <Icon name="MessageCircle" size={24} className="text-blue-500" />
            <h2 className="text-base sm:text-xl font-semibold text-gray-900 dark:text-white truncate">
              {senderType === 'photographer' ? clientName || 'Чат с клиентом' : 'ЧАТ С ФОТОГРАФОМ'}
            </h2>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors touch-manipulation"
          >
            <Icon name="X" size={20} className="text-gray-500" />
          </button>
        </div>

        {selectionBar}

        <div
          ref={messageContainerRef}
          className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3 overscroll-contain"
          style={{ WebkitOverflowScrolling: 'touch' }}
        >
          <ChatMessageList variant="default" {...listProps} ref={messagesEndRef} />
        </div>

        <ChatInput
          newMessage={newMessage}
          onMessageChange={handleInputChange}
          onSend={sendMessage}
          onKeyPress={handleKeyPress}
          selectedImages={selectedImages}
          onImageSelect={handleImageSelect}
          onImageRemove={handleImageRemove}
          sending={sending}
          onFocus={enableNotificationSound}
          variant="default"
          replyTo={replyBanner}
          onCancelReply={() => setReplyTo(null)}
          editingId={editingId}
          onCancelEdit={() => { setEditingId(null); setNewMessage(''); }}
        />
      </div>

      {menuState && activeMessage && (
        <MessageContextMenu
          x={menuState.x}
          y={menuState.y}
          canEdit={activeMessage.sender_type === senderType && !activeMessage.image_url && !activeMessage.video_url}
          canRemoveForAll={activeMessage.sender_type === senderType}
          hasText={!!activeMessage.message}
          onClose={() => setMenuState(null)}
          onAction={handleAction}
        />
      )}

      {fullscreenImage && (
        <FullscreenImage
          imageUrl={fullscreenImage}
          onClose={() => setFullscreenImage(null)}
        />
      )}
    </div>
  );
}