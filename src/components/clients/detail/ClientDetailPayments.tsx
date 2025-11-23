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
          <CardTitle className="text-base sm:text-lg">Добавить платёж</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm">Проект *</Label>
              <Select
                value={newPayment.projectId}
                onValueChange={(value) => setNewPayment({ ...newPayment, projectId: value })}
              >
                <SelectTrigger className="text-sm">
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
              <Label className="text-sm">Сумма (₽) *</Label>
              <Input
                type="number"
                value={newPayment.amount}
                onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                placeholder="10000"
                className="text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-sm">Способ оплаты</Label>
              <Select
                value={newPayment.method}
                onValueChange={(value) => setNewPayment({ ...newPayment, method: value })}
              >
                <SelectTrigger className="text-sm">
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
              <Label className="text-sm">Описание</Label>
              <Input
                value={newPayment.description}
                onChange={(e) => setNewPayment({ ...newPayment, description: e.target.value })}
                placeholder="Предоплата 50%"
                className="text-sm"
              />
            </div>
          </div>
          <Button onClick={handleAddPayment} className="w-full sm:w-auto">
            <Icon name="Plus" size={16} className="mr-2" />
            Добавить платёж
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base sm:text-lg">История платежей</CardTitle>
        </CardHeader>
        <CardContent>
          {payments.length === 0 ? (
            <p className="text-center py-8 text-sm text-muted-foreground">
              Платежей пока нет
            </p>
          ) : (
            <div className="space-y-2">
              {payments.slice().reverse().map((payment) => {
                const project = getProjectById(payment.projectId);
                return (
                  <div key={payment.id} className="border rounded-lg p-3 sm:p-4 animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="flex items-start sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-base sm:text-lg">
                          {payment.amount.toLocaleString('ru-RU')} ₽
                        </span>
                        {getPaymentStatusBadge(payment.status)}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePayment(payment.id)}
                        className="shrink-0"
                      >
                        <Icon name="Trash2" size={16} />
                      </Button>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm text-muted-foreground">
                      <div className="flex items-center gap-2 flex-wrap">
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
                            <span className="truncate">{payment.description}</span>
                          </>
                        )}
                      </div>
                    </div>
                    {!payment.projectId && projects.length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-xs text-orange-600 mb-1">⚠️ Платёж не привязан к проекту</p>
                      </div>
                    )}
                    {project && (
                      <div className="mt-2 pt-2 border-t">
                        <span className="text-xs text-muted-foreground">Проект: </span>
                        <span className="text-xs font-medium text-foreground">{project.name}</span>
                      </div>
                    )}
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