export interface Booking {
  id: number;
  date: Date;
  booking_date?: string;
  booking_time?: string;
  time: string;
  title?: string;
  description: string;
  notificationEnabled: boolean;
  notification_enabled?: boolean;
  notificationTime: number;
  notification_time?: number;
  clientId: number;
  client_id?: number;
  location?: string;
}

export interface ShootingStyle {
  id: string;
  name: string;
  order: number;
}

export interface Project {
  id: number;
  name: string;
  status: 'new' | 'in_progress' | 'completed' | 'cancelled';
  budget: number;
  startDate: string;
  endDate?: string;
  description: string;
  dateHistory?: { oldDate: string; newDate: string; changedAt: string }[];
  photoDownloadUrl?: string;
  photoDownloadedAt?: string;
  shootingStyleId?: string;
  shooting_time?: string;
  shooting_duration?: number;
  shooting_address?: string;
  add_to_calendar?: boolean;
  google_event_id?: string;
  synced_at?: string;
}

export interface Document {
  id: number;
  name: string;
  fileUrl: string;
  uploadDate: string;
}

export interface Payment {
  id: number;
  amount: number;
  date: string;
  status: 'pending' | 'completed' | 'cancelled';
  method: 'card' | 'cash' | 'transfer';
  description: string;
  projectId?: number;
}

export interface Message {
  id: number;
  date: string;
  type: 'email' | 'vk' | 'phone' | 'meeting';
  content: string;
  author: string;
}

export interface Comment {
  id: number;
  date: string;
  author: string;
  text: string;
}

export type ProjectStatusColor = 'blue' | 'yellow' | 'green' | 'gray';

export interface Client {
  id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  vkProfile?: string;
  vk_username?: string;
  birthdate?: string;
  bookings: Booking[];
  projects?: Project[];
  documents?: Document[];
  payments?: Payment[];
  messages?: Message[];
  comments?: Comment[];
  created_at?: string;
  
  shooting_date?: string;
  shooting_time?: string;
  shooting_duration?: number;
  shooting_address?: string;
  project_price?: number;
  project_comments?: string;
  google_event_id?: string;
  synced_at?: string;
  
  telegram_chat_id?: string;
  telegram_verified?: boolean;
  telegram_verified_at?: string;
}