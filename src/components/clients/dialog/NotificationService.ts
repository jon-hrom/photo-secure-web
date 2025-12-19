import { Client, Project } from '@/components/clients/ClientsTypes';
import { createBookingEmailTemplate } from './EmailTemplate';

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
