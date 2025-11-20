import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

interface Tariff {
  id: number;
  name: string;
  description: string;
  price: number;
  duration: string;
  features: string[];
  isActive: boolean;
  isPopular?: boolean;
}

interface TariffsPageProps {
  isAdmin?: boolean;
  userId?: string;
}

const TariffsPage = ({ isAdmin = false, userId }: TariffsPageProps) => {
  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [userTariff, setUserTariff] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingTariff, setEditingTariff] = useState<Tariff | null>(null);
  const [newTariff, setNewTariff] = useState({
    name: '',
    description: '',
    price: '',
    duration: '1 месяц',
    features: '',
  });

  useEffect(() => {
    loadTariffs();
    if (userId) {
      loadUserTariff();
    }
  }, [userId]);

  const loadTariffs = async () => {
    try {
      // TODO: Загрузка тарифов из backend
      // Временные данные для примера
      setTariffs([
        {
          id: 1,
          name: 'Базовый',
          description: 'Для начинающих фотографов',
          price: 0,
          duration: 'Бесплатно',
          features: ['До 10 клиентов', 'До 5 GB хранилища', 'Базовая аналитика'],
          isActive: true,
        },
        {
          id: 2,
          name: 'Профессионал',
          description: 'Для активных фотографов',
          price: 990,
          duration: '1 месяц',
          features: ['Неограниченно клиентов', '50 GB хранилища', 'Расширенная аналитика', 'Приоритетная поддержка'],
          isActive: true,
          isPopular: true,
        },
        {
          id: 3,
          name: 'Студия',
          description: 'Для фотостудий и команд',
          price: 2990,
          duration: '1 месяц',
          features: ['Неограниченно клиентов', '200 GB хранилища', 'Полная аналитика', 'Многопользовательский доступ', '24/7 поддержка'],
          isActive: true,
        },
      ]);
    } catch (error) {
      console.error('Error loading tariffs:', error);
      toast.error('Ошибка загрузки тарифов');
    } finally {
      setLoading(false);
    }
  };

  const loadUserTariff = async () => {
    try {
      // TODO: Загрузка текущего тарифа пользователя из backend
      setUserTariff(1); // По умолчанию базовый
    } catch (error) {
      console.error('Error loading user tariff:', error);
    }
  };

  const handleCreateTariff = () => {
    if (!newTariff.name || !newTariff.description || !newTariff.price) {
      toast.error('Заполните все обязательные поля');
      return;
    }

    const tariff: Tariff = {
      id: Date.now(),
      name: newTariff.name,
      description: newTariff.description,
      price: parseFloat(newTariff.price),
      duration: newTariff.duration,
      features: newTariff.features.split('\n').filter(f => f.trim()),
      isActive: true,
    };

    setTariffs([...tariffs, tariff]);
    setIsCreateDialogOpen(false);
    setNewTariff({ name: '', description: '', price: '', duration: '1 месяц', features: '' });
    toast.success('Тариф создан');
  };

  const handleUpdateTariff = () => {
    if (!editingTariff) return;

    setTariffs(tariffs.map(t => t.id === editingTariff.id ? editingTariff : t));
    setIsEditDialogOpen(false);
    setEditingTariff(null);
    toast.success('Тариф обновлён');
  };

  const handleDeleteTariff = (id: number) => {
    if (confirm('Удалить этот тариф?')) {
      setTariffs(tariffs.filter(t => t.id !== id));
      toast.success('Тариф удалён');
    }
  };

  const handleSelectTariff = async (tariffId: number) => {
    try {
      // TODO: Сохранение выбранного тарифа в backend
      setUserTariff(tariffId);
      toast.success('Тариф изменён');
    } catch (error) {
      toast.error('Ошибка изменения тарифа');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Тарифные планы</h2>
          <p className="text-muted-foreground mt-2">
            {isAdmin ? 'Управление тарифами платформы' : 'Выберите подходящий тариф для вашего бизнеса'}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setIsCreateDialogOpen(true)} size="lg">
            <Icon name="Plus" size={20} className="mr-2" />
            Создать тариф
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tariffs.map((tariff) => (
          <Card 
            key={tariff.id} 
            className={`relative ${tariff.isPopular ? 'border-primary border-2 shadow-lg' : ''} ${userTariff === tariff.id ? 'ring-2 ring-green-500' : ''}`}
          >
            {tariff.isPopular && (
              <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary">
                Популярный
              </Badge>
            )}
            {userTariff === tariff.id && (
              <Badge className="absolute -top-3 right-4 bg-green-500">
                Текущий
              </Badge>
            )}
            <CardHeader>
              <CardTitle className="text-2xl">{tariff.name}</CardTitle>
              <CardDescription>{tariff.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">{tariff.price === 0 ? 'Бесплатно' : `${tariff.price} ₽`}</span>
                {tariff.price > 0 && (
                  <span className="text-muted-foreground ml-2">/ {tariff.duration}</span>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {tariff.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Icon name="Check" size={20} className="text-green-500 flex-shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <div className="pt-4 space-y-2">
                {!isAdmin && (
                  <Button 
                    className="w-full"
                    variant={userTariff === tariff.id ? 'outline' : 'default'}
                    onClick={() => handleSelectTariff(tariff.id)}
                    disabled={userTariff === tariff.id}
                  >
                    {userTariff === tariff.id ? 'Активен' : 'Выбрать тариф'}
                  </Button>
                )}
                
                {isAdmin && (
                  <div className="flex gap-2">
                    <Button 
                      className="flex-1" 
                      variant="outline"
                      onClick={() => {
                        setEditingTariff(tariff);
                        setIsEditDialogOpen(true);
                      }}
                    >
                      <Icon name="Edit" size={16} className="mr-2" />
                      Изменить
                    </Button>
                    <Button 
                      variant="destructive"
                      onClick={() => handleDeleteTariff(tariff.id)}
                    >
                      <Icon name="Trash2" size={16} />
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Диалог создания тарифа */}
      <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Создать тариф</DialogTitle>
            <DialogDescription>
              Заполните информацию о новом тарифном плане
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Название</Label>
              <Input
                value={newTariff.name}
                onChange={(e) => setNewTariff({ ...newTariff, name: e.target.value })}
                placeholder="Профессионал"
              />
            </div>
            <div>
              <Label>Описание</Label>
              <Input
                value={newTariff.description}
                onChange={(e) => setNewTariff({ ...newTariff, description: e.target.value })}
                placeholder="Для активных фотографов"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Цена (₽)</Label>
                <Input
                  type="number"
                  value={newTariff.price}
                  onChange={(e) => setNewTariff({ ...newTariff, price: e.target.value })}
                  placeholder="990"
                />
              </div>
              <div>
                <Label>Период</Label>
                <Input
                  value={newTariff.duration}
                  onChange={(e) => setNewTariff({ ...newTariff, duration: e.target.value })}
                  placeholder="1 месяц"
                />
              </div>
            </div>
            <div>
              <Label>Возможности (по одной на строку)</Label>
              <Textarea
                value={newTariff.features}
                onChange={(e) => setNewTariff({ ...newTariff, features: e.target.value })}
                placeholder="Неограниченно клиентов&#10;50 GB хранилища&#10;Приоритетная поддержка"
                rows={5}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCreateTariff} className="flex-1">
                Создать
              </Button>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Отмена
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Диалог редактирования тарифа */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Редактировать тариф</DialogTitle>
          </DialogHeader>
          {editingTariff && (
            <div className="space-y-4">
              <div>
                <Label>Название</Label>
                <Input
                  value={editingTariff.name}
                  onChange={(e) => setEditingTariff({ ...editingTariff, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Описание</Label>
                <Input
                  value={editingTariff.description}
                  onChange={(e) => setEditingTariff({ ...editingTariff, description: e.target.value })}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Цена (₽)</Label>
                  <Input
                    type="number"
                    value={editingTariff.price}
                    onChange={(e) => setEditingTariff({ ...editingTariff, price: parseFloat(e.target.value) })}
                  />
                </div>
                <div>
                  <Label>Период</Label>
                  <Input
                    value={editingTariff.duration}
                    onChange={(e) => setEditingTariff({ ...editingTariff, duration: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Возможности (по одной на строку)</Label>
                <Textarea
                  value={editingTariff.features.join('\n')}
                  onChange={(e) => setEditingTariff({ ...editingTariff, features: e.target.value.split('\n').filter(f => f.trim()) })}
                  rows={5}
                />
              </div>
              <div className="flex gap-2">
                <Button onClick={handleUpdateTariff} className="flex-1">
                  Сохранить
                </Button>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default TariffsPage;
