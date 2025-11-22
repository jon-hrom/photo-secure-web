import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { Payment, Project } from '@/components/clients/ClientsTypes';

interface ClientDetailPaymentsProps {
  payments: Payment[];
  projects: Project[];
  newPayment: { amount: string; method: string; description: string; projectId: string };
  setNewPayment: (payment: any) => void;
  handleAddPayment: () => void;
  handleDeletePayment: (paymentId: number) => void;
  getPaymentStatusBadge: (status: Payment['status']) => JSX.Element;
  formatDate: (dateString: string) => string;
}

const ClientDetailPayments = ({
  payments,
  projects,
  newPayment,
  setNewPayment,
  handleAddPayment,
  handleDeletePayment,
  getPaymentStatusBadge,
  formatDate,
}: ClientDetailPaymentsProps) => {
  const getProjectById = (projectId?: number) => {
    return projects.find(p => p.id === projectId);
  };
  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Добавить платёж</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Проект *</Label>
              <Select
                value={newPayment.projectId}
                onValueChange={(value) => setNewPayment({ ...newPayment, projectId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выберите проект" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(project => (
                    <SelectItem key={project.id} value={String(project.id)}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Сумма (₽) *</Label>
              <Input
                type="number"
                value={newPayment.amount}
                onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                placeholder="10000"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Способ оплаты</Label>
              <Select
                value={newPayment.method}
                onValueChange={(value) => setNewPayment({ ...newPayment, method: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">Карта</SelectItem>
                  <SelectItem value="cash">Наличные</SelectItem>
                  <SelectItem value="transfer">Перевод</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Описание</Label>
              <Input
                value={newPayment.description}
                onChange={(e) => setNewPayment({ ...newPayment, description: e.target.value })}
                placeholder="Предоплата 50%"
              />
            </div>
          </div>
          <Button onClick={handleAddPayment}>
            <Icon name="Plus" size={16} className="mr-2" />
            Добавить платёж
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>История платежей</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground">
              Платежей пока нет
            </p>
          ) : (
            <div className="space-y-2">
              {payments.slice().reverse().map((payment) => {
                const project = getProjectById(payment.projectId);
                return (
                  <div key={payment.id} className="border rounded-lg p-4 flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-bold text-lg">
                          {payment.amount.toLocaleString('ru-RU')} ₽
                        </span>
                        {getPaymentStatusBadge(payment.status)}
                      </div>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {project && (
                          <>
                            <span className="font-medium text-foreground">{project.name}</span>
                            <span>•</span>
                          </>
                        )}
                        <span>{formatDate(payment.date)}</span>
                        <span>•</span>
                        <span>
                          {payment.method === 'card' && 'Карта'}
                          {payment.method === 'cash' && 'Наличные'}
                          {payment.method === 'transfer' && 'Перевод'}
                        </span>
                        {payment.description && (
                          <>
                            <span>•</span>
                            <span>{payment.description}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePayment(payment.id)}
                    >
                      <Icon name="Trash2" size={16} />
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default ClientDetailPayments;