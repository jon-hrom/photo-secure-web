export const getAuthUserId = (): string | null => {
  const authSession = localStorage.getItem('authSession');
  if (authSession) {
    try {
      const session = JSON.parse(authSession);
      if (session.userId) return session.userId.toString();
    } catch {}
  }
  
  const vkUser = localStorage.getItem('vk_user');
  if (vkUser) {
    try {
      const userData = JSON.parse(vkUser);
      if (userData.user_id) return userData.user_id.toString();
      if (userData.vk_id) return userData.vk_id.toString();
    } catch {}
  }
  
  const googleUser = localStorage.getItem('google_user');
  if (googleUser) {
    try {
      const userData = JSON.parse(googleUser);
      if (userData.user_id) return userData.user_id.toString();
      if (userData.id) return userData.id.toString();
      if (userData.sub) return userData.sub.toString();
    } catch {}
  }
  
  return null;
};

export const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const daysLeft = 7 - days;
  
  if (daysLeft <= 0) return 'Удаляется...';
  if (daysLeft === 1) return '1 день до удаления';
  if (daysLeft <= 4) return `${daysLeft} дня до удаления`;
  return `${daysLeft} дней до удаления`;
};

export const formatDeleteDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}.${month}.${year}`;
};

export const getDaysLeftBadge = (dateStr: string) => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const daysLeft = 7 - days;
  
  return {
    days: daysLeft,
    variant: daysLeft <= 2 ? 'destructive' : daysLeft <= 4 ? 'default' : 'secondary',
    text: daysLeft <= 0 ? 'Удаление...' : `${daysLeft}д`
  };
};

export const getDaysLeft = (dateStr: string): number => {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return 7 - days;
};