import { useCallback, useEffect, useMemo, useState } from 'react';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { getAuthUserId } from '@/pages/photobank/PhotoBankAuth';
import funcUrls from '../../../backend/func2url.json';

const API = (funcUrls as Record<string, string>)['ai-services'];

interface ToolRow {
  tool: string;
  step: string;
  model: string;
  role: string;
  energy: number;
  note?: string;
  params: Record<string, string>;
  kind: 'media' | 'chat';
  base_price?: number | null;
  my_price?: number | null;
  margin?: number | null;
  discount?: number | null;
  available: boolean;
  deprecated?: boolean;
  approx?: boolean;
  price_in_1k?: number | null;
  price_out_1k?: number | null;
}

interface CatalogRow {
  model: string;
  type: string;
  variant: string;
  base_price: number | null;
  my_price: number | null;
  discount: number | null;
  used: boolean;
  deprecated: boolean;
}

interface GptunnelData {
  balance: number | null;
  tools: ToolRow[];
  catalog: CatalogRow[];
  models_total: number;
}

const rub = (v?: number | null) => (v == null ? '—' : `${v.toLocaleString('ru-RU', { maximumFractionDigits: 2 })} ₽`);

const marginClass = (m?: number | null) =>
  m == null ? 'text-muted-foreground' : m < 3 ? 'text-red-500' : m < 8 ? 'text-amber-500' : 'text-emerald-600 dark:text-emerald-400';

