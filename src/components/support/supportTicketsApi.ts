export const SUPPORT_TICKETS_URL = 'https://functions.poehali.dev/cf9dcf99-d8a6-4ca1-8876-5d24f420e72c';

export type RequestType = 'question' | 'problem' | 'suggestion';
export type Priority = 'low' | 'normal' | 'high' | 'urgent';
export type TicketStatus = 'open' | 'in_progress' | 'closed';

export interface TicketAttachment {
  name: string;
  url: string;
  type?: string;
}

export interface Ticket {
  id: number;
  ticket_number: string;
  request_type: RequestType;
  priority: Priority;
  subject: string;
  status: TicketStatus;
  created_at: string;
  closed_at?: string;
  last_message_at: string;
  last_message_preview: string;
  user_name: string;
  user_email: string;
  user_unread_count: number;
  admin_unread_count: number;
}

export interface TicketUserInfo {
  id: string;
  full_name: string;
  email: string;
  phone: string;
}

export interface TicketMessage {
  id: number;
  sender: 'user' | 'admin';
  sender_name: string;
  body: string;
  attachments: TicketAttachment[];
  created_at: string;
}

export interface NewAttachment {
  name: string;
  type: string;
  data: string;
}

export const REQUEST_TYPE_LABELS: Record<RequestType, string> = {
  question: 'Вопрос',
  problem: 'Проблема',
  suggestion: 'Предложение',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Низкий',
  normal: 'Обычный',
  high: 'Высокий',
  urgent: 'Срочный',
};

export const STATUS_LABELS: Record<TicketStatus, string> = {
  open: 'Открыто',
  in_progress: 'В обработке',
  closed: 'Закрыто',
};

const headers = (userId: string | number) => ({
  'Content-Type': 'application/json',
  'X-User-Id': String(userId),
});

export async function fetchTickets(userId: string | number, status?: 'open' | 'closed'): Promise<Ticket[]> {
  const q = status ? `&status=${status}` : '';
  const res = await fetch(`${SUPPORT_TICKETS_URL}?action=list${q}`, { headers: headers(userId) });
  const data = await res.json();
  return data.tickets || [];
}

export async function fetchTicket(userId: string | number, ticketId: number): Promise<{ ticket: Ticket; messages: TicketMessage[] }> {
  const res = await fetch(`${SUPPORT_TICKETS_URL}?action=get&ticket_id=${ticketId}`, { headers: headers(userId) });
  return res.json();
}

export async function createTicket(userId: string | number, payload: {
  request_type: RequestType;
  priority: Priority;
  subject: string;
  message: string;
  user_name?: string;
  user_email?: string;
  attachments?: NewAttachment[];
}): Promise<{ success?: boolean; ticket?: Ticket; error?: string }> {
  const res = await fetch(`${SUPPORT_TICKETS_URL}?action=create`, {
    method: 'POST',
    headers: headers(userId),
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function sendTicketMessage(userId: string | number, payload: {
  ticket_id: number;
  message: string;
  user_name?: string;
  attachments?: NewAttachment[];
}): Promise<{ success?: boolean; message?: TicketMessage; error?: string }> {
  const res = await fetch(`${SUPPORT_TICKETS_URL}?action=message`, {
    method: 'POST',
    headers: headers(userId),
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function closeTicket(userId: string | number, ticketId: number): Promise<{ success?: boolean; ticket?: Ticket }> {
  const res = await fetch(`${SUPPORT_TICKETS_URL}?action=close`, {
    method: 'POST',
    headers: headers(userId),
    body: JSON.stringify({ ticket_id: ticketId }),
  });
  return res.json();
}

export async function reopenTicket(userId: string | number, ticketId: number): Promise<{ success?: boolean; ticket?: Ticket }> {
  const res = await fetch(`${SUPPORT_TICKETS_URL}?action=reopen`, {
    method: 'POST',
    headers: headers(userId),
    body: JSON.stringify({ ticket_id: ticketId }),
  });
  return res.json();
}

export async function fetchUnreadCount(userId: string | number): Promise<number> {
  const res = await fetch(`${SUPPORT_TICKETS_URL}?action=unread`, { headers: headers(userId) });
  const data = await res.json();
  return data.unread_count || 0;
}

// ----- Admin -----
export async function adminFetchTickets(userId: string | number, status?: 'open' | 'closed'): Promise<Ticket[]> {
  const q = status ? `&status=${status}` : '';
  const res = await fetch(`${SUPPORT_TICKETS_URL}?action=admin_list${q}`, { headers: headers(userId) });
  const data = await res.json();
  return data.tickets || [];
}

export async function adminFetchTicket(userId: string | number, ticketId: number): Promise<{ ticket: Ticket; messages: TicketMessage[]; user_info?: TicketUserInfo }> {
  const res = await fetch(`${SUPPORT_TICKETS_URL}?action=admin_get&ticket_id=${ticketId}`, { headers: headers(userId) });
  return res.json();
}

export async function adminSendMessage(userId: string | number, payload: {
  ticket_id: number;
  message: string;
  attachments?: NewAttachment[];
}): Promise<{ success?: boolean; message?: TicketMessage }> {
  const res = await fetch(`${SUPPORT_TICKETS_URL}?action=admin_message`, {
    method: 'POST',
    headers: headers(userId),
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function adminSetStatus(userId: string | number, ticketId: number, status: TicketStatus): Promise<{ success?: boolean; ticket?: Ticket }> {
  const res = await fetch(`${SUPPORT_TICKETS_URL}?action=admin_status`, {
    method: 'POST',
    headers: headers(userId),
    body: JSON.stringify({ ticket_id: ticketId, status }),
  });
  return res.json();
}

export async function adminFetchUnread(userId: string | number): Promise<number> {
  const res = await fetch(`${SUPPORT_TICKETS_URL}?action=admin_unread`, { headers: headers(userId) });
  const data = await res.json();
  return data.unread_count || 0;
}

export function fileToAttachment(file: File): Promise<NewAttachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve({ name: file.name, type: file.type, data: String(reader.result) });
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function formatTicketTime(dateStr: string): string {
  if (!dateStr) return '';
  const cleaned = dateStr.includes('Z') || dateStr.includes('+') ? dateStr : dateStr.replace(' ', 'T') + 'Z';
  const d = new Date(cleaned);
  if (isNaN(d.getTime())) return dateStr;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}