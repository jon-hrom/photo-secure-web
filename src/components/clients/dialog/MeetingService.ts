import { toast } from 'sonner';

const MEETINGS_API = 'https://functions.poehali.dev/44dfee41-5ef9-4749-87f5-325cde2ec8ab';

export interface Meeting {
  id: number;
  client_id: number;
  name: string;
  meeting_date: string;
  meeting_time?: string | null;
  duration?: number;
  address?: string;
  description?: string;
  custom_reminder_at?: string | null;
  status: 'new' | 'cancelled' | 'completed';
  cancel_reason?: string;
}

export interface NewMeetingData {
  name: string;
  meeting_date: string;
  meeting_time: string;
  duration: number;
  address: string;
  description: string;
  custom_reminder_at?: string;
}

interface CreateMeetingResult {
  ok: boolean;
  meeting?: Meeting;
  error?: string;
}

export const createMeeting = async (
  clientId: number,
  data: NewMeetingData,
  notifyClient: boolean,
  notifyPhotographer: boolean
): Promise<CreateMeetingResult> => {
  const userId = localStorage.getItem('userId');
  if (!userId) return { ok: false, error: 'нет авторизации' };

  try {
    const resp = await fetch(MEETINGS_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
      body: JSON.stringify({
        client_id: clientId,
        name: data.name || 'Встреча',
        meeting_date: data.meeting_date,
        meeting_time: data.meeting_time || null,
        duration: data.duration || 60,
        address: data.address || null,
        description: data.description || null,
        custom_reminder_at: data.custom_reminder_at || null,
        notify_client: notifyClient,
        notify_photographer: notifyPhotographer,
      }),
    });
    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) return { ok: false, error: json.error || `HTTP ${resp.status}` };
    return { ok: true, meeting: json.meeting };
  } catch (e) {
    return { ok: false, error: 'сетевая ошибка' };
  }
};

export const fetchMeetings = async (clientId?: number): Promise<Meeting[]> => {
  const userId = localStorage.getItem('userId');
  if (!userId) return [];
  try {
    const url = clientId ? `${MEETINGS_API}?client_id=${clientId}` : MEETINGS_API;
    const resp = await fetch(url, { headers: { 'X-User-Id': userId } });
    if (!resp.ok) return [];
    const json = await resp.json();
    return json.meetings || [];
  } catch {
    return [];
  }
};

export const updateMeeting = async (
  id: number,
  updates: Partial<Meeting> & { notification_type?: string; notify_client?: boolean }
): Promise<boolean> => {
  const userId = localStorage.getItem('userId');
  if (!userId) return false;
  try {
    const resp = await fetch(MEETINGS_API, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
      body: JSON.stringify({ id, ...updates }),
    });
    return resp.ok;
  } catch {
    return false;
  }
};

export const deleteMeeting = async (id: number): Promise<boolean> => {
  const userId = localStorage.getItem('userId');
  if (!userId) return false;
  try {
    const resp = await fetch(`${MEETINGS_API}?id=${id}`, {
      method: 'DELETE',
      headers: { 'X-User-Id': userId },
    });
    return resp.ok;
  } catch {
    return false;
  }
};

export const notifyMeetingResult = (result: CreateMeetingResult) => {
  if (result.ok) {
    toast.success('Встреча создана', {
      description: 'Уведомления отправлены клиенту и вам',
      duration: 6000,
    });
  } else {
    toast.error('Не удалось создать встречу', { description: result.error });
  }
};