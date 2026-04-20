export interface ReplyPreview {
  id: number;
  message: string;
  sender_type: 'client' | 'photographer';
  image_url?: string | null;
  video_url?: string | null;
}

export interface ChatMessageData {
  id: number;
  message: string;
  sender_type: 'client' | 'photographer';
  created_at: string;
  is_read: boolean;
  is_delivered: boolean;
  image_url?: string;
  video_url?: string;
  is_edited?: boolean;
  edited_at?: string | null;
  reply_to_id?: number | null;
  reply_to?: ReplyPreview | null;
  removed_for_all?: boolean;
}

export type ChatAction =
  | 'reply'
  | 'edit'
  | 'copy'
  | 'remove_me'
  | 'remove_all'
  | 'select'
  | 'forward'
  | 'pin';
