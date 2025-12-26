export const createBookingEmailTemplate = (
  photographerName: string,
  formattedDate: string,
  projectName: string,
  styleName: string,
  description: string,
  budget: number
): string => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; background: #1a1a1a; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 30px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .icon { font-size: 48px; margin-bottom: 15px; }
    .info-block { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 20px 25px; margin: 12px 0; }
    .info-block.green { background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); }
    .info-block.blue { background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%); }
    .info-block.orange { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
    .info-block.red { background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); }
    .info-block.purple { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
    .info-label { font-weight: 600; color: #ffffff; margin-bottom: 8px; font-size: 14px; opacity: 0.95; }
    .info-value { color: #ffffff; font-size: 18px; font-weight: 500; line-height: 1.4; }
    .price-block { background: linear-gradient(135deg, #ffd89b 0%, #19547b 100%); border-radius: 12px; padding: 25px; margin: 12px 0; text-align: center; }
    .price { font-size: 32px; font-weight: bold; color: #ffffff; margin: 0; }
    .footer { margin-top: 40px; text-align: center; color: #888; font-size: 12px; line-height: 1.6; }
    .footer a { color: #667eea; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">📸</div>
      <h1>Новая бронь на фотосессию</h1>
    </div>
    
    <div class="info-block green">
      <div class="info-label">👤 Фотограф</div>
      <div class="info-value">${photographerName || 'foto-mix'}</div>
    </div>
    
    <div class="info-block blue">
      <div class="info-label">📅 Дата съёмки</div>
      <div class="info-value">${formattedDate}</div>
    </div>
    
    <div class="info-block purple">
      <div class="info-label">📋 Услуга</div>
      <div class="info-value">${projectName}</div>
    </div>
    
    ${styleName ? `<div class="info-block orange">
      <div class="info-label">🎨 Стиль съёмки</div>
      <div class="info-value">${styleName}</div>
    </div>` : ''}
    
    ${description ? `<div class="info-block red">
      <div class="info-label">📝 Описание</div>
      <div class="info-value">${description}</div>
    </div>` : ''}
    
    <div class="price-block">
      <div class="price">💰 ${budget} ₽</div>
    </div>
    
    <div class="footer">
      До встречи на съёмке! 📷<br><br>
      Сообщение сформировано автоматически системой учёта клиентов<br>
      <a href="https://foto-mix.ru">foto-mix.ru</a>
    </div>
  </div>
</body>
</html>`;
};

export const createUpdateEmailTemplate = (
  photographerName: string,
  projectName: string,
  changesText: string
): string => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: #1a1a1a; }
    .container { max-width: 600px; margin: 0 auto; background: #1a1a1a; padding: 40px 20px; }
    .header { text-align: center; margin-bottom: 30px; color: #ffffff; }
    .header h1 { margin: 0; font-size: 28px; font-weight: 600; }
    .icon { font-size: 48px; margin-bottom: 15px; }
    .info-block { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 20px 25px; margin: 12px 0; }
    .info-block.orange { background: linear-gradient(135deg, #fa709a 0%, #fee140 100%); }
    .info-label { font-weight: 600; color: #ffffff; margin-bottom: 8px; font-size: 14px; opacity: 0.95; }
    .info-value { color: #ffffff; font-size: 18px; font-weight: 500; line-height: 1.4; white-space: pre-line; }
    .footer { margin-top: 40px; text-align: center; color: #888; font-size: 12px; line-height: 1.6; }
    .footer a { color: #667eea; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="icon">📝</div>
      <h1>Изменения в бронировании</h1>
    </div>
    
    <div class="info-block">
      <div class="info-label">👤 Фотограф</div>
      <div class="info-value">${photographerName || 'foto-mix'}</div>
    </div>
    
    <div class="info-block orange">
      <div class="info-label">📋 Услуга</div>
      <div class="info-value">${projectName}</div>
    </div>
    
    <div class="info-block">
      <div class="info-label">🔄 Что изменилось</div>
      <div class="info-value">${changesText}</div>
    </div>
    
    <div class="footer">
      До встречи на съёмке! 📷<br><br>
      Сообщение сформировано автоматически системой учёта клиентов<br>
      <a href="https://foto-mix.ru">foto-mix.ru</a>
    </div>
  </div>
</body>
</html>`;
};