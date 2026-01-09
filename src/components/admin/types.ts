export interface Plan {
  plan_id: number;
  plan_name: string;
  quota_gb: number;
  price_rub: number;
  is_active: boolean;
  visible_to_users: boolean;
  created_at: string;
}

export interface User {
  user_id: number;
  username: string;
  plan_id: number;
  plan_name: string;
  custom_quota_gb: number | null;
  used_gb: number;
  created_at: string;
}

export interface UsageStat {
  date: string;
  uploads: number;
  total_size_gb: number;
  unique_users: number;
}

export interface RevenueStat {
  plan_name: string;
  users_count: number;
  total_revenue: number;
}

export interface FinancialStat {
  date: string;
  storage_gb: number;
  active_users: number;
  total_revenue: number;
  estimated_cost: number;
}

export interface FinancialSummary {
  total_revenue: number;
  total_cost: number;
  profit: number;
  margin_percent: number;
}

export interface PromoCode {
  id: number;
  code: string;
  discount_type: 'percent' | 'fixed';
  discount_value: number;
  duration_months: number | null;
  max_uses: number | null;
  used_count: number;
  is_active: boolean;
  valid_from: string;
  valid_until: string | null;
  created_at: string;
  description: string;
}

export interface StorageInvoice {
  id: number;
  user_id: number;
  email: string;
  period: string;
  avg_gb: number;
  rate_rub_per_gb_month: number;
  amount_rub: number;
  status: 'pending' | 'paid' | 'cancelled';
  created_at: string;
  paid_at: string | null;
}

export interface DailyUsage {
  date: string;
  user_id: number;
  email?: string;
  used_gb_end_of_day: number;
}

export interface TrashFolder {
  id: number;
  user_id: number;
  folder_name: string;
  s3_prefix: string;
  trashed_at: string;
  photos_count: number;
  total_size_mb: number;
}

export const ADMIN_API = 'https://functions.poehali.dev/81fe316e-43c6-4e9f-93e2-63032b5c552c';
export const STORAGE_CRON_API = 'https://functions.poehali.dev/58924057-0ad9-432d-8d31-c0ec8bcd0ef4';
export const PHOTOBANK_CRON_API = 'https://functions.poehali.dev/f9358728-7a16-4276-8ca2-d24939d69b39';
