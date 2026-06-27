import { Client, Project } from '@/components/clients/ClientsTypes';
import { createBookingEmailTemplate, createUpdateEmailTemplate } from './EmailTemplate';
import { toast } from 'sonner';

export interface NotificationDeliveryReport {
  whatsappClient: 'sent' | 'failed' | 'skipped';
  whatsappPhotographer: 'sent' | 'failed' | 'skipped';
  email: 'sent' | 'failed' | 'skipped';
  reasons: { whatsappClient?: string; whatsappPhotographer?: string; email?: string };
}

export const sendProjectNotification = async (
  client: Client,
  project: Project,
  photographerName: string
): Promise<NotificationDeliveryReport> => {
  const report: NotificationDeliveryReport = {
    whatsappClient: 'skipped',
    whatsappPhotographer: 'skipped',
    email: 'skipped',
    reasons: {},
  };

  try {
    const { getShootingStyles } = await import('@/data/shootingStyles');
    const styles = getShootingStyles();
    const style = styles.find(s => s.id === project.shootingStyleId);
    const styleName = style ? style.name : '';

    const projectDate = new Date(project.startDate);
    const formattedDate = projectDate.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const userId = localStorage.getItem('userId');

    // Отправляем уведомления через систему shooting-notifications (клиенту и фотографу).
    // Время съёмки больше не обязательно — backend подставит дефолт.
    if (userId && project.startDate) {
      const SHOOTING_NOTIF_API = 'https://functions.poehali.dev/b2bd6fbd-f4a9-4bec-b6b7-0689b79375ae';
      try {
        const resp = await fetch(SHOOTING_NOTIF_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId
          },
          body: JSON.stringify({
            project_id: project.id,
            client_id: client.id,
            notify_client: !!client.phone,
            notify_photographer: true
          })
        });

        if (resp.ok) {
          const data = await resp.json().catch(() => ({} as Record<string, unknown>));
          const dataResults = ((data as Record<string, unknown>)?.results || data) as Record<string, unknown>;
          const clientRes = (dataResults?.client_notification || dataResults?.client || {}) as Record<string, unknown>;
          const photogRes = (dataResults?.photographer_notification || dataResults?.photographer || {}) as Record<string, unknown>;

          type ChannelResult = { success?: boolean; ok?: boolean; error?: string };
          const evaluateChannels = (res: Record<string, unknown>): { status: 'sent' | 'failed' | 'skipped'; reason?: string } => {
            const wa = res?.whatsapp as ChannelResult | undefined;
            const tg = res?.telegram as ChannelResult | undefined;
            const waOk = !!(wa && (wa.success || wa.ok));
            const tgOk = !!(tg && (tg.success || tg.ok));
            if (waOk || tgOk) return { status: 'sent' };
            const reasons: string[] = [];
            if (wa?.error) reasons.push(`MAX: ${wa.error}`);
            if (tg?.error) reasons.push(`Telegram: ${tg.error}`);
            const topError = (res?.error as string) || undefined;
            if (!wa && !tg && topError) reasons.push(topError);
            if (reasons.length === 0) return { status: 'skipped', reason: 'нет настроенных каналов' };
            return { status: 'failed', reason: reasons.join('; ') };
          };

          if (client.phone || client.email) {
            const r = evaluateChannels(clientRes);
            report.whatsappClient = r.status;
            if (r.reason) report.reasons.whatsappClient = r.reason;
          } else {
            report.whatsappClient = 'skipped';
            report.reasons.whatsappClient = 'нет телефона у клиента';
          }

          const rP = evaluateChannels(photogRes);
          report.whatsappPhotographer = rP.status;
          if (rP.reason) report.reasons.whatsappPhotographer = rP.reason;
        } else {
          const errText = await resp.text().catch(() => '');
          report.whatsappClient = client.phone ? 'failed' : 'skipped';
          report.whatsappPhotographer = 'failed';
          report.reasons.whatsappClient = `HTTP ${resp.status}`;
          report.reasons.whatsappPhotographer = `HTTP ${resp.status} ${errText.slice(0, 80)}`;
        }
      } catch (notifError) {
        console.error('[Shooting Notifications] Error:', notifError);
        report.whatsappClient = client.phone ? 'failed' : 'skipped';
        report.whatsappPhotographer = 'failed';
        report.reasons.whatsappClient = 'сетевая ошибка';
        report.reasons.whatsappPhotographer = 'сетевая ошибка';
      }
    } else if (!userId) {
      report.reasons.whatsappClient = 'нет авторизации';
      report.reasons.whatsappPhotographer = 'нет авторизации';
    } else {
      report.reasons.whatsappClient = 'не указана дата съёмки';
      report.reasons.whatsappPhotographer = 'не указана дата съёмки';
    }

    if (client.email) {
      const EMAIL_API = 'https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0';

      const breakdown: { label: string; amount: number }[] = [];
      const rate = Number(project.hourly_rate) || 0;
      const durationMin = Number(project.shooting_duration) || 0;
      if (rate > 0 && durationMin > 0) {
        breakdown.push({ label: `Съёмка (${Math.round((durationMin / 60) * 10) / 10} ч)`, amount: Math.round((durationMin / 60) * rate) });
      }
      const pbCount = Number(project.photobook_count) || 0;
      const pbPrice = Number(project.photobook_price) || 0;
      if (pbCount > 0 && pbPrice > 0) {
        breakdown.push({ label: `Фотокнига ${pbCount} × ${pbPrice.toLocaleString('ru-RU')} ₽`, amount: pbCount * pbPrice });
      }
      (project.photo_items || []).forEach((it) => {
        const qty = Number(it.qty) || 0;
        const price = Number(it.price) || 0;
        if (it.format && (qty > 0 || price > 0)) {
          breakdown.push({ label: `Фото ${it.format} (${qty} × ${price.toLocaleString('ru-RU')} ₽)`, amount: qty * price });
        }
      });

      const htmlMessage = createBookingEmailTemplate(
        photographerName,
        formattedDate,
        project.name,
        styleName,
        project.description || '',
        project.budget,
        breakdown
      );

      try {
        const r = await fetch(EMAIL_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send-booking-notification',
            to_email: client.email,
            client_name: client.name,
            html_body: htmlMessage,
            subject: `📸 Новая бронь на фотосессию ${formattedDate}`
          })
        });
        report.email = r.ok ? 'sent' : 'failed';
        if (!r.ok) report.reasons.email = `HTTP ${r.status}`;
      } catch (e) {
        report.email = 'failed';
        report.reasons.email = 'сетевая ошибка';
      }
    } else {
      report.reasons.email = 'нет email у клиента';
    }
  } catch (error) {
    console.error('[Project Notification] Error:', error);
  }

  return report;
};

