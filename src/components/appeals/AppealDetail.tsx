import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
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
  onSendResponse: (appeal: Appeal, mode: 'email' | 'chat') => void;
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
  const [replyMode, setReplyMode] = useState<'email' | 'chat'>('email');

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
    <div className="h-full flex flex-col overflow-hidden">
      <Button
        variant="ghost"
        size="sm"
        onClick={onBack}
        className="sm:hidden mb-3 self-start -ml-2 shrink-0"
      >
        <Icon name="ArrowLeft" size={20} className="mr-2" />
        Назад
      </Button>

      {/* Скроллируемый контент */}
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="mb-3 sm:mb-4 pb-3 sm:pb-4 border-b border-border">
          {/* Заголовок с кнопками */}
          <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                selectedAppeal.is_support
                  ? 'bg-orange-100 dark:bg-orange-950/50'
                  : 'bg-blue-100 dark:bg-blue-950/50'
              }`}>
                <Icon
                  name={selectedAppeal.is_support ? 'Settings' : 'User'}
                  size={18}
                  className={selectedAppeal.is_support ? 'text-orange-500' : 'text-blue-500'}
                />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-sm sm:text-base truncate text-foreground">
                  {selectedAppeal.user_name || selectedAppeal.user_email || selectedAppeal.user_identifier}
                </h3>
                <div className="flex items-center gap-1 flex-wrap">
                  {selectedAppeal.is_support && (
                    <span className="text-xs text-orange-500 font-medium">Тех поддержка</span>
                  )}
                  {selectedAppeal.user_email && (
                    <span className="text-xs text-muted-foreground truncate">{selectedAppeal.user_email}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {!selectedAppeal.is_read && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onMarkAsRead(selectedAppeal.id)}
                  disabled={loading}
                  className="h-7 w-7 p-0"
                  title="Отметить как прочитанное"
                >
                  <Icon name="Check" size={13} />
                </Button>
              )}
              {!selectedAppeal.is_archived ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onArchive(selectedAppeal.id)}
                  disabled={loading}
                  className="h-7 w-7 p-0"
                  title="В архив"
                >
                  <Icon name="Archive" size={13} />
                </Button>
              ) : (
                <Badge variant="secondary" className="text-xs">
                  <Icon name="Archive" size={10} className="mr-1" />
                  Архив
                </Badge>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDelete(selectedAppeal.id)}
                disabled={loading}
                className="h-7 w-7 p-0 text-red-500 hover:text-red-600 hover:border-red-300"
                title="Удалить"
              >
                <Icon name="Trash2" size={13} />
              </Button>
            </div>
          </div>

          {/* Мета-инфо */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
            <span className="flex items-center gap-1">
              <Icon name="Clock" size={12} />
              {formatDate(selectedAppeal.created_at)}
            </span>
          </div>

          {/* Блокировка */}
          {selectedAppeal.is_blocked && selectedAppeal.block_reason && (
            <div className="bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-3">
              <div className="flex items-start gap-2">
                <Icon name="ShieldAlert" size={16} className="text-red-500 mt-0.5 shrink-0" />
                <div>
                  <p className="font-semibold text-xs text-red-700 dark:text-red-400 mb-1">Причина блокировки:</p>
                  <p className="text-xs text-red-600 dark:text-red-300">{selectedAppeal.block_reason}</p>
                </div>
              </div>
            </div>
          )}

          {/* Сообщение */}
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 sm:p-4">
            <p className="font-semibold text-xs text-blue-700 dark:text-blue-400 mb-2">Сообщение:</p>
            <p className="text-xs sm:text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap break-words">
              {selectedAppeal.message}
            </p>
          </div>

          {/* Ответ */}
          {selectedAppeal.admin_response && (
            <div className="mt-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="CheckCircle" size={16} className="text-green-600 dark:text-green-400" />
                <p className="font-semibold text-xs text-green-700 dark:text-green-400">Ваш ответ:</p>
              </div>
              <p className="text-xs sm:text-sm text-green-800 dark:text-green-200 whitespace-pre-wrap break-words">
                {selectedAppeal.admin_response}
              </p>
              <p className="text-xs text-green-600 dark:text-green-500 mt-2">
                {formatDate(selectedAppeal.responded_at!)}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Форма ответа — всегда внизу */}
      <div className="shrink-0 pt-3 border-t border-border">
        {/* Переключатель способа отправки */}
        <div className="flex items-center gap-1 mb-3 p-1 bg-muted rounded-lg w-full">
          <button
            onClick={() => setReplyMode('email')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
              replyMode === 'email'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Icon name="Mail" size={13} />
            На email
          </button>
          <button
            onClick={() => setReplyMode('chat')}
            disabled={!selectedAppeal.is_support}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-md text-xs font-medium transition-all ${
              replyMode === 'chat'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            } disabled:opacity-40 disabled:cursor-not-allowed`}
          >
            <Icon name="MessageCircle" size={13} />
            В чат
          </button>
        </div>

        <p className="text-xs text-muted-foreground mb-2">
          {replyMode === 'email'
            ? 'Ответ будет отправлен на email пользователя'
            : 'Ответ появится в чате тех. поддержки у пользователя'
          }
        </p>

        <Textarea
          value={responseText}
          onChange={(e) => onResponseChange(e.target.value)}
          placeholder="Напишите ответ пользователю..."
          className="min-h-[80px] sm:min-h-[100px] resize-none mb-3 text-sm bg-background"
          disabled={loading}
        />
        <Button
          onClick={() => onSendResponse(selectedAppeal, replyMode)}
          disabled={loading || !responseText.trim()}
          className="w-full text-sm"
        >
          {loading ? (
            <>
              <Icon name="Loader2" size={15} className="mr-2 animate-spin" />
              Отправка...
            </>
          ) : replyMode === 'email' ? (
            <>
              <Icon name="Send" size={15} className="mr-2" />
              Отправить на email
            </>
          ) : (
            <>
              <Icon name="MessageCircle" size={15} className="mr-2" />
              Отправить в чат
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default AppealDetail;
