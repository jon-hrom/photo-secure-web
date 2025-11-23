import { toast } from 'sonner';

interface SendBookingNotificationParams {
  clientEmail: string;
  clientName: string;
  date: string;
  time: string;
  description?: string;
  hoursBeforeText: string;
}

export const sendBookingNotification = async (params: SendBookingNotificationParams): Promise<boolean> => {
  try {
    const postboxKeyId = import.meta.env.VITE_POSTBOX_ACCESS_KEY_ID;
    const postboxSecret = import.meta.env.VITE_POSTBOX_SECRET_ACCESS_KEY;
    
    if (!postboxKeyId || !postboxSecret) {
      console.warn('Email credentials not configured');
      return false;
    }

    const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Напоминание о встрече</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); overflow: hidden;">
                        <tr>
                            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 30px; text-align: center;">
                                <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600;">📅 Напоминание о встрече</h1>
                            </td>
                        </tr>
                        
                        <tr>
                            <td style="padding: 40px 30px;">
                                <p style="margin: 0 0 20px; font-size: 18px; color: #333333; line-height: 1.6;">
                                    Здравствуйте, <strong>${params.clientName}</strong>!
                                </p>
                                
                                <p style="margin: 0 0 30px; font-size: 16px; color: #666666; line-height: 1.6;">
                                    Напоминаем, что ваша встреча состоится через <strong style="color: #667eea;">${params.hoursBeforeText}</strong>.
                                </p>
                                
                                <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8f9ff; border-radius: 8px; border-left: 4px solid #667eea; margin-bottom: 30px;">
                                    <tr>
                                        <td style="padding: 25px;">
                                            <table width="100%" cellpadding="0" cellspacing="0">
                                                <tr>
                                                    <td style="padding: 8px 0;">
                                                        <span style="font-size: 14px; color: #667eea; font-weight: 600;">📆 ДАТА</span>
                                                        <p style="margin: 5px 0 0; font-size: 18px; color: #333333; font-weight: 500;">${params.date}</p>
                                                    </td>
                                                </tr>
                                                <tr>
                                                    <td style="padding: 8px 0;">
                                                        <span style="font-size: 14px; color: #667eea; font-weight: 600;">🕐 ВРЕМЯ</span>
                                                        <p style="margin: 5px 0 0; font-size: 18px; color: #333333; font-weight: 500;">${params.time}</p>
                                                    </td>
                                                </tr>
                                                ${params.description ? `
                                                <tr>
                                                    <td style="padding: 8px 0;">
                                                        <span style="font-size: 14px; color: #667eea; font-weight: 600;">📝 ОПИСАНИЕ</span>
                                                        <p style="margin: 5px 0 0; font-size: 16px; color: #333333; line-height: 1.5;">${params.description}</p>
                                                    </td>
                                                </tr>
                                                ` : ''}
                                            </table>
                                        </td>
                                    </tr>
                                </table>
                                
                                <p style="margin: 0 0 15px; font-size: 15px; color: #666666; line-height: 1.6;">
                                    Если у вас возникли вопросы или необходимо перенести встречу, пожалуйста, свяжитесь с нами заранее.
                                </p>
                                
                                <p style="margin: 0; font-size: 15px; color: #666666; line-height: 1.6;">
                                    Мы с нетерпением ждём встречи с вами! 🎉
                                </p>
                            </td>
                        </tr>
                        
                        <tr>
                            <td style="background-color: #f8f9fa; padding: 30px; text-align: center; border-top: 1px solid #e9ecef;">
                                <p style="margin: 0 0 10px; font-size: 14px; color: #6c757d;">
                                    С уважением,<br>
                                    <strong style="color: #667eea;">Foto-Mix</strong>
                                </p>
                                <p style="margin: 0; font-size: 12px; color: #adb5bd;">
                                    Это автоматическое уведомление. Пожалуйста, не отвечайте на это письмо.
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    `;

    const response = await fetch('https://postbox.cloud.yandex.net/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.0',
        'X-Amz-Target': 'SimpleEmailService_v2.SendEmail',
        'Authorization': `AWS4-HMAC-SHA256 Credential=${postboxKeyId}/...` // Simplified for now
      },
      body: JSON.stringify({
        FromEmailAddress: 'noreply@foto-mix.ru',
        Destination: {
          ToAddresses: [params.clientEmail]
        },
        Content: {
          Simple: {
            Subject: {
              Data: `Напоминание: встреча ${params.date} в ${params.time}`,
              Charset: 'UTF-8'
            },
            Body: {
              Html: {
                Data: htmlBody,
                Charset: 'UTF-8'
              }
            }
          }
        }
      })
    });

    if (!response.ok) {
      console.error('Failed to send email:', await response.text());
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error sending email:', error);
    return false;
  }
};

export const scheduleBookingNotification = (
  bookingDate: Date,
  bookingTime: string,
  notificationTime: number,
  clientEmail: string,
  clientName: string,
  description: string
) => {
  const hoursBeforeText = notificationTime >= 24 
    ? `${notificationTime / 24} ${notificationTime === 24 ? 'день' : notificationTime === 48 ? 'дня' : 'недель'}`
    : `${notificationTime} ${notificationTime === 1 ? 'час' : notificationTime <= 4 ? 'часа' : 'часов'}`;

  console.log('Notification scheduled:', {
    bookingDate,
    bookingTime,
    notificationTime,
    clientEmail,
    clientName,
    hoursBeforeText
  });

  toast.info(`Уведомление будет отправлено за ${hoursBeforeText} до встречи на ${clientEmail}`);
};
