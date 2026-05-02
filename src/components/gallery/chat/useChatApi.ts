import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { enableNotificationSound } from '@/utils/notificationSound';
import { copyTextToBuffer } from './clipboardBuffer';
import type { ChatAction, ChatMessageData } from './types';

export type Message = ChatMessageData;

export interface GalleryPhoto {
  id: number;
  file_name: string;
  photo_url: string;
  thumbnail_url?: string;
}

interface UseChatApiParams {
  isOpen: boolean;
  clientId: number;
  photographerId: number;
  senderType: 'client' | 'photographer';
  galleryPhotos: GalleryPhoto[];
  onMessageSent?: () => void;
}

const CHAT_API = 'https://functions.poehali.dev/a083483c-6e5e-4fbc-a120-e896c9bf0a86';

export function useChatApi({
  isOpen,
  clientId,
  photographerId,
  senderType,
  galleryPhotos,
  onMessageSent,
}: UseChatApiParams) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedImages, setSelectedImages] = useState<{dataUrl: string; fileName: string; file?: File}[]>([]);
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [isOpponentTyping, setIsOpponentTyping] = useState(false);
  const [loadedPhotos, setLoadedPhotos] = useState<GalleryPhoto[]>([]);

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
      const uploadedUrls: string[] = [];
      const fallbackBase64: string[] = [];
      const fallbackNames: string[] = [];

      // Загружаем каждый файл напрямую в S3 через presigned URL.
      // Это обходит лимит размера тела на Cloud Functions (~6 МБ),
      // позволяя слать большие фото, видео и архивы.
      for (const img of selectedImages) {
        if (!img.file) {
          // Старый формат без File-объекта — fallback на base64
          fallbackBase64.push(img.dataUrl);
          fallbackNames.push(img.fileName);
          continue;
        }
        try {
          const contentType = img.file.type || 'application/octet-stream';
          const presignUrl = `${CHAT_API}?action=get_upload_url&photographer_id=${photographerId}&file_name=${encodeURIComponent(img.fileName)}&content_type=${encodeURIComponent(contentType)}`;
          const presignResp = await fetch(presignUrl);
          if (!presignResp.ok) {
            throw new Error(`presign HTTP ${presignResp.status}`);
          }
          const presignData = await presignResp.json();
          if (!presignData.upload_url || !presignData.cdn_url) {
            throw new Error('Некорректный ответ presigned URL');
          }

          const putResp = await fetch(presignData.upload_url, {
            method: 'PUT',
            headers: {
              'Content-Type': contentType,
              'x-amz-acl': 'public-read',
            },
            body: img.file,
          });
          if (!putResp.ok) {
            throw new Error(`S3 PUT HTTP ${putResp.status}`);
          }
          uploadedUrls.push(presignData.cdn_url);
        } catch (uploadErr) {
          console.error('Direct S3 upload failed, fallback to base64:', uploadErr);
          // Если файл маленький — пробуем по старой схеме через бэк
          if (img.dataUrl.length < 5_500_000) {
            fallbackBase64.push(img.dataUrl);
            fallbackNames.push(img.fileName);
          } else {
            throw new Error(`Не удалось загрузить файл «${img.fileName}». Попробуйте ещё раз или проверьте интернет.`);
          }
        }
      }

      const body: Record<string, unknown> = {
        client_id: clientId,
        photographer_id: photographerId,
        message: newMessage.trim(),
        sender_type: senderType,
      };
      if (replyTo) body.reply_to_id = replyTo.id;
      if (uploadedUrls.length > 0) {
        body.image_urls = uploadedUrls;
      }
      if (fallbackBase64.length > 0) {
        body.images_base64 = fallbackBase64;
        body.file_names = fallbackNames;
      }

      const response = await fetch(CHAT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const text = await response.text().catch(() => '');
        throw new Error(`HTTP ${response.status}: ${text || 'не удалось отправить сообщение'}`);
      }
      setNewMessage('');
      setSelectedImages([]);
      setReplyTo(null);
      await loadMessages();
      if (onMessageSent) onMessageSent();
    } catch (error) {
      console.error('Error sending message:', error);
      const msg = error instanceof Error ? error.message : 'Неизвестная ошибка';
      alert(`Не удалось отправить сообщение: ${msg}`);
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

  const handleOpenMenu = useCallback((id: number, pos: { x: number; y: number }) => {
    setMenuState({ id, x: pos.x, y: pos.y });
  }, []);

  const activeMessage = useMemo(
    () => (menuState ? messages.find(m => m.id === menuState.id) : null),
    [menuState, messages]
  );

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
    const eligibleIds = forAll
      ? messages.filter(m => ids.includes(m.id) && m.sender_type === senderType).map(m => m.id)
      : ids;
    await removeMessages(eligibleIds, forAll);
    exitSelectionMode();
  };

  const selectAll = () => setSelectedIds(new Set(messages.map(m => m.id)));

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

  const replyBanner = replyTo
    ? { id: replyTo.id, text: replyTo.message || (replyTo.image_url ? 'Вложение' : ''), sender_type: replyTo.sender_type }
    : null;

  return {
    // state
    messages,
    newMessage,
    loading,
    sending,
    selectedImages,
    fullscreenImage,
    isOpponentTyping,
    menuState,
    replyTo,
    editingId,
    selectionMode,
    selectedIds,
    highlightedId,
    resolvedPhotos,
    activeMessage,
    replyBanner,
    // refs
    messagesEndRef,
    messageContainerRef,
    // actions
    setFullscreenImage,
    setMenuState,
    setReplyTo,
    setEditingId,
    setNewMessage,
    handleInputChange,
    handleImageSelect,
    handleImageRemove,
    sendMessage,
    handleKeyPress,
    handleOpenMenu,
    jumpToMessage,
    toggleSelect,
    exitSelectionMode,
    handleAction,
    handleBulkCopy,
    handleBulkRemove,
    selectAll,
  };
}