export const sendProjectUpdateNotification = async (
  client: Client,
  oldProject: Project,
  newProject: Project,
  photographerName: string
) => {
  try {
    const { getShootingStyles } = await import('@/data/shootingStyles');
    const styles = getShootingStyles();
    const style = styles.find(s => s.id === newProject.shootingStyleId);
    const styleName = style ? style.name : '';

    const projectDate = new Date(newProject.startDate);
    const formattedDate = projectDate.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });

    const changes: string[] = [];
    if (oldProject.startDate !== newProject.startDate) {
      const oldDate = new Date(oldProject.startDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
      changes.push(`Дата: ${oldDate} → ${formattedDate}`);
    }
    if (oldProject.shooting_time !== newProject.shooting_time) {
      changes.push(`Время: ${oldProject.shooting_time || 'не указано'} → ${newProject.shooting_time || 'не указано'}`);
    }
    if (oldProject.shooting_address !== newProject.shooting_address) {
      changes.push(`Адрес: ${oldProject.shooting_address || 'не указан'} → ${newProject.shooting_address || 'не указан'}`);
    }
    if (oldProject.shooting_duration !== newProject.shooting_duration) {
      changes.push(`Длительность: ${oldProject.shooting_duration || '—'}ч → ${newProject.shooting_duration || '—'}ч`);
    }
    if (oldProject.status !== newProject.status) {
      const statusNames: Record<string, string> = {
        'new': 'Новый',
        'in_progress': 'В работе',
        'completed': 'Завершён',
        'cancelled': 'Отменён'
      };
      changes.push(`Статус: ${statusNames[oldProject.status] || oldProject.status} → ${statusNames[newProject.status] || newProject.status}`);
    }

    if (changes.length === 0) return;

    const changesText = changes.map(c => `• ${c}`).join('\n');

    const whatsappMessage = `📝 Изменения в бронировании

Фотограф: ${photographerName || 'foto-mix'}
Услуга: ${newProject.name}

Что изменилось:
${changesText}

До встречи на съёмке! 📷

—
Сообщение сформировано автоматически системой учёта клиентов для фотографов foto-mix.ru. На него отвечать не нужно.`;

    const userId = localStorage.getItem('userId');
    let whatsappSent = false;

    // Try WhatsApp first
    if (userId && client.phone) {
      const MAX_API = 'https://functions.poehali.dev/6bd5e47e-49f9-4af3-a814-d426f5cd1f6d';
      try {
        const response = await fetch(MAX_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId
          },
          body: JSON.stringify({
            action: 'send_message_to_client',
            client_id: client.id,
            message: whatsappMessage
          })
        });

        if (response.ok) {
          whatsappSent = true;
          console.log('[WhatsApp] Update notification sent successfully');
        } else {
          const error = await response.json();
          console.error('[WhatsApp] Failed:', error);
        }
      } catch (error) {
        console.error('[WhatsApp] Error:', error);
      }
    }

    // Fallback to SMS if WhatsApp failed
    if (!whatsappSent && userId && client.phone) {
      const SMS_API = 'https://functions.poehali.dev/93e5e9ce-e4d2-40a6-9a6d-2ba64c8c3e28';
      try {
        const smsText = `📝 Изменения в бронировании\n\n${newProject.name}\n\n${changesText}\n\nФотограф: ${photographerName}`;
        
        const response = await fetch(SMS_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId
          },
          body: JSON.stringify({
            client_id: client.id,
            message: smsText
          })
        });

        if (response.ok) {
          console.log('[SMS] Update notification sent as fallback');
          toast.success('Уведомление отправлено через SMS');
        } else {
          const error = await response.json();
          console.error('[SMS] Failed:', error);
          toast.error('Не удалось отправить уведомление');
        }
      } catch (error) {
        console.error('[SMS] Error:', error);
        toast.error('Ошибка отправки уведомления');
      }
    }

    // Send email notification
    if (client.email) {
      const EMAIL_API = 'https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0';
      
      const htmlMessage = createUpdateEmailTemplate(
        photographerName,
        newProject.name,
        changesText
      );

      await fetch(EMAIL_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send-booking-notification',
          to_email: client.email,
          client_name: client.name,
          html_body: htmlMessage,
          subject: `📝 Изменения в бронировании: ${newProject.name}`
        })
      });
    }
  } catch (error) {
    console.error('[Project Update Notification] Error:', error);
  }
};