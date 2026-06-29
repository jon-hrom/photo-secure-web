import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import Icon from '@/components/ui/icon';
import { Project, Payment, Comment, Refund, ReserveTransaction } from '@/components/clients/ClientsTypes';
import { useEffect, useState } from 'react';

interface ClientDetailOverviewProps {
  projects: Project[];
  payments: Payment[];
  refunds: Refund[];
  comments: Comment[];
  newComment: string;
  setNewComment: (comment: string) => void;
  handleAddComment: () => void;
  handleDeleteComment: (commentId: number) => void;
  formatDateTime: (dateString: string) => string;
  reserveBalance?: number;
  reserveTransactions?: ReserveTransaction[];
}

const ClientDetailOverview = ({
  projects,
  payments,
  refunds,
  comments,
  newComment,
  setNewComment,
  handleAddComment,
  handleDeleteComment,
  formatDateTime,
  reserveBalance = 0,
  reserveTransactions = [],
}: ClientDetailOverviewProps) => {
  const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);
  // Сумма за аренду студии по всем активным проектам (studio_hourly_rate × длительность).
  // Входит в бюджет клиента, но не считается доходом фотографа.
  const studioTotal = projects
    .filter(p => p.status !== 'cancelled')
    .reduce((sum, p) => {
      const rate = Number(p.studio_hourly_rate) || 0;
      const hours = (Number(p.shooting_duration) || 0) / 60;
      return sum + Math.round(rate * hours);
    }, 0);
  const completedPayments = payments.filter(p => p.status === 'completed');
  const totalPaid = completedPayments.reduce((sum, p) => sum + p.amount, 0);
  const completedRefunds = refunds.filter(r => r.status === 'completed');
  const totalRefunded = completedRefunds.reduce((sum, r) => sum + r.amount, 0);
  const netPaid = totalPaid - totalRefunded;
  const totalRemaining = totalBudget - netPaid;
  // Чистый доход фотографа = весь бюджет минус аренда студии (студия — расход, не доход).
  const photographerIncome = Math.max(0, totalBudget - studioTotal);
  const lastRefund = completedRefunds.length > 0
    ? completedRefunds.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())[0]
    : null;

  // Сумма предоплат, перенесённых в финансовый резерв при отмене съёмок.
  const cancelledProjectIds = new Set(projects.filter(p => p.status === 'cancelled').map(p => p.id));
  const movedToReserve = reserveTransactions
    .filter(tx => tx.amount > 0 && tx.targetProjectId != null && cancelledProjectIds.has(tx.targetProjectId))
    .reduce((sum, tx) => sum + tx.amount, 0);

  const [animateKey, setAnimateKey] = useState(0);

  useEffect(() => {
    setAnimateKey(prev => prev + 1);
  }, [totalPaid, totalRemaining, totalRefunded]);

  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    };

    document.addEventListener('focusin', handleFocus);
    return () => document.removeEventListener('focusin', handleFocus);
  }, []);

  return (
    <>
      <div className={`grid grid-cols-1 sm:grid-cols-2 ${totalRefunded > 0 ? 'lg:grid-cols-5' : 'lg:grid-cols-4'} gap-3 sm:gap-4`}>
        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">Общий бюджет</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-red-600">
              <span key={`budget-${animateKey}`} className="inline-block animate-in fade-in duration-300">{totalBudget.toLocaleString('ru-RU')} ₽</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Проектов: {projects.length}
            </p>
            {studioTotal > 0 && (
              <div className="mt-2 pt-2 border-t border-border/60 space-y-0.5 text-xs">
                <p className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Icon name="Camera" size={12} className="text-emerald-600 dark:text-emerald-400" />
                    Доход фотографа
                  </span>
                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">{photographerIncome.toLocaleString('ru-RU')} ₽</span>
                </p>
                <p className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Icon name="Building2" size={12} className="text-blue-600 dark:text-blue-400" />
                    За студию
                  </span>
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{studioTotal.toLocaleString('ru-RU')} ₽</span>
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-foreground flex items-center gap-2">Оплачено с учетом аванса</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              <span key={`paid-${animateKey}`} className="inline-block animate-in fade-in zoom-in-50 duration-500">{netPaid.toLocaleString('ru-RU')} ₽</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Платежей: {completedPayments.length}
              {totalRefunded > 0 && (
                <span className="text-orange-600"> (возвраты: −{totalRefunded.toLocaleString('ru-RU')} ₽)</span>
              )}
            </p>
            {movedToReserve > 0 && (
              <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1 flex items-center gap-1">
                <Icon name="PiggyBank" size={12} className="shrink-0" />
                {movedToReserve.toLocaleString('ru-RU')} ₽ перенесено в финансовый резерв (отмена съёмки)
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-foreground flex items-center gap-2">Остаток суммы за все услуги</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold text-foreground">
              <span key={`remaining-${animateKey}`} className="inline-block animate-in fade-in zoom-in-50 duration-500">{totalRemaining.toLocaleString('ru-RU')} ₽</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              К оплате от общего бюджета
            </p>
          </CardContent>
        </Card>

        {totalRefunded > 0 && (
          <Card className="border-orange-500/50 bg-gradient-to-br from-orange-500/10 to-orange-500/5 shadow-[0_0_20px_-5px_rgba(249,115,22,0.4)]">
            <CardHeader className="pb-2 sm:pb-3">
              <CardTitle className="text-xs sm:text-sm font-medium text-foreground flex items-center gap-2">
                <Icon name="RotateCcw" size={14} className="text-orange-500" />
                Возвращено
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-xl sm:text-2xl font-bold text-orange-500">
                <span key={`refunded-${animateKey}`} className="inline-block animate-in fade-in zoom-in-50 duration-500">
                  {totalRefunded.toLocaleString('ru-RU')} ₽
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {lastRefund ? `Последний: ${formatDateTime(lastRefund.date).split(' ')[0]}` : `Возвратов: ${completedRefunds.length}`}
              </p>
            </CardContent>
          </Card>
        )}

        <Card className={reserveBalance > 0 ? 'border-emerald-500/50 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 shadow-[0_0_20px_-5px_rgba(16,185,129,0.4)]' : ''}>
          <CardHeader className="pb-2 sm:pb-3">
            <CardTitle className="text-xs sm:text-sm font-medium text-foreground flex items-center gap-2">
              <Icon name="PiggyBank" size={14} className={reserveBalance > 0 ? 'text-emerald-500' : 'text-muted-foreground'} />
              Финансовый резерв
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className={`text-left w-full cursor-help text-xl sm:text-2xl font-bold ${reserveBalance > 0 ? 'text-emerald-500 hover:text-emerald-400' : 'text-muted-foreground'} transition-colors`}
                  aria-label="Подробнее о финансовом резерве"
                >
                  <span key={`reserve-${animateKey}`} className="inline-block animate-in fade-in zoom-in-50 duration-500">
                    {reserveBalance.toLocaleString('ru-RU')} ₽
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-80" align="end">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 font-semibold text-sm">
                    <Icon name="Info" size={14} className="text-emerald-500" />
                    Что это за сумма?
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Это переплата клиента, которую вы оставили в счёт следующих съёмок вместо выдачи сдачи. Резерв можно списать в счёт нового проекта при его создании или вручную через вкладку «Оплаты».
                  </p>
                  {reserveTransactions.length > 0 && (
                    <div className="pt-2 border-t">
                      <div className="text-xs font-semibold mb-1.5">История движений</div>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {reserveTransactions.slice(0, 10).map((tx) => (
                          <div key={tx.id} className="flex items-start justify-between gap-2 text-xs">
                            <div className="flex-1 min-w-0">
                              <div className={tx.amount >= 0 ? 'text-emerald-500 font-medium' : 'text-orange-500 font-medium'}>
                                {tx.amount >= 0 ? '+' : ''}{tx.amount.toLocaleString('ru-RU')} ₽
                              </div>
                              {tx.description && (
                                <div className="text-muted-foreground truncate">{tx.description}</div>
                              )}
                            </div>
                            <div className="text-muted-foreground whitespace-nowrap">
                              {formatDateTime(tx.date).split(' ')[0]}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground mt-1">
              {reserveBalance > 0 ? 'Доступно для нового проекта' : 'Нет накоплений'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Icon name="MessageSquare" size={18} />
              Комментарии
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 pb-20">
          <div className="space-y-2">
            <Textarea
              placeholder="Добавить комментарий..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
            />
            <Button onClick={handleAddComment} size="sm" className="h-11 touch-manipulation">
              <Icon name="Plus" size={16} className="mr-2" />
              Добавить комментарий
            </Button>
          </div>

          {comments.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Комментариев пока нет
            </p>
          ) : (
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {comments.slice().reverse().map((comment) => (
                <div key={comment.id} className="border rounded-lg p-3 bg-muted/30">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-medium text-sm">{comment.author}</span>
                        <span className="text-xs text-muted-foreground">
                          {formatDateTime(comment.date)}
                        </span>
                      </div>
                      <p className="text-sm text-foreground">{comment.text}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteComment(comment.id)}
                    >
                      <Icon name="Trash2" size={14} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
};

export default ClientDetailOverview;