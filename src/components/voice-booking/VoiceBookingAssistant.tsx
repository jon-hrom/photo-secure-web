import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { useToast } from '@/components/ui/use-toast';
import useSpeechRecognition from './useSpeechRecognition';
import useRealtimeVoice from './useRealtimeVoice';
import parseBooking, { type ParsedBooking } from './parseBooking';
import { createBooking } from './bookingService';
import { isSubmitIntent, isFarewell } from './intents';
import func2url from '../../../backend/func2url.json';

const EMPTY: ParsedBooking = { name: '', phone: '', date: '', shootType: '', comment: '' };
const REALTIME_API = (func2url as Record<string, string>)['voice-realtime'];
const USER_SETTINGS_API = 'https://functions.poehali.dev/8ce3cb93-2701-441d-aa3b-e9c0e99a9994';

/** Первая фраза агента: здоровается по имени и сразу объясняет, что готов писать. */
function buildGreeting(photographerName: string): string {
  const who = photographerName ? `, ${photographerName}` : '';
  return (
    `Начни разговор сам. Скажи ровно две короткие фразы: сначала «Здравствуйте${who}!», `
    + 'затем «Готов записать данные вашего клиента». Ничего не спрашивай и не добавляй.'
  );
}

export default function VoiceBookingAssistant() {
  const { toast } = useToast();
  const { supported, listening, finalText, interimText, error, start, stop, reset } =
    useSpeechRecognition('ru-RU');
  const rt = useRealtimeVoice();
  const [fields, setFields] = useState<ParsedBooking>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [yandexReady, setYandexReady] = useState<boolean | null>(null);
  const [photographerName, setPhotographerName] = useState('');

  // Имя фотографа из кабинета — агент поздоровается лично, а не безлико.
  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId) return;
    fetch(`${USER_SETTINGS_API}?user_id=${userId}`, { headers: { 'X-User-Id': userId } })
      .then((r) => r.json())
      .then((d) => {
        const s = d?.settings || {};
        const name = (s.display_name || s.name || '').trim();
        // В настройках может лежать email — как имя он не годится
        if (name && !name.includes('@')) setPhotographerName(name.split(' ')[0]);
      })
      .catch(() => { /* не критично: поздороваемся без имени */ });
  }, []);

  // Агент сам распознаёт данные в разговоре и присылает их — переносим в анкету.
  // Уже заполненное не затираем: клиент мог назвать телефон в одной фразе, а дату в другой.
  useEffect(() => {
    const f = rt.fields;
    if (!f || Object.keys(f).length === 0) return;
    setFields((prev) => ({
      name: f.name || prev.name,
      phone: f.phone || prev.phone,
      date: f.date || prev.date,
      shootType: f.shootType || prev.shootType,
      comment: f.comment || prev.comment,
    }));
  }, [rt.fields]);

  useEffect(() => {
    const userId = localStorage.getItem('userId');
    if (!userId || !REALTIME_API) return;
    fetch(REALTIME_API, { headers: { 'X-User-Id': userId } })
      .then((r) => r.json())
      .then((d) => setYandexReady(!!d.configured))
      .catch(() => setYandexReady(false));
  }, []);

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

  // Заявка за разговор создаётся один раз: иначе «создавай заявку» + прощание
  // агента завели бы в базе двух одинаковых клиентов.
  const savedRef = useRef(false);
  const saveBtnRef = useRef<HTMLButtonElement>(null);

  const handleReset = () => {
    stop();
    reset();
    rt.disconnect();
    setFields(EMPTY);
    savedRef.current = false;
  };

  const saveBooking = useCallback(
    async (data: ParsedBooking, auto = false, keepSession = false) => {
      setSaving(true);
      const res = await createBooking(data);
      setSaving(false);
      if (res.ok) {
        toast({
          title: auto ? 'Клиент создан автоматически' : 'Заявка создана',
          description: res.bookingCreated
            ? 'Карточка клиента добавлена, съёмка появится в календаре.'
            : 'Новый клиент добавлен в базу.',
        });
        // Во время живого разговора сессию не рвём: клиент ещё слушает агента,
        // а тот должен спокойно попрощаться. Очистка будет после прощания.
        if (!keepSession) handleReset();
        return true;
      }
      savedRef.current = false;
      toast({ title: 'Не удалось создать заявку', description: res.error, variant: 'destructive' });
      return false;
    },
    [toast],
  );

  const handleSave = () => {
    if (savedRef.current && saving) return;
    savedRef.current = true;
    return saveBooking(fields, false, rt.connected);
  };

  // «Создавайте заявку» — нажимаем кнопку сохранения сами, чтобы фотографу
  // не приходилось трогать экран во время разговора с клиентом.
  useEffect(() => {
    if (!rt.connected || savedRef.current) return;
    if (!isSubmitIntent(rt.userTranscript)) return;
    // Небольшая пауза: поля из этой же реплики попадают в анкету на том же кадре
    const t = setTimeout(() => {
      const btn = saveBtnRef.current;
      if (!btn || btn.disabled || savedRef.current) return;
      btn.click();
    }, 400);
    return () => clearTimeout(t);
  }, [rt.userTranscript, rt.connected]);

  // Агент попрощался — разговор окончен, закрываем сессию, чтобы микрофон
  // и токены Realtime не тратились на тишину.
  //
  // ВАЖНО: агент любит закончить любую реплику словами «Хорошего дня!», даже
  // когда ещё переспрашивает недостающие данные. Обрывать разговор на этом
  // нельзя — завершаем только если заявка уже сохранена либо собраны имя
  // и телефон (то есть прощание действительно финальное).
  useEffect(() => {
    if (!rt.connected || !isFarewell(rt.assistantTranscript)) return;
    // Ждём, пока агент договорит: во время речи статус — speaking
    if (rt.status === 'speaking' || rt.status === 'thinking') return;

    const dataReady = savedRef.current || (!!fields.name && !!fields.phone);
    if (!dataReady) return; // данных мало — продолжаем слушать, не отключаемся

    const t = setTimeout(() => {
      // Заявка уже в базе — чистим и анкету, иначе оставляем данные:
      // их подхватит авто-сохранение ниже.
      if (savedRef.current) handleReset();
      else rt.disconnect();
      toast({
        title: 'Разговор завершён',
        description: 'Ассистент попрощался — сессия закрыта, микрофон выключен.',
      });
    }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rt.assistantTranscript, rt.status, rt.connected, fields.name, fields.phone, toast]);

  // Разговор завершён — если данных достаточно, заводим карточку клиента сами.
  const wasConnected = useRef(false);
  useEffect(() => {
    if (rt.connected) {
      wasConnected.current = true;
      return;
    }
    if (!wasConnected.current) return;
    wasConnected.current = false;

    // Нужны имя и телефон, иначе карточка будет бесполезной — оставляем
    // заполнение фотографу, данные уже подставлены в анкету.
    if (savedRef.current || !fields.name || !fields.phone) return;
    savedRef.current = true;
    void saveBooking(fields, true);
  }, [rt.connected, fields, saveBooking]);

  const setField = (k: keyof ParsedBooking, v: string) =>
    setFields((prev) => ({ ...prev, [k]: v }));

  return (
    <div className="max-w-2xl mx-auto space-y-6 p-4">
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Голосовой приём заявок</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Нажмите на микрофон и продиктуйте заявку: имя, телефон, дату и тип съёмки
        </p>
        {yandexReady !== null && (
          <div className="flex justify-center pt-1">
            <Badge
              variant="outline"
              className={
                yandexReady
                  ? 'border-emerald-300 text-emerald-600 dark:text-emerald-400'
                  : 'border-gray-300 text-gray-500'
              }
            >
              <Icon name={yandexReady ? 'CheckCircle2' : 'Circle'} size={12} className="mr-1" />
              {yandexReady ? 'Yandex Realtime подключён' : 'Yandex Realtime не настроен'}
            </Badge>
          </div>
        )}
      </div>

      {/* Живой голосовой диалог через Yandex Realtime (агент отвечает голосом) */}
      {yandexReady && (
        <Card className="border-violet-200 dark:border-violet-800">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Icon name="Sparkles" size={18} className="text-violet-500" />
              Голосовой диалог с агентом
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4">
            <button
              onClick={
                rt.connected
                  ? rt.disconnect
                  : () => rt.connect({
                      userName: photographerName,
                      greeting: buildGreeting(photographerName),
                    })
              }
              className={`w-24 h-24 rounded-full flex items-center justify-center transition-all shadow-lg ${
                rt.status === 'speaking'
                  ? 'bg-emerald-500 animate-pulse'
                  : rt.status === 'thinking'
                  ? 'bg-amber-500'
                  : rt.connected
                  ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                  : 'bg-violet-500 hover:bg-violet-600'
              }`}
              aria-label={rt.connected ? 'Завершить диалог' : 'Начать диалог'}
            >
              <Icon
                name={
                  rt.status === 'connecting' || rt.status === 'thinking'
                    ? 'Loader'
                    : rt.connected
                    ? 'PhoneOff'
                    : 'Phone'
                }
                size={38}
                className={`text-white ${
                  rt.status === 'connecting' || rt.status === 'thinking' ? 'animate-spin' : ''
                }`}
              />
            </button>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
              {rt.status === 'connecting' && 'Подключаюсь…'}
              {rt.status === 'listening' && 'Слушаю вас — говорите'}
              {rt.status === 'thinking' && 'Готовлю ответ…'}
              {rt.status === 'speaking' && 'Агент говорит…'}
              {rt.status === 'idle' && 'Нажмите — агент поздоровается и начнёт приём заявки'}
              {rt.status === 'error' && 'Ошибка соединения'}
            </p>

            {(rt.assistantTranscript || rt.userTranscript) && (
              <div className="w-full space-y-2">
                {rt.assistantTranscript && (
                  <div className="rounded-lg bg-violet-50 dark:bg-violet-950/40 p-3 text-sm text-violet-900 dark:text-violet-100">
                    <span className="font-semibold">Агент: </span>{rt.assistantTranscript}
                  </div>
                )}
                {rt.userTranscript && (
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-3 text-sm text-gray-700 dark:text-gray-200">
                    <span className="font-semibold">Клиент: </span>{rt.userTranscript}
                  </div>
                )}
              </div>
            )}
            {rt.error && (
              <p
                className={`text-sm ${
                  // «Не расслышал» — это подсказка, а не поломка: красным не пугаем
                  rt.error.startsWith('Не расслышал')
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-red-500'
                }`}
              >
                {rt.error}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {!supported && (
        <Card className="border-amber-300 bg-amber-50 dark:bg-amber-950/30">
          <CardContent className="pt-6 text-sm text-amber-800 dark:text-amber-200">
            Ваш браузер не поддерживает голосовой ввод. Откройте сайт в Chrome или Edge —
            либо заполните поля вручную ниже.
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Icon name="Mic" size={18} className="text-gray-500" />
            {yandexReady ? 'Быстрая диктовка (без диалога)' : 'Голосовая диктовка'}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <button
            onClick={listening ? stop : start}
            disabled={!supported}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all shadow-lg disabled:opacity-40 ${
              listening
                ? 'bg-red-500 hover:bg-red-600 animate-pulse'
                : 'bg-gray-500 hover:bg-gray-600'
            }`}
            aria-label={listening ? 'Остановить' : 'Говорить'}
          >
            <Icon name={listening ? 'Square' : 'Mic'} size={34} className="text-white" />
          </button>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
            {listening ? 'Слушаю… говорите' : 'Нажмите, чтобы продиктовать заявку'}
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
            {rt.connected && (
              <Badge
                variant="outline"
                className="ml-auto border-violet-300 text-violet-600 dark:text-violet-400 font-normal"
              >
                <Icon name="Sparkles" size={11} className="mr-1" />
                Заполняется голосом
              </Badge>
            )}
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
            <Button ref={saveBtnRef} onClick={handleSave} disabled={saving || (!fields.name && !fields.phone)} className="bg-violet-500 hover:bg-violet-600">
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
        {yandexReady
          ? 'Агент слышит данные клиента, сам заполняет анкету, а в конце разговора создаёт карточку клиента.'
          : 'Быстрая диктовка работает через ваш браузер. Подключите Yandex Realtime для полноценного голосового диалога.'}
      </p>
    </div>
  );
}