// Service Worker для фоновой отправки уведомлений

let checkInterval = null;

self.addEventListener('message', (event) => {
  if (event.data.type === 'START_CHECKING') {
    // Проверяем каждые 30 минут
    if (checkInterval) {
      clearInterval(checkInterval);
    }
    
    checkNotifications();
    checkInterval = setInterval(checkNotifications, 30 * 60 * 1000);
  } else if (event.data.type === 'STOP_CHECKING') {
    if (checkInterval) {
      clearInterval(checkInterval);
      checkInterval = null;
    }
  }
});

async function checkNotifications() {
  try {
    const bookings = await getBookingsFromDB();
    const now = new Date();
    
    for (const booking of bookings) {
      if (shouldSendNotification(booking, now)) {
        await sendNotification(booking);
        await markNotificationSent(booking.id);
      }
    }
  } catch (error) {
    console.error('Notification check failed:', error);
  }
}

async function getBookingsFromDB() {
  // Здесь будет запрос к backend/clients для получения списка бронирований
  return [];
}

function shouldSendNotification(booking, now) {
  const bookingDate = new Date(`${booking.date} ${booking.time}`);
  const notificationDate = new Date(bookingDate.getTime() - booking.notificationTime * 60 * 60 * 1000);
  
  // Отправляем если до времени уведомления осталось меньше 30 минут
  const diff = notificationDate - now;
  return diff > 0 && diff < 30 * 60 * 1000;
}

async function sendNotification(booking) {
  // Отправка push-уведомления в браузере
  if ('Notification' in self && Notification.permission === 'granted') {
    await self.registration.showNotification('Напоминание о встрече', {
      body: `Встреча ${booking.date} в ${booking.time}`,
      icon: '/icon.png',
      badge: '/badge.png',
      tag: `booking-${booking.id}`
    });
  }
}

async function markNotificationSent(bookingId) {
  // Здесь будет запрос к backend для обновления статуса
}
