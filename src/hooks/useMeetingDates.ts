import { useCallback, useEffect, useState } from 'react';
import { fetchMeetings, Meeting } from '@/components/clients/dialog/MeetingService';

export interface MeetingDate {
  date: Date;
  fullDateTime: Date;
  isActive: boolean;
  meeting: Meeting;
}

const toMeetingDate = (m: Meeting): MeetingDate | null => {
  if (!m.meeting_date) return null;

  const date = new Date(m.meeting_date);
  if (isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);

  const fullDateTime = new Date(m.meeting_date);
  if (m.meeting_time) {
    const [hours, minutes] = String(m.meeting_time).split(':').map(Number);
    fullDateTime.setHours(hours || 0, minutes || 0, 0, 0);
  } else {
    fullDateTime.setHours(23, 59, 59, 999);
  }

  return { date, fullDateTime, isActive: fullDateTime >= new Date(), meeting: m };
};

/**
 * Загружает встречи фотографа и отдаёт их как даты для подсветки в календарях.
 * Обновляется по событию meetings:refresh после создания новой встречи.
 */
export const useMeetingDates = () => {
  const [meetingDates, setMeetingDates] = useState<MeetingDate[]>([]);

  const reload = useCallback(() => {
    fetchMeetings()
      .then((list) => {
        const active = (list || []).filter((m) => m.status !== 'cancelled');
        setMeetingDates(active.map(toMeetingDate).filter((d): d is MeetingDate => d !== null));
      })
      .catch(() => setMeetingDates([]));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    const handler = () => reload();
    window.addEventListener('meetings:refresh', handler);
    return () => window.removeEventListener('meetings:refresh', handler);
  }, [reload]);

  /** Есть ли на эту дату предстоящая встреча */
  const hasMeetingOn = useCallback(
    (date: Date) => {
      const check = new Date(date);
      check.setHours(0, 0, 0, 0);
      return meetingDates.some((m) => m.isActive && m.date.getTime() === check.getTime());
    },
    [meetingDates]
  );

  /** Все встречи на выбранную дату, отсортированные по времени */
  const getMeetingsOn = useCallback(
    (date: Date) => {
      const check = new Date(date);
      check.setHours(0, 0, 0, 0);
      return meetingDates
        .filter((m) => m.date.getTime() === check.getTime())
        .sort((a, b) => a.fullDateTime.getTime() - b.fullDateTime.getTime())
        .map((m) => m.meeting);
    },
    [meetingDates]
  );

  return { meetingDates, hasMeetingOn, getMeetingsOn, reloadMeetings: reload };
};

export default useMeetingDates;