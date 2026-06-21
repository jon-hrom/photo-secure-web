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

  features.push(`${Math.floor(plan.max_clients)} ${plan.max_clients === 1 ? 'клиент' : 'клиентов'}`);
  features.push(`${Math.floor(plan.quota_gb)} GB хранилища`);

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
