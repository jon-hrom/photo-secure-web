import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { Badge } from '@/components/ui/badge';

interface Project {
  id: number;
  name: string;
  startDate: string;
  budget?: number;
  clientName?: string;
  clientId?: number;
  status?: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  description?: string;
  paidAmount?: number;
}

interface Payment {
  id: number;
  projectId: number;
  amount: number;
  date: string;
  method: string;
}

interface ProjectEditDialogProps {
  project: Project | null;
  open: boolean;
  onClose: () => void;
  userId?: string | null;
  onUpdate: () => void;
}

const ProjectEditDialog = ({ project, open, onClose, userId: propUserId, onUpdate }: ProjectEditDialogProps) => {
  const [editedProject, setEditedProject] = useState<Project | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [newPayment, setNewPayment] = useState({ amount: '', method: 'cash' });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (project) {
      setEditedProject({ ...project });
      fetchPayments();
    }
  }, [project]);

  const fetchPayments = async () => {
    if (!project) return;
    const userId = propUserId || localStorage.getItem('userId');
    if (!userId) return;

    try {
      const res = await fetch(`https://functions.poehali.dev/dfa7acb6-e4ef-43d5-a1be-47ffcb09760f?userId=${userId}&projectId=${project.id}`);
      const data = await res.json();
      setPayments(data);
    } catch (error) {
      console.error('Failed to load payments:', error);
    }
  };

  const handleSave = async () => {
    if (!editedProject) return;
    const userId = propUserId || localStorage.getItem('userId');
    if (!userId) return;

    setLoading(true);
    try {
      const res = await fetch('https://functions.poehali.dev/f95119e0-3c8c-49db-9c1f-de7411b59001', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          projectId: editedProject.id,
          updates: {
            name: editedProject.name,
            budget: editedProject.budget,
            startDate: editedProject.startDate,
            status: editedProject.status,
            description: editedProject.description,
          }
        })
      });

      if (res.ok) {
        onUpdate();
        onClose();
      }
    } catch (error) {
      console.error('Failed to update project:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddPayment = async () => {
    if (!editedProject || !newPayment.amount) return;
    const userId = propUserId || localStorage.getItem('userId');
    if (!userId) return;

    try {
      const res = await fetch('https://functions.poehali.dev/dfa7acb6-e4ef-43d5-a1be-47ffcb09760f', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          projectId: editedProject.id,
          amount: parseFloat(newPayment.amount),
          method: newPayment.method,
          date: new Date().toISOString().split('T')[0]
        })
      });

      if (res.ok) {
        setNewPayment({ amount: '', method: 'cash' });
        fetchPayments();
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to add payment:', error);
    }
  };

  const handleDeletePayment = async (paymentId: number) => {
    const userId = propUserId || localStorage.getItem('userId');
    if (!userId) return;

    try {
      const res = await fetch('https://functions.poehali.dev/dfa7acb6-e4ef-43d5-a1be-47ffcb09760f', {
        method: 'DELETE',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, paymentId })
      });

      if (res.ok) {
        fetchPayments();
        onUpdate();
      }
    } catch (error) {
      console.error('Failed to delete payment:', error);
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-700';
      case 'in_progress': return 'bg-blue-100 text-blue-700';
      case 'cancelled': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getStatusLabel = (status?: string) => {
    switch (status) {
      case 'completed': return 'Завершён';
      case 'in_progress': return 'В работе';
      case 'cancelled': return 'Отменён';
      default: return 'Ожидает';
    }
  };

  const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
  const remaining = (editedProject?.budget || 0) - totalPaid;

  if (!editedProject) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Edit" size={20} />
            Редактирование съёмки
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Основная информация */}
          <div className="space-y-4">
            <div>
              <Label>Название услуги</Label>
              <Input
                value={editedProject.name}
                onChange={(e) => setEditedProject({ ...editedProject, name: e.target.value })}
                placeholder="Свадебная съёмка"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Дата съёмки</Label>
                <Input
                  type="date"
                  value={editedProject.startDate}
                  onChange={(e) => setEditedProject({ ...editedProject, startDate: e.target.value })}
                />
              </div>

              <div>
                <Label>Бюджет (₽)</Label>
                <Input
                  type="number"
                  value={editedProject.budget || ''}
                  onChange={(e) => setEditedProject({ ...editedProject, budget: parseFloat(e.target.value) || 0 })}
                  placeholder="50000"
                />
              </div>
            </div>

            <div>
              <Label>Статус</Label>
              <Select
                value={editedProject.status || 'pending'}
                onValueChange={(value: any) => setEditedProject({ ...editedProject, status: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Ожидает</SelectItem>
                  <SelectItem value="in_progress">В работе</SelectItem>
                  <SelectItem value="completed">Завершён</SelectItem>
                  <SelectItem value="cancelled">Отменён</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Описание</Label>
              <Textarea
                value={editedProject.description || ''}
                onChange={(e) => setEditedProject({ ...editedProject, description: e.target.value })}
                placeholder="Дополнительная информация о съёмке"
                rows={3}
              />
            </div>
          </div>

          {/* Финансы */}
          <div className="border-t pt-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Icon name="Wallet" size={18} />
                Финансы
              </h3>
              <div className="flex gap-3">
                <Badge variant="outline" className="text-sm">
                  Оплачено: {totalPaid.toLocaleString('ru-RU')} ₽
                </Badge>
                <Badge variant={remaining > 0 ? 'secondary' : 'default'} className="text-sm">
                  Осталось: {remaining.toLocaleString('ru-RU')} ₽
                </Badge>
              </div>
            </div>

            {/* Список платежей */}
            {payments.length > 0 && (
              <div className="space-y-2">
                {payments.map((payment) => (
                  <div key={payment.id} className="flex items-center justify-between bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center gap-3">
                      <Icon name="CreditCard" size={16} className="text-green-600" />
                      <div>
                        <div className="font-medium">{payment.amount.toLocaleString('ru-RU')} ₽</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(payment.date).toLocaleDateString('ru-RU')} • {payment.method === 'cash' ? 'Наличные' : payment.method === 'card' ? 'Карта' : 'Перевод'}
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePayment(payment.id)}
                    >
                      <Icon name="Trash2" size={14} className="text-red-600" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Добавить платёж */}
            <div className="bg-blue-50 rounded-lg p-4 space-y-3">
              <Label className="text-sm font-medium">Добавить платёж</Label>
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  placeholder="Сумма"
                  value={newPayment.amount}
                  onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                />
                <Select
                  value={newPayment.method}
                  onValueChange={(value) => setNewPayment({ ...newPayment, method: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Наличные</SelectItem>
                    <SelectItem value="card">Карта</SelectItem>
                    <SelectItem value="transfer">Перевод</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleAddPayment} size="sm" className="w-full">
                <Icon name="Plus" size={14} className="mr-1" />
                Добавить платёж
              </Button>
            </div>
          </div>

          {/* Кнопки */}
          <div className="flex gap-3 pt-4 border-t">
            <Button onClick={onClose} variant="outline" className="flex-1">
              Отмена
            </Button>
            <Button onClick={handleSave} disabled={loading} className="flex-1">
              {loading ? 'Сохранение...' : 'Сохранить'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ProjectEditDialog;