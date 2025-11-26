export interface Appeal {
  id: number;
  user_identifier: string;
  user_email: string | null;
  user_phone: string | null;
  auth_method: string;
  message: string;
  block_reason: string | null;
  is_blocked: boolean;
  is_read: boolean;
  is_archived: boolean;
  created_at: string;
  read_at: string | null;
  admin_response: string | null;
  responded_at: string | null;
}

export interface GroupedAppeals {
  userIdentifier: string;
  userEmail: string | null;
  appeals: Appeal[];
  totalCount: number;
  unreadCount: number;
  isBlocked: boolean;
  latestDate: string;
}
