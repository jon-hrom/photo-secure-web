import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useToast } from '@/components/ui/use-toast';
import useSpeechRecognition from './useSpeechRecognition';
import parseBooking, { type ParsedBooking } from './parseBooking';
import { createBooking } from './bookingService';

const EMPTY: ParsedBooking = { name: '', phone: '', date: '', shootType: '', comment: '' };

export default function VoiceBookingAssistant() {
  const { toast } = useToast();
  const { supported, listening, finalText, interimText, error, start, stop, reset } =
    useSpeechRecognition('ru-RU');
  const [fields, setFields] = useState<ParsedBooking>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!finalText) return;
    const parsed = parseBooking(finalText);
    setFields((prev) => ({
      name: parsed.name || prev.name,
      phone: parsed.phone || prev.phone,
      date: parsed.date || prev.date,
      shootType: parsed.shootType || prev.shootType,
      comment: finalText,
    }));
  }, [finalText]);

  const liveText = useMemo(
    () => [finalText, interimText].filter(Boolean).join(' '),
    [finalText, interimText],
  );

  const handleReset = () => {
    stop();
    reset();
    setFields(EMPTY);
  };

  const handleSave = async () => {
    setSaving(true);
    const res = await createBooking(fields);
    setSaving(false);
    if (res.ok) {
      toast({
        title: 'Заявка создана',
        description: res.bookingCreated
          ? 'Клиент добавлен, встреча появится в дашборде.'
          : 'Новый клиент добавлен в базу.',
      });
      handleReset();
    } else {
      toast({ title: 'Не удалось создать заявку', description: res.error, variant: 'destructive' });
    }
  };

  const setField = (k: keyof ParsedBooking, v: string) =>
    setFields((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Голосовой приём заявок</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Нажмите на микрофон и продиктуйте заявку: имя, телефон, дату и тип съёмки
        </p>
      </div>

      {!supported && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="pt-6 text-sm text-amber-800 dark:text-amber-200">
            Ваш браузер не поддерживает голосовой ввод. Откройте сайт в Chrome или Edge —
            либо заполните поля вручную ниже.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6 flex flex-col items-center gap-4">
          <button
            onClick={listening ? stop : start}
            disabled={!supported}
            className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg disabled:opacity-40 ${
              listening
                ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                : 'bg-violet-500 hover:bg-violet-600'
            }`}
            aria-label={listening ? 'Остановить' : 'Говорить'}
          >
            <Icon name={listening ? 'Square' : 'Mic'} size={40} className="text-white" />
          </button>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {listening ? 'Слушаю… говорите' : 'Нажмите, чтобы говорить'}
          </p>

          {liveText && (
            <div className="w-full rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-sm text-gray-700 dark:text-gray-200 min-h-[3rem]">
              {finalText}
              {interimText && <span className="text-gray-400"> {interimText}</span>}
            </div>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Icon name="ClipboardList" size={18} className="text-violet-500" />
            Данные заявки
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Имя клиента</Label>
            <Input value={fields.name} onChange={(e) => setField('name', e.target.value)} placeholder="Например, Анна" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Телефон</Label>
              <Input value={fields.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+7 (___) ___-__-__" />
            </div>
            <div className="space-y-1.5">
              <Label>Желаемая дата</Label>
              <Input type="date" value={fields.date} onChange={(e) => setField('date', e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Тип съёмки</Label>
            <Input value={fields.shootType} onChange={(e) => setField('shootType', e.target.value)} placeholder="Свадебная, Love Story, семейная…" />
            {fields.shootType && (
              <Badge className="bg-violet-500 text-white mt-1">{fields.shootType}</Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-2 pt-2">
            <Button onClick={handleSave} disabled={saving || (!fields.name && !fields.phone)} className="bg-violet-500 hover:bg-violet-600">
              <Icon name="Check" size={16} className="mr-1" />
              {saving ? 'Создаю…' : 'Создать заявку'}
            </Button>
            <Button variant="outline" onClick={handleReset}>
              <Icon name="RotateCcw" size={16} className="mr-1" />
              Очистить
            </Button>
          </div>
        </CardContent>
      </Card>

      <p className="text-xs text-center text-gray-400 dark:text-gray-500">
        Распознавание работает через ваш браузер. Позже его можно подключить к Yandex Realtime API
        для полноценного голосового диалога.
      </p>
    </div>
  );
}