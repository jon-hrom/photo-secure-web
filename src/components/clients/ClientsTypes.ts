export interface Booking {
  id: number;
  date: Date;
  time: string;
  description: string;
  notificationEnabled: boolean;
  notificationTime: number;
  clientId: number;
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