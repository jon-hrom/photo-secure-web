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
  onSubmit: (data: { fullName: string; phone: string; email?: string }) => void;
}

export default function FavoritesModal({ isOpen, onClose, folder, onSubmit }: FavoritesModalProps) {
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

  if (!isOpen) return null;

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
    } else if (folder.fields.phone && !/^[\d\+\-\(\)\s]+$/.test(formData.phone)) {
      newErrors.phone = 'Некорректный формат телефона';
    }

    if (folder.fields.email && formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Некорректный формат email';
    }

    setErrors(newErrors);
    return !newErrors.fullName && !newErrors.phone && !newErrors.email;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit({
        fullName: formData.fullName,
        phone: formData.phone,
        ...(folder.fields.email && formData.email ? { email: formData.email } : {})
      });
      setFormData({ fullName: '', phone: '', email: '' });
      setErrors({ fullName: '', phone: '', email: '' });
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <Icon name="Star" size={24} className="text-yellow-500 fill-yellow-500" />
            <h2 className="text-2xl font-bold text-gray-900">Добавить в избранное</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
            <Icon name="X" size={20} className="text-gray-500" />
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-6">Папка: {folder.name}</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {folder.fields.fullName && (
            <div>
              <Label htmlFor="fullName">ФИО <span className="text-red-500">*</span></Label>
              <Input
                id="fullName"
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="Иванов Иван Иванович"
                className={errors.fullName ? 'border-red-500' : ''}
              />
              {errors.fullName && <p className="text-red-500 text-sm mt-1">{errors.fullName}</p>}
            </div>
          )}

          {folder.fields.phone && (
            <div>
              <Label htmlFor="phone">Телефон <span className="text-red-500">*</span></Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+7 (999) 123-45-67"
                className={errors.phone ? 'border-red-500' : ''}
              />
              {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
            </div>
          )}

          {folder.fields.email && (
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="example@mail.com"
                className={errors.email ? 'border-red-500' : ''}
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Отмена
            </Button>
            <Button type="submit" className="flex-1 bg-yellow-500 hover:bg-yellow-600">
              Добавить
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
