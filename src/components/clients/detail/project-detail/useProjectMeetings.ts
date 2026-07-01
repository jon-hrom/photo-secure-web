import { useEffect, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { Client } from '@/components/clients/ClientsTypes';
import { NewMeetingDraft } from './NewProjectForm';
import { createMeeting, fetchMeetings, updateMeeting, deleteMeeting, Meeting } from '@/components/clients/dialog/MeetingService';
import { todayLocalDate } from '@/utils/dateFormat';

export const useProjectMeetings = (client?: Client) => {
  const emptyMeeting: NewMeetingDraft = {
    name: 'Встреча',
    meeting_date: todayLocalDate(),
    meeting_time: '12:00',
    duration: 60,
    address: '',
    description: '',
    custom_reminder_at: '',
  };
  const [newMeeting, setNewMeeting] = useState<NewMeetingDraft>(emptyMeeting);
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  const reloadMeetings = useCallback(async () => {
    if (!client) return;
    const list = await fetchMeetings(client.id);
    setMeetings(list);
  }, [client]);

  useEffect(() => {
    reloadMeetings();
  }, [reloadMeetings]);

  const handleAddMeeting = useCallback(async () => {
    if (!client) {
      toast.error('Не удалось определить клиента');
      return;
    }
    if (!newMeeting.meeting_date) {
      toast.error('Укажите дату встречи');
      return;
    }
    const notifyToast = toast.loading('Создаём встречу и отправляем уведомления...');
    const result = await createMeeting(client.id, newMeeting, !!client.phone || !!client.telegram_chat_id, true);
    toast.dismiss(notifyToast);
    if (result.ok) {
      toast.success('Встреча создана', {
        description: 'Уведомления отправлены клиенту и вам',
        duration: 6000,
      });
      setNewMeeting(emptyMeeting);
      reloadMeetings();
    } else {
      toast.error('Не удалось создать встречу', { description: result.error });
    }
  }, [client, newMeeting, reloadMeetings]);

  const handleMeetingSave = useCallback(async (id: number, updates: Partial<Meeting>) => {
    const notifyToast = toast.loading('Сохраняем и уведомляем клиента...');
    const ok = await updateMeeting(id, {
      ...updates,
      notification_type: 'reschedule',
      notify_client: !!(client?.phone || client?.telegram_chat_id),
    });
    toast.dismiss(notifyToast);
    if (ok) {
      toast.success('Встреча обновлена');
      reloadMeetings();
    } else {
      toast.error('Не удалось обновить встречу');
    }
  }, [client, reloadMeetings]);

  const handleMeetingCancel = useCallback(async (id: number, reason: string) => {
    const notifyToast = toast.loading('Отменяем встречу...');
    const ok = await updateMeeting(id, {
      status: 'cancelled',
      cancel_reason: reason,
      notification_type: 'cancellation',
      notify_client: !!(client?.phone || client?.telegram_chat_id),
    });
    toast.dismiss(notifyToast);
    if (ok) {
      toast.success('Встреча отменена, клиент уведомлён');
      reloadMeetings();
    } else {
      toast.error('Не удалось отменить встречу');
    }
  }, [client, reloadMeetings]);

  const handleMeetingDelete = useCallback(async (id: number) => {
    const ok = await deleteMeeting(id);
    if (ok) {
      toast.success('Встреча удалена');
      reloadMeetings();
    } else {
      toast.error('Не удалось удалить встречу');
    }
  }, [reloadMeetings]);

  const activeMeetings = meetings.filter((m) => m.status !== 'cancelled');
  const cancelledMeetings = meetings.filter((m) => m.status === 'cancelled');

  return {
    newMeeting,
    setNewMeeting,
    activeMeetings,
    cancelledMeetings,
    handleAddMeeting,
    handleMeetingSave,
    handleMeetingCancel,
    handleMeetingDelete,
  };
};