const GptunnelPanel = () => {
  const [data, setData] = useState<GptunnelData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [query, setQuery] = useState('');
  const [onlyUsed, setOnlyUsed] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const userId = getAuthUserId() || localStorage.getItem('user_id') || '';
      const r = await fetch(`${API}?action=gptunnel`, { headers: { 'X-User-Id': String(userId) } });
      const d = await r.json();
      if (!r.ok) throw new Error(d?.error || `HTTP ${r.status}`);
      setData(d);
      setUpdatedAt(new Date());
    } catch (e) {
      setError(String((e as Error)?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const catalog = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data?.catalog || []).filter(
      (r) => (!onlyUsed || r.used) && (!q || r.model.toLowerCase().includes(q) || (r.type || '').toLowerCase().includes(q)),
    );
  }, [data, query, onlyUsed]);

  const toolGroups = useMemo(() => {
    const map = new Map<string, ToolRow[]>();
    (data?.tools || []).forEach((t) => map.set(t.tool, [...(map.get(t.tool) || []), t]));
    return Array.from(map.entries());
  }, [data]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-xl border px-4 py-2.5 bg-gradient-to-br from-emerald-500/10 to-teal-500/10">
          <div className="text-[11px] text-muted-foreground">Баланс GPTunneL</div>
          <div className={`text-xl font-bold ${data?.balance != null && data.balance < 100 ? 'text-red-500' : ''}`}>
            {data ? rub(data.balance) : '…'}
          </div>
        </div>
        <div className="rounded-xl border px-4 py-2.5">
          <div className="text-[11px] text-muted-foreground">Моделей в каталоге</div>
          <div className="text-xl font-bold">{data?.models_total ?? '…'}</div>
        </div>
        <div className="flex-1" />
        <div className="text-xs text-muted-foreground">
          {updatedAt ? `Цены на ${updatedAt.toLocaleString('ru-RU')}` : ''}
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading} className="gap-1.5">
          <Icon name={loading ? 'Loader2' : 'RefreshCw'} size={14} className={loading ? 'animate-spin' : ''} />
          Обновить
        </Button>
        <Button size="sm" variant="outline" asChild className="gap-1.5">
          <a href="https://gptunnel.ru" target="_blank" rel="noreferrer">
            <Icon name="ExternalLink" size={14} />
            Кабинет
          </a>
        </Button>
      </div>

      {data?.balance != null && data.balance < 100 && (
        <div className="flex items-center gap-2 text-sm rounded-lg bg-red-500/10 text-red-600 dark:text-red-400 px-3 py-2">
          <Icon name="TriangleAlert" size={16} />
          Баланс заканчивается — AI-инструменты перестанут работать, когда он дойдёт до нуля.
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 text-sm rounded-lg bg-red-500/10 text-red-600 px-3 py-2">
          <Icon name="CircleAlert" size={16} />
          {error}
        </div>
      )}

      <div className="space-y-2">
        <h4 className="font-semibold flex items-center gap-2">
          <Icon name="Wrench" size={16} className="text-primary" />
          Инструменты проекта и цена за 1 запрос
        </h4>
        <p className="text-xs text-muted-foreground">
          «Ваша цена» — с учётом вашей скидки в GPTunneL. «Берём» — сколько ⚡ списывается с пользователя (1 ⚡ = 1 ₽). «Остаётся» — разница.
        </p>
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-xs text-muted-foreground">
              <tr>
                <th className="text-left font-medium px-3 py-2">Инструмент / этап</th>
                <th className="text-left font-medium px-3 py-2">Модель</th>
                <th className="text-right font-medium px-3 py-2">Прайс</th>
                <th className="text-right font-medium px-3 py-2">Ваша цена</th>
                <th className="text-right font-medium px-3 py-2">Берём</th>
                <th className="text-right font-medium px-3 py-2">Остаётся</th>
              </tr>
            </thead>
            <tbody>
              {toolGroups.map(([tool, rows]) =>
                rows.map((r, i) => (
                  <tr key={`${tool}-${i}`} className={`border-t ${i === 0 ? 'border-t-2' : ''}`}>
                    <td className="px-3 py-2 align-top">
                      {i === 0 && <div className="font-semibold">{tool}</div>}
                      <div className="text-xs text-muted-foreground">{r.step}</div>
                    </td>
                    <td className="px-3 py-2 align-top">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-mono text-xs">{r.model}</span>
                        {Object.values(r.params || {}).filter((v) => v !== 'auto').map((v) => (
                          <span key={v} className="text-[10px] px-1.5 py-0.5 rounded bg-muted">{v}</span>
                        ))}
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${r.role === 'основная' ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground'}`}>
                          {r.role}
                        </span>
                        {!r.available && <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-500">нет в каталоге</span>}
                        {r.deprecated && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600">устаревает</span>}
                      </div>
                      {r.note && <div className="text-[11px] text-muted-foreground mt-0.5">{r.note}</div>}
                      {r.kind === 'chat' && (
                        <div className="text-[11px] text-muted-foreground mt-0.5">
                          1000 токенов: вход {rub(r.price_in_1k)}, выход {rub(r.price_out_1k)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right align-top text-muted-foreground whitespace-nowrap">
                      {r.kind === 'chat' ? '—' : rub(r.base_price)}
                    </td>
                    <td className="px-3 py-2 text-right align-top font-semibold whitespace-nowrap">
                      {r.approx ? '≈ ' : ''}{rub(r.my_price)}
                      {r.discount ? <div className="text-[10px] font-normal text-emerald-600">−{r.discount}%</div> : null}
                    </td>
                    <td className="px-3 py-2 text-right align-top whitespace-nowrap">{r.energy} ⚡</td>
                    <td className={`px-3 py-2 text-right align-top font-semibold whitespace-nowrap ${marginClass(r.margin)}`}>
                      {r.margin == null ? '—' : rub(r.margin)}
                    </td>
                  </tr>
                )),
              )}
              {!data && !error && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Загружаем цены…</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Если в инструменте есть этап поиска (gpt-4o), его стоимость добавляется к стиранию или ретуши, так что реально остаётся меньше, чем в столбце «Остаётся».
        </p>
      </div>

      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h4 className="font-semibold flex items-center gap-2 mr-auto">
            <Icon name="List" size={16} className="text-primary" />
            Все цены GPTunneL на сегодня
          </h4>
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск модели…" className="h-8 w-48" />
          <Button size="sm" variant={onlyUsed ? 'default' : 'outline'} onClick={() => setOnlyUsed((v) => !v)} className="h-8">
            Только используемые
          </Button>
        </div>
        <div className="overflow-auto rounded-xl border max-h-[480px]">
          <table className="w-full text-sm">
            <thead className="bg-muted/80 backdrop-blur text-xs text-muted-foreground sticky top-0">
              <tr>
                <th className="text-left font-medium px-3 py-2">Модель</th>
                <th className="text-left font-medium px-3 py-2">Тип</th>
                <th className="text-left font-medium px-3 py-2">Вариант</th>
                <th className="text-right font-medium px-3 py-2">Прайс</th>
                <th className="text-right font-medium px-3 py-2">Скидка</th>
                <th className="text-right font-medium px-3 py-2">Ваша цена</th>
              </tr>
            </thead>
            <tbody>
              {catalog.map((r, i) => (
                <tr key={`${r.model}-${r.variant}-${i}`} className={`border-t ${r.used ? 'bg-primary/5' : ''}`}>
                  <td className="px-3 py-1.5">
                    <span className="font-mono text-xs">{r.model}</span>
                    {r.used && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-primary/15 text-primary">в проекте</span>}
                    {r.deprecated && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600">устаревает</span>}
                  </td>
                  <td className="px-3 py-1.5 text-xs text-muted-foreground">{r.type}</td>
                  <td className="px-3 py-1.5 text-xs">{r.variant || '—'}</td>
                  <td className="px-3 py-1.5 text-right text-muted-foreground whitespace-nowrap">{rub(r.base_price)}</td>
                  <td className="px-3 py-1.5 text-right text-xs text-emerald-600 whitespace-nowrap">{r.discount ? `−${r.discount}%` : ''}</td>
                  <td className="px-3 py-1.5 text-right font-semibold whitespace-nowrap">{rub(r.my_price)}</td>
                </tr>
              ))}
              {data && catalog.length === 0 && (
                <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">Ничего не найдено</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const AdminAiServices = () => (
  <Accordion type="single" collapsible defaultValue="gptunnel" className="space-y-3">
    <AccordionItem value="gptunnel" className="rounded-xl border">
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
            <Icon name="Bot" size={16} className="text-white" />
          </div>
          <div className="text-left">
            <div className="font-semibold">GPTunneL.ru</div>
            <div className="text-xs text-muted-foreground font-normal">Генерация и редактирование фото, распознавание</div>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        <GptunnelPanel />
      </AccordionContent>
    </AccordionItem>
  </Accordion>
);

export default AdminAiServices;
