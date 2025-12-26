import { Client, Project } from '@/components/clients/ClientsTypes';
import { createBookingEmailTemplate, createUpdateEmailTemplate } from './EmailTemplate';
import { toast } from 'sonner';

export const sendProjectNotification = async (
  client: Client,
  project: Project,
  photographerName: string
) => {
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

    const whatsappMessage = `📸 Новая бронь на фотосессию

Фотограф: ${photographerName || 'foto-mix'}
Дата съёмки: ${formattedDate}
Услуга: ${project.name}
${styleName ? `Стиль съёмки: ${styleName}` : ''}
${project.description ? `Описание: ${project.description}` : ''}
Стоимость: ${project.budget} ₽

До встречи на съёмке! 📷

—
Сообщение сформировано автоматически системой учёта клиентов для фотографов foto-mix.ru. На него отвечать не нужно.`;

    const userId = localStorage.getItem('userId');
    if (userId && client.phone) {
      const MAX_API = 'https://functions.poehali.dev/6bd5e47e-49f9-4af3-a814-d426f5cd1f6d';
      await fetch(MAX_API, {
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
    }

    // Отправляем уведомления через новую систему (клиенту и фотографу)
    if (userId && project.startDate && project.shooting_time) {
      const SHOOTING_NOTIF_API = 'https://functions.poehali.dev/b2bd6fbd-f4a9-4bec-b6b7-0689b79375ae';
      try {
        await fetch(SHOOTING_NOTIF_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId
          },
          body: JSON.stringify({
            project_id: project.id,
            client_id: client.id,
            notify_client: true,
            notify_photographer: true
          })
        });
      } catch (notifError) {
        console.error('[Shooting Notifications] Error:', notifError);
      }
    }

    if (client.email) {
      const EMAIL_API = 'https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0';
      
      const htmlMessage = createBookingEmailTemplate(
        photographerName,
        formattedDate,
        project.name,
        styleName,
        project.description || '',
        project.budget
      );

      await fetch(EMAIL_API, {
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
    }
  } catch (error) {
    console.error('[Project Notification] Error:', error);
  }
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