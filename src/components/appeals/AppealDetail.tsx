import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { Appeal } from './types';

interface AppealDetailProps {
  selectedAppeal: Appeal | null;
  responseText: string;
  loading: boolean;
  onBack: () => void;
  onMarkAsRead: (appealId: number) => void;
  onArchive: (appealId: number) => void;
  onDelete: (appealId: number) => void;
  onResponseChange: (text: string) => void;
  onSendResponse: (appeal: Appeal) => void;
  formatDate: (dateString: string) => string;
}

const AppealDetail = ({
  selectedAppeal,
  responseText,
  loading,
  onBack,
  onMarkAsRead,
  onArchive,
  onDelete,
  onResponseChange,
  onSendResponse,
  formatDate,
}: AppealDetailProps) => {
  if (!selectedAppeal) {
    return (
      <div className="h-full items-center justify-center text-muted-foreground hidden sm:flex">
        <div className="text-center">
          <Icon name="MousePointerClick" size={48} className="mx-auto mb-4 opacity-30" />
          <p>Выберите обращение для просмотра</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="sm:hidden mb-3 self-start -ml-2"
      >
        <Icon name="ArrowLeft" size={20} className="mr-2" />
        Назад
      </Button>
      <div className="flex-1 overflow-auto">
        <div className="mb-3 sm:mb-4 pb-3 sm:pb-4 border-b">
          <div className="flex items-center justify-between gap-2 mb-2 sm:mb-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <Icon name="User" size={18} className="text-blue-600 sm:hidden" />
              <Icon name="User" size={20} className="text-blue-600 hidden sm:block" />
              <h3 className="font-bold text-base sm:text-lg truncate">
                {selectedAppeal.user_email || selectedAppeal.user_identifier}
              </h3>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!selectedAppeal.is_read && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onMarkAsRead(selectedAppeal.id)}
                  disabled={loading}
                  className="h-7 text-xs"
                  title="Отметить как прочитанное"
                >
                  <Icon name="Check" size={12} />
                </Button>
              )}
              {!selectedAppeal.is_archived ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onArchive(selectedAppeal.id)}
                  disabled={loading}
                  className="h-7 text-xs"
                  title="В архив"
                >
                  <Icon name="Archive" size={12} />
                </Button>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  <Icon name="Archive" size={10} className="mr-1" />
                  В архиве
                </Badge>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelete(selectedAppeal.id)}
                disabled={loading}
                className="h-7 text-xs text-red-600 hover:text-red-700"
                title="Удалить обращение"
              >
                <Icon name="Trash2" size={12} />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm mb-3 sm:mb-4">
            <div className="flex items-center gap-2">
              <Icon name="Mail" size={16} className="text-muted-foreground" />
              <span>{selectedAppeal.user_email || 'Нет email'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Icon name="Clock" size={16} className="text-muted-foreground" />
              <span>{formatDate(selectedAppeal.created_at)}</span>
            </div>
          </div>

          {selectedAppeal.is_blocked && selectedAppeal.block_reason && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <div className="flex items-start gap-2">
                <Icon name="ShieldAlert" size={18} className="text-red-600 mt-0.5" />
                <div>
                  <p className="font-semibold text-sm text-red-900 mb-1">Причина блокировки:</p>
                  <p className="text-sm text-red-700">{selectedAppeal.block_reason}</p>
                </div>
              </div>
            </div>
          )}

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
            <p className="font-semibold text-xs sm:text-sm text-blue-900 mb-2">
              Сообщение от пользователя:
            </p>
            <p className="text-xs sm:text-sm text-blue-800 whitespace-pre-wrap break-words">
              {selectedAppeal.message}
            </p>
          </div>

          {selectedAppeal.admin_response && (
            <div className="mt-3 sm:mt-4 bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="CheckCircle" size={18} className="text-green-600" />
                <p className="font-semibold text-xs sm:text-sm text-green-900">Ваш ответ:</p>
              </div>
              <p className="text-xs sm:text-sm text-green-800 whitespace-pre-wrap break-words">
                {selectedAppeal.admin_response}
              </p>
              <p className="text-xs text-green-600 mt-2">
                Отправлено: {formatDate(selectedAppeal.responded_at!)}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-auto pt-3 sm:pt-4 border-t">
        <Label htmlFor="response" className="text-xs sm:text-sm font-semibold mb-2 block">
          Ответ пользователю (будет отправлен на email):
        </Label>
        <Textarea
          id="response"
          value={responseText}
          onChange={(e) => onResponseChange(e.target.value)}
          placeholder="Напишите ответ пользователю..."
          className="min-h-[100px] sm:min-h-[120px] resize-none mb-3 text-sm"
          disabled={loading}
        />
        <Button
          onClick={() => onSendResponse(selectedAppeal)}
          disabled={loading || !responseText.trim()}
          className="w-full text-sm sm:text-base"
          size="default"
        >
          {loading ? (
            <>
              <Icon name="Loader2" size={16} className="mr-2 animate-spin" />
              <span className="hidden sm:inline">Отправка...</span>
              <span className="sm:hidden">Отправка</span>
            </>
          ) : (
            <>
              <Icon name="Send" size={16} className="mr-2" />
              <span className="hidden sm:inline">Отправить ответ на email</span>
              <span className="sm:hidden">Отправить</span>
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default AppealDetail;
