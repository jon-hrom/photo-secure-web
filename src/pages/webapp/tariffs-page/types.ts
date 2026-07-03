export const ROBOKASSA_URL = 'https://functions.poehali.dev/97e25c3b-c738-44e0-8922-87bbb4dc339d';
export const APPLY_TARIFF_URL = 'https://functions.poehali.dev/7565304f-3423-48fd-a77c-95c59c65714d';
export const STORAGE_ADMIN_URL = 'https://functions.poehali.dev/81fe316e-43c6-4e9f-93e2-63032b5c552c';
export const SUBSCRIPTION_URL = 'https://functions.poehali.dev/fbfc26c3-5cb7-4b8f-aeb7-891bbf9a0015';

export interface ResumablePaid {
  plan_id: number;
  plan_name: string;
  expires_at: string;
  quota_gb: number | null;
  max_clients: number | null;
}

export interface Plan {
  plan_id: number;
  plan_name: string;
  quota_gb: number;
  price_rub: number;
  max_clients: number;
  description: string;
  is_active: boolean;
  stats_enabled: boolean;
  track_storage_usage: boolean;
  track_client_count: boolean;
  track_booking_analytics: boolean;
  track_revenue: boolean;
  track_upload_history: boolean;
  track_download_stats: boolean;
}

export const getPlanFeatures = (plan: Plan): string[] => {
  const features: string[] = [];

  features.push(`${Math.floor(plan.max_clients)} ${plan.max_clients === 1 ? 'клиент' : plan.max_clients < 5 ? 'клиента' : 'клиентов'}`);
  features.push(`${Math.floor(plan.quota_gb)} ГБ хранилища`);

  if (plan.stats_enabled) {
    features.push('Статистика и аналитика');
  }
  if (plan.track_booking_analytics) {
    features.push('Аналитика бронирований');
  }
  if (plan.track_revenue) {
    features.push('Отслеживание доходов');
  }
  if (plan.track_upload_history) {
    features.push('История загрузок');
  }
  if (plan.track_download_stats) {
    features.push('Статистика скачиваний');
  }

  return features;
};

export const getPlanIcon = (planName: string): string => {
  const name = planName.toLowerCase();
  if (name.includes('старт') || name.includes('базов')) return 'Package';
  if (name.includes('проф')) return 'Zap';
  if (name.includes('бизнес')) return 'Crown';
  return 'Package';
};