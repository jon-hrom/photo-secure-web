import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { Payment, Project } from '@/components/clients/ClientsTypes';

interface ClientDetailPaymentsProps {
  payments: Payment[];
  projects: Project[];
  newPayment: { amount: string; method: string; description: string; projectId: string; date: string; splitAcrossProjects: boolean };
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
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-start sm:items-center space-x-2 p-3 bg-muted/50 rounded-lg">
              <Checkbox
                id="splitPayment"
                checked={newPayment.splitAcrossProjects}
                onCheckedChange={(checked) => setNewPayment({ 
                  ...newPayment, 
                  splitAcrossProjects: checked as boolean,
                  projectId: checked ? '' : newPayment.projectId 
                })}
                className="mt-0.5 sm:mt-0 flex-shrink-0"
              />
              <Label htmlFor="splitPayment" className="text-xs sm:text-sm font-normal cursor-pointer leading-tight">
                Оплата за все услуги (распределить сумму пропорционально недостающим оплатам)
              </Label>
            </div>
            {newPayment.splitAcrossProjects && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-700">
                <Icon name="Info" size={14} className="mt-0.5 shrink-0" />
                <p className="leading-tight">
                  Сумма будет автоматически распределена между всеми услугами пропорционально недостающим оплатам. 
                  Полностью оплаченные услуги будут пропущены.
                </p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Проект *</Label>
              <Select
                value={newPayment.projectId}
                onValueChange={(value) => setNewPayment({ ...newPayment, projectId: value })}
                disabled={newPayment.splitAcrossProjects}
              >
                <SelectTrigger className="text-xs sm:text-sm h-9">
                  <SelectValue placeholder={newPayment.splitAcrossProjects ? "Все проекты" : "Выберите проект"} />
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
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Сумма (₽) *</Label>
              <Input
                type="number"
                value={newPayment.amount}
                onChange={(e) => setNewPayment({ ...newPayment, amount: e.target.value })}
                placeholder="10000"
                className="text-xs sm:text-sm h-9"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Дата платежа</Label>
              <Input
                type="date"
                value={newPayment.date}
                onChange={(e) => setNewPayment({ ...newPayment, date: e.target.value })}
                className="text-xs sm:text-sm h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Способ оплаты</Label>
              <Select
                value={newPayment.method}
                onValueChange={(value) => setNewPayment({ ...newPayment, method: value })}
              >
                <SelectTrigger className="text-xs sm:text-sm h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="card">Карта</SelectItem>
                  <SelectItem value="cash">Наличные</SelectItem>
                  <SelectItem value="transfer">Перевод</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs sm:text-sm">Описание</Label>
              <Input
                value={newPayment.description}
                onChange={(e) => setNewPayment({ ...newPayment, description: e.target.value })}
                placeholder="Предоплата 50%"
                className="text-xs sm:text-sm h-9"
              />
            </div>
          </div>
          <Button onClick={handleAddPayment} className="w-full sm:w-auto h-9 text-xs sm:text-sm">
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