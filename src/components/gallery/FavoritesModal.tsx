import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface FavoriteFolder {
  id: string;
  name: string;
  fields: {
    fullName: boolean;
    phone: boolean;
    email: boolean;
  };
}

interface FavoritesModalProps {
  isOpen: boolean;
  onClose: () => void;
  folder: FavoriteFolder;
  onSubmit: (data: { fullName: string; phone: string; email?: string; client_id?: number }) => void;
  galleryCode: string;
  photoId?: number | null;
  mode?: 'favorites' | 'register';
}

export default function FavoritesModal({ isOpen, onClose, folder, onSubmit, galleryCode, photoId, mode = 'favorites' }: FavoritesModalProps) {
  const [formData, setFormData] = useState({
    fullName: '',
    phone: '',
    email: ''
  });
  const [errors, setErrors] = useState({
    fullName: '',
    phone: '',
    email: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const isRegisterMode = mode === 'register';

  const validateForm = () => {
    const newErrors = {
      fullName: '',
      phone: '',
      email: ''
    };

    if (folder.fields.fullName && !formData.fullName.trim()) {
      newErrors.fullName = 'Поле обязательно для заполнения';
    }

    if (folder.fields.phone && !formData.phone.trim()) {
      newErrors.phone = 'Поле обязательно для заполнения';
    } else if (folder.fields.phone && !/^[\d+\-()\s]+$/.test(formData.phone)) {
      newErrors.phone = 'Некорректный формат телефона';
    }

    if (folder.fields.email && formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Некорректный формат email';
    }

    setErrors(newErrors);
    return !newErrors.fullName && !newErrors.phone && !newErrors.email;
  };

  const normalizePhone = (phone: string): string => {
    let cleaned = phone.replace(/[^\d+]/g, '');
    
    if (cleaned.startsWith('8')) {
      cleaned = '+7' + cleaned.substring(1);
    } else if (cleaned.startsWith('7') && !cleaned.startsWith('+7')) {
      cleaned = '+7' + cleaned.substring(1);
    } else if (!cleaned.startsWith('+7') && cleaned.length >= 10) {
      cleaned = '+7' + cleaned;
    }
    
    return cleaned;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm() || isSubmitting) return;
    
    setIsSubmitting(true);
    
    const normalizedPhone = normalizePhone(formData.phone);
    
    try {
      const body: Record<string, unknown> = {
        action: isRegisterMode ? 'register_client' : 'add_to_favorites',
        gallery_code: galleryCode,
        full_name: formData.fullName,
        phone: normalizedPhone,
        email: formData.email || null,
      };

      if (!isRegisterMode && photoId != null) {
        body.photo_id = photoId;
      }

      const response = await fetch('https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Ошибка при регистрации');
      }
      
      onSubmit({
        fullName: formData.fullName,
        phone: normalizedPhone,
        email: formData.email || undefined,
        client_id: result.client_id
      });
      
      setFormData({ fullName: '', phone: '', email: '' });
      setErrors({ fullName: '', phone: '', email: '' });
      onClose();
    } catch (error) {
      console.error('[FAVORITES] Error:', error);
      alert(error instanceof Error ? error.message : 'Ошибка при регистрации');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-md w-full p-6 border border-transparent dark:border-gray-700" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {isRegisterMode
              ? <Icon name="Download" size={24} className="text-blue-500" />
              : <Icon name="Star" size={24} className="text-yellow-500 fill-yellow-500" />
            }
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
              {isRegisterMode ? 'Скачать фото' : 'Добавить в избранное'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <Icon name="X" size={20} className="text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {isRegisterMode
          ? <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Оставьте свои данные, чтобы скачать фотографии из галереи.</p>
          : <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">Папка: {folder.name}</p>
        }

        <form onSubmit={handleSubmit} className="space-y-4">
          {folder.fields.fullName && (
            <div>
              <Label htmlFor="fullName" className="text-gray-700 dark:text-gray-300">ФИО <span className="text-red-500">*</span></Label>
              <Input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Иванов Иван Иванович"
                className={`bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 ${errors.fullName ? 'border-red-500' : ''}`}
              />
              {errors.fullName && <p className="text-red-500 text-sm mt-1">{errors.fullName}</p>}
            </div>
          )}

          {folder.fields.phone && (
            <div>
              <Label htmlFor="phone" className="text-gray-700 dark:text-gray-300">Телефон <span className="text-red-500">*</span></Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+7 (999) 123-45-67"
                className={`bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 ${errors.phone ? 'border-red-500' : ''}`}
              />
              {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
            </div>
          )}

          {folder.fields.email && (
            <div>
              <Label htmlFor="email" className="text-gray-700 dark:text-gray-300">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="example@mail.com"
                className={`bg-white dark:bg-gray-800 text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 placeholder:text-gray-400 dark:placeholder:text-gray-500 ${errors.email ? 'border-red-500' : ''}`}
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-800">
              Отмена
            </Button>
            <Button 
              type="submit" 
              className={`flex-1 ${isRegisterMode ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-yellow-500 hover:bg-yellow-600 text-gray-900'}`}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? (isRegisterMode ? 'Регистрация...' : 'Добавление...')
                : (isRegisterMode ? 'Зарегистрироваться' : 'Добавить')
              }
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}