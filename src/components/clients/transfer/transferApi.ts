export const TRANSFER_API = 'https://functions.poehali.dev/beca58af-a011-491f-9240-1cdd6685dc80';

export interface IncomingTransfer {
  id: number;
  sender_user_id: string;
  sender_name: string | null;
  sender_phone: string | null;
  sender_email: string | null;
  scope: 'client' | 'project';
  client_id: number;
  project_id: number | null;
  client_name_snapshot: string | null;
  project_name_snapshot: string | null;
  comment: string | null;
  status: string;
  created_at: string;
  expires_at: string;
  seen_by_recipient_at: string | null;
}

export interface OutgoingTransfer {
  id: number;
  recipient_user_id: string | null;
  recipient_lookup_type: 'email' | 'phone';
  recipient_lookup_value: string;
  scope: 'client' | 'project';
  client_id: number;
  project_id: number | null;
  client_name_snapshot: string | null;
  project_name_snapshot: string | null;
  comment: string | null;
  reply_comment: string | null;
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';
  created_at: string;
  responded_at: string | null;
  expires_at: string;
}

async function call<T>(action: string, body: Record<string, unknown> = {}): Promise<T> {
  const userId = localStorage.getItem('userId');
  if (!userId) throw new Error('Not authorized');
  const res = await fetch(TRANSFER_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
    body: JSON.stringify({ action, ...body }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `HTTP ${res.status}`);
  return data as T;
}

export const transferApi = {
  create: (params: {
    scope: 'client' | 'project';
    client_id: number;
    project_id?: number;
    lookup_type: 'email' | 'phone';
    lookup_value: string;
    comment?: string;
  }) => call<{ success: boolean; transfer_id: number; recipient_found: boolean; invite_sent_via: string }>('create', params),

  listIncoming: () => call<{ transfers: IncomingTransfer[] }>('list_incoming'),

  listOutgoing: () => call<{ transfers: OutgoingTransfer[] }>('list_outgoing'),

  accept: (transfer_id: number, reply_comment?: string) =>
    call<{ success: boolean; status: string }>('accept', { transfer_id, reply_comment }),

  reject: (transfer_id: number, reply_comment?: string) =>
    call<{ success: boolean; status: string }>('reject', { transfer_id, reply_comment }),

  cancel: (transfer_id: number) => call<{ success: boolean }>('cancel', { transfer_id }),

  markSeen: (transfer_id: number) => call<{ success: boolean }>('mark_seen', { transfer_id }),
};
