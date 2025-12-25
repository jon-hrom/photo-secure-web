import { toast } from 'sonner';
import { Client, Comment, Message } from '@/components/clients/ClientsTypes';

export const createAddCommentHandler = (
  localClient: Client,
  comments: Comment[],
  newComment: string,
  setNewComment: (comment: string) => void,
  onUpdate: (client: Client) => void
) => {
  return () => {
    if (!newComment.trim()) {
      toast.error('Введите комментарий');
      return;
    }

    const comment: Comment = {
      id: Date.now(),
      text: newComment,
      date: new Date().toISOString(),
      author: 'Фотограф',
    };

    const updatedClient = {
      ...localClient,
      comments: [...comments, comment],
    };

    onUpdate(updatedClient);
    setNewComment('');
    toast.success('Комментарий добавлен');
  };
};

export const createDeleteCommentHandler = (
  localClient: Client,
  comments: Comment[],
  onUpdate: (client: Client) => void
) => {
  return (commentId: number) => {
    const updatedComments = comments.filter(c => c.id !== commentId);

    const updatedClient = {
      ...localClient,
      comments: updatedComments,
    };

    onUpdate(updatedClient);
    toast.success('Комментарий удалён');
  };
};

export const createAddMessageHandler = (
  localClient: Client,
  messages: Message[],
  newMessage: any,
  setNewMessage: (message: any) => void,
  onUpdate: (client: Client) => void
) => {
  return () => {
    if (!newMessage.text.trim()) {
      toast.error('Введите текст сообщения');
      return;
    }

    const message: Message = {
      id: Date.now(),
      content: newMessage.text,
      date: new Date().toISOString(),
      type: newMessage.type || 'email',
      author: 'Фотограф',
    };

    const updatedClient = {
      ...localClient,
      messages: [...messages, message],
    };

    onUpdate(updatedClient);
    setNewMessage({ text: '', type: 'email' });
    toast.success('Сообщение добавлено');
  };
};

export const createDeleteMessageHandler = (
  localClient: Client,
  messages: Message[],
  onUpdate: (client: Client) => void
) => {
  return (messageId: number) => {
    const updatedMessages = messages.filter(m => m.id !== messageId);

    const updatedClient = {
      ...localClient,
      messages: updatedMessages,
    };

    onUpdate(updatedClient);
    toast.success('Сообщение удалено');
  };
};
