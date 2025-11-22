import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import { Project, Payment, Comment } from '@/components/clients/ClientsTypes';

interface ClientDetailOverviewProps {
  projects: Project[];
  payments: Payment[];
  comments: Comment[];
  newComment: string;
  setNewComment: (comment: string) => void;
  handleAddComment: () => void;
  handleDeleteComment: (commentId: number) => void;
  formatDateTime: (dateString: string) => string;
}

const ClientDetailOverview = ({
  projects,
  payments,
  comments,
  newComment,
  setNewComment,
  handleAddComment,
  handleDeleteComment,
  formatDateTime,
}: ClientDetailOverviewProps) => {
  const totalBudget = projects.reduce((sum, p) => sum + p.budget, 0);
  const totalPaid = payments.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0);
  const totalRemaining = totalBudget - totalPaid;

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">Общий бюджет</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalBudget.toLocaleString('ru-RU')} ₽</div>
            <p className="text-xs text-muted-foreground mt-1">
              Проектов: {projects.length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">Оплачено с учетом  аванса</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {totalPaid.toLocaleString('ru-RU')} ₽
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Платежей: {payments.filter(p => p.status === 'completed').length}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">Остаток  суммы за все услуги</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {totalRemaining.toLocaleString('ru-RU')} ₽
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              К оплате от общего бюджета
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
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Textarea
              placeholder="Добавить комментарий..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={3}
            />
            <Button onClick={handleAddComment} size="sm">
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
                      <p className="text-sm">{comment.text}</p>
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