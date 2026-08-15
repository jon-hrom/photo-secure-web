import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';

export type DeliveryState = 'pending' | 'sent' | 'delivered' | 'read' | 'failed';

export interface DeliveryReport {
  channel: 'MAX' | 'Telegram';
  clientName: string;
  clientContact: string;
  photographerNotified: boolean;
  state: DeliveryState;
  error?: string | null;
  dbMessageId?: number | null;
  messageId?: string | null;
}

interface DeliveryReportModalProps {
  report: DeliveryReport;
  userId: number;
  onClose: () => void;
}

const MAX_URL = 'https://functions.poehali.dev/6bd5e47e-49f9-4af3-a814-d426f5cd1f6d';

const STATE_TEXT: Record<DeliveryState, string> = {
  pending: 'Отправляем…',
  sent: 'Отправлено, ждём подтверждения',
  delivered: 'Доставлено клиенту',
  read: 'Клиент прочитал',
  failed: 'Не доставлено',
};

const STATE_ICON: Record<DeliveryState, string> = {
  pending: 'Loader',
  sent: 'Check',
  delivered: 'CheckCheck',
  read: 'Eye',
  failed: 'CircleAlert',
};

const STATE_COLOR: Record<DeliveryState, string> = {
  pending: 'text-gray-500',
  sent: 'text-amber-600 dark:text-amber-400',
  delivered: 'text-green-600 dark:text-green-400',
  read: 'text-green-600 dark:text-green-400',
  failed: 'text-red-600 dark:text-red-400',
};

export default function DeliveryReportModal({ report, userId, onClose }: DeliveryReportModalProps) {
  const [state, setState] = useState<DeliveryState>(report.state);
  const [error, setError] = useState<string | null>(report.error || null);

  useEffect(() => {
    if (report.channel !== 'MAX') return;
    if (!report.dbMessageId && !report.messageId) return;
    if (state === 'delivered' || state === 'read' || state === 'failed') return;

    let stopped = false;
    let attempts = 0;

    const check = async () => {
      attempts += 1;
      try {
        const resp = await fetch(MAX_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-User-Id': userId.toString(),
          },
          body: JSON.stringify({
            action: 'get_delivery_status',
            db_message_id: report.dbMessageId,
            message_id: report.messageId,
          }),
        });
        const data = await resp.json();
        if (stopped) return;
        if (data.success && data.delivery_status) {
          setState(data.delivery_status as DeliveryState);
          if (data.delivery_error) setError(data.delivery_error);
        }
      } catch {
        /* сеть подождёт до следующей попытки */
      }
      if (!stopped && attempts < 10) {
        setTimeout(check, 3000);
      }
    };

    const timer = setTimeout(check, 2000);
    return () => {
      stopped = true;
      clearTimeout(timer);
    };
  }, [report.channel, report.dbMessageId, report.messageId, userId, state]);

  const confirmed = state === 'delivered' || state === 'read';

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
        <div className="p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 ${confirmed ? 'text-green-600 dark:text-green-400' : 'text-amber-600 dark:text-amber-400'}`}>
              <Icon name={confirmed ? 'CheckCircle' : 'Send'} size={24} />
            </div>
            <div>
              <p className="font-semibold text-gray-900 dark:text-white">
                Уведомление отправлено
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Канал: {report.channel}
              </p>
            </div>
          </div>

          <div className="rounded-lg border border-gray-200 dark:border-gray-700 divide-y divide-gray-200 dark:divide-gray-700">
            <div className="p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Клиенту</p>
              <p className="text-sm font-medium text-gray-900 dark:text-white break-words">
                {report.clientName}
              </p>
              {report.clientContact && (
                <p className="text-xs text-gray-500 dark:text-gray-400">{report.clientContact}</p>
              )}
              <div className={`flex items-center gap-1.5 mt-2 text-sm ${STATE_COLOR[state]}`}>
                <Icon name={STATE_ICON[state]} size={16} />
                <span>{STATE_TEXT[state]}</span>
              </div>
              {error && (
                <p className="text-xs text-red-600 dark:text-red-400 mt-1">{error}</p>
              )}
            </div>

            <div className="p-3">
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Фотографу</p>
              <div className={`flex items-center gap-1.5 text-sm ${report.photographerNotified ? 'text-green-600 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                <Icon name={report.photographerNotified ? 'CheckCheck' : 'Minus'} size={16} />
                <span>
                  {report.photographerNotified
                    ? 'Копия сохранена в переписке'
                    : 'Копия не сохранена'}
                </span>
              </div>
            </div>
          </div>

          {!confirmed && state !== 'failed' && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Ждём подтверждение доставки от мессенджера. Обычно занимает несколько секунд — повторно отправлять не нужно.
            </p>
          )}

          <button
            onClick={onClose}
            className="w-full py-3 rounded-lg bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-medium text-sm hover:opacity-90 transition-opacity"
          >
            Понятно
          </button>
        </div>
      </div>
    </div>
  );
}
