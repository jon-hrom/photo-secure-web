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

export interface Project {
  id: number;
  name: string;
  status: 'new' | 'in_progress' | 'completed' | 'cancelled';
  budget: number;
  startDate: string;
  endDate?: string;
  description: string;
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
  bookings: Booking[];
  projects?: Project[];
  documents?: Document[];
  payments?: Payment[];
  messages?: Message[];
  comments?: Comment[];
}