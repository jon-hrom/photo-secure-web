import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import Icon from '@/components/ui/icon';

const CLEANUP_URL = 'https://functions.poehali.dev/6d40325d-1316-4608-9a07-73ce5f9ed275';

export default function AdminCleanup() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ 
    success: boolean; 
    deleted?: number; 
    message?: string; 
    error?: string;
    details?: {
      bookings: number;
      payments: number;
      projects: number;
      documents: number;
      comments: number;
      messages: number;
    }
  } | null>(null);

  const handleCleanup = async () => {
    if (!confirm('Вы уверены? Это удалит все тестовые записи "Тестовый Клиент" и "Иванов Иван Иванович" из базы данных.')) {
      return;
    }

    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(CLEANUP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });

      const data = await response.json();
      setResult(data);
    } catch (error) {
      setResult({ success: false, error: String(error) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-8">
      <div className="max-w-2xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Icon name="Trash2" size={24} className="text-red-500" />
              Очистка тестовых данных
            </CardTitle>
            <CardDescription>
              Административная панель для удаления тестовых клиентов из базы данных
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Icon name="AlertCircle" size={16} />
              <AlertDescription>
                Эта операция удалит все тестовые записи (включая имена с "Тест", "test") 
                из базы данных вместе со всеми связанными данными (записи, проекты, платежи, документы).
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleCleanup}
              disabled={loading}
              variant="destructive"
              className="w-full"
            >
              {loading ? (
                <>
                  <Icon name="Loader2" size={16} className="animate-spin mr-2" />
                  Очистка...
                </>
              ) : (
                <>
                  <Icon name="Trash2" size={16} className="mr-2" />
                  Удалить тестовые данные
                </>
              )}
            </Button>

            {result && (
              <Alert variant={result.success ? 'default' : 'destructive'}>
                <Icon name={result.success ? 'CheckCircle2' : 'XCircle'} size={16} />
                <AlertDescription>
                  {result.success ? (
                    <>
                      <strong>Успешно!</strong> {result.message}
                      {result.details && (
                        <div className="mt-2 text-sm text-muted-foreground">
                          <div>Детали удаления:</div>
                          <ul className="list-disc list-inside mt-1">
                            {result.details.bookings > 0 && <li>Записей: {result.details.bookings}</li>}
                            {result.details.projects > 0 && <li>Проектов: {result.details.projects}</li>}
                            {result.details.payments > 0 && <li>Платежей: {result.details.payments}</li>}
                            {result.details.documents > 0 && <li>Документов: {result.details.documents}</li>}
                            {result.details.comments > 0 && <li>Комментариев: {result.details.comments}</li>}
                            {result.details.messages > 0 && <li>Сообщений: {result.details.messages}</li>}
                          </ul>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <strong>Ошибка!</strong> {result.error}
                    </>
                  )}
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}