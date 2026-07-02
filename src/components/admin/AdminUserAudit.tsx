import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import AuditActivityCalendar from './AuditActivityCalendar';
import AuditDayDialog, { DayEvent } from './AuditDayDialog';

const AUDIT_API = 'https://functions.poehali.dev/2016162f-bf9b-41e9-a0eb-e2e4c8249795';
const PWD_KEY = 'audit_panel_pwd';

interface UserRow {
  id: number;
  display: string;
  email: string | null;
  phone: string | null;
  role: string;
  created_at: string | null;
  last_login: string | null;
}

interface LegalConsent {
  slug: string;
  title: string | null;
  version: number;
  accepted_at: string;
  ip_address: string | null;
}

interface RecurringConsent {
  plan_id: number;
  plan_name: string | null;
  amount_rub: number;
  duration_months: number;
  consent_text: string;
  ip_address: string | null;
  offer_version: string | null;
  created_at: string;
}

interface AuditData {
  user: Record<string, unknown>;
  legal_consents: LegalConsent[];
  recurring_consents: RecurringConsent[];
}

const fmt = (v?: string | null) => {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return v;
  }
};

const AdminUserAudit = () => {
  const adminId = localStorage.getItem('userId') || '';

  // --- Пароль-гейт ---
  const [unlocked, setUnlocked] = useState(false);
  const [pwdInput, setPwdInput] = useState('');
  const [checkingPwd, setCheckingPwd] = useState(false);

  const password = () => sessionStorage.getItem(PWD_KEY) || '';

  const verifyPassword = async (pwd: string) => {
    setCheckingPwd(true);
    try {
      const res = await fetch(AUDIT_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': adminId },
        body: JSON.stringify({ action: 'audit_verify', password: pwd }),
      });
      const data = await res.json();
      if (data.ok) {
        sessionStorage.setItem(PWD_KEY, pwd);
        setUnlocked(true);
        setPwdInput('');
      } else {
        toast.error('Неверный пароль');
      }
    } catch {
      toast.error('Ошибка сети');
    }
    setCheckingPwd(false);
  };

  useEffect(() => {
    const saved = password();
    if (saved) verifyPassword(saved);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Пользователи ---
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [audit, setAudit] = useState<AuditData | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  // --- Календарь / день ---
  const [days, setDays] = useState<Record<string, number>>({});
  const [totalEvents, setTotalEvents] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [dayEvents, setDayEvents] = useState<DayEvent[]>([]);
  const [loadingDay, setLoadingDay] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const authHeaders = () => ({
    'X-User-Id': adminId,
    'X-Audit-Password': password(),
  });

  const loadUsers = async (q: string) => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`${AUDIT_API}?action=users&q=${encodeURIComponent(q)}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      toast.error('Не удалось загрузить пользователей');
    }
    setLoadingUsers(false);
  };

  useEffect(() => {
    if (unlocked) loadUsers('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unlocked]);

  const openUser = async (u: UserRow) => {
    setSelected(u);
    setAudit(null);
    setDays({});
    setTotalEvents(0);
    setLoadingAudit(true);
    try {
      const [aRes, dRes] = await Promise.all([
        fetch(`${AUDIT_API}?action=user_audit&target_id=${u.id}`, { headers: authHeaders() }),
        fetch(`${AUDIT_API}?action=audit_days&target_id=${u.id}`, { headers: authHeaders() }),
      ]);
      const aData = await aRes.json();
      const dData = await dRes.json();
      if (aRes.ok) setAudit(aData);
      else toast.error(aData.error || 'Не удалось загрузить историю');
      if (dRes.ok) {
        setDays(dData.days || {});
        setTotalEvents(dData.total || 0);
      }
    } catch {
      toast.error('Ошибка сети');
    }
    setLoadingAudit(false);
  };

  const openDay = async (day: string) => {
    if (!selected) return;
    setSelectedDay(day);
    setDayEvents([]);
    setLoadingDay(true);
    try {
      const res = await fetch(
        `${AUDIT_API}?action=audit_day&target_id=${selected.id}&day=${day}`,
        { headers: authHeaders() },
      );
      const data = await res.json();
      if (res.ok) setDayEvents(data.events || []);
      else toast.error(data.error || 'Не удалось загрузить день');
    } catch {
      toast.error('Ошибка сети');
    }
    setLoadingDay(false);
  };

  const downloadXlsx = async () => {
    if (!selected) return;
    setDownloading(true);
    try {
      const res = await fetch(`${AUDIT_API}?action=audit_xlsx&target_id=${selected.id}`, {
        headers: authHeaders(),
      });
      const data = await res.json();
      if (!res.ok || !data.xlsx_base64) {
        toast.error(data.error || 'Не удалось сформировать файл');
      } else {
        const bin = atob(data.xlsx_base64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        const blob = new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = data.filename || `samopisec_${selected.id}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }
    } catch {
      toast.error('Ошибка сети');
    }
    setDownloading(false);
  };

  // --- Экран ввода пароля ---
  if (!unlocked) {
    return (
      <div className="max-w-sm mx-auto py-10 text-center space-y-4">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
          <Icon name="Lock" size={26} className="text-primary" />
        </div>
        <div>
          <h3 className="font-semibold text-lg">Панель самописцев</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Введите пароль доступа к аудит-логам клиентов.
          </p>
        </div>
        <div className="flex gap-2">
          <Input
            type="password"
            value={pwdInput}
            onChange={(e) => setPwdInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && pwdInput && verifyPassword(pwdInput)}
            placeholder="Пароль панели"
            autoFocus
          />
          <Button onClick={() => verifyPassword(pwdInput)} disabled={checkingPwd || !pwdInput} className="gap-2">
            <Icon name={checkingPwd ? 'Loader2' : 'LogIn'} size={16} className={checkingPwd ? 'animate-spin' : ''} />
            Войти
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Поиск по ID, email, телефону или имени. Выберите пользователя — увидите его согласия и
        календарь действий на сайте. Время — UTC+4. Данные хранятся в защищённом хранилище клиента.
      </p>

      <div className="flex gap-2">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadUsers(query)}
          placeholder="ID, email, телефон или имя…"
          className="max-w-sm"
        />
        <Button onClick={() => loadUsers(query)} disabled={loadingUsers} className="gap-2">
          <Icon name={loadingUsers ? 'Loader2' : 'Search'} size={16} className={loadingUsers ? 'animate-spin' : ''} />
          Найти
        </Button>
      </div>

      {!selected && (
        <div className="border rounded-xl overflow-hidden">
          {users.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">Никого не найдено</div>
          ) : (
            <div className="divide-y">
              {users.map((u) => (
                <button
                  key={u.id}
                  onClick={() => openUser(u)}
                  className="w-full text-left px-4 py-3 hover:bg-muted transition-colors flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{u.display || `Пользователь #${u.id}`}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      ID {u.id} · {u.email || 'без email'} · {u.phone || 'без телефона'}
                    </div>
                  </div>
                  <Icon name="ChevronRight" size={18} className="text-muted-foreground shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {selected && (
        <div className="space-y-4">
          <button
            onClick={() => { setSelected(null); setAudit(null); setDays({}); }}
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            <Icon name="ArrowLeft" size={14} /> К списку пользователей
          </button>

          <div className="rounded-xl border p-4 bg-muted/40 flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-lg font-semibold">{selected.display || `Пользователь #${selected.id}`}</div>
              <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                <div>ID: {selected.id} · Роль: {selected.role}</div>
                <div>Email: {selected.email || '—'} · Телефон: {selected.phone || '—'}</div>
                <div>Регистрация: {fmt(selected.created_at)} · Последний вход: {fmt(selected.last_login)}</div>
              </div>
            </div>
            <Button onClick={downloadXlsx} disabled={downloading} variant="secondary" className="gap-2">
              <Icon name={downloading ? 'Loader2' : 'Download'} size={16} className={downloading ? 'animate-spin' : ''} />
              Скачать .xlsx
            </Button>
          </div>

          {loadingAudit ? (
            <div className="flex justify-center py-10">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          ) : audit ? (
            <>
              {/* Согласия на автосписания */}
              <section className="rounded-xl border overflow-hidden">
                <div className="px-4 py-3 bg-primary/5 font-semibold text-sm flex items-center gap-2">
                  <Icon name="CreditCard" size={16} className="text-primary" />
                  Согласия на автосписания (рекуррентные платежи)
                  <span className="ml-auto text-xs text-muted-foreground">{audit.recurring_consents.length}</span>
                </div>
                {audit.recurring_consents.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-muted-foreground">Записей нет</div>
                ) : (
                  <div className="divide-y">
                    {audit.recurring_consents.map((c, i) => (
                      <div key={i} className="px-4 py-3 text-sm">
                        <div className="font-medium">
                          {c.plan_name || `Тариф #${c.plan_id}`} · {Math.floor(c.amount_rub)} ₽ / {c.duration_months} мес.
                        </div>
                        <div className="text-muted-foreground text-xs mt-1">{c.consent_text}</div>
                        <div className="text-muted-foreground text-xs mt-1">
                          {fmt(c.created_at)} · IP: {c.ip_address || '—'} · оферта в. {c.offer_version || '—'}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Согласия с юридическими документами */}
              <section className="rounded-xl border overflow-hidden">
                <div className="px-4 py-3 bg-primary/5 font-semibold text-sm flex items-center gap-2">
                  <Icon name="ShieldCheck" size={16} className="text-primary" />
                  Согласия с документами
                  <span className="ml-auto text-xs text-muted-foreground">{audit.legal_consents.length}</span>
                </div>
                {audit.legal_consents.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-muted-foreground">Записей нет</div>
                ) : (
                  <div className="divide-y">
                    {audit.legal_consents.map((c, i) => (
                      <div key={i} className="px-4 py-3 text-sm flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{c.title || c.slug} <span className="text-xs text-muted-foreground">ред. {c.version}</span></div>
                          <div className="text-muted-foreground text-xs">IP: {c.ip_address || '—'}</div>
                        </div>
                        <div className="text-muted-foreground text-xs whitespace-nowrap">{fmt(c.accepted_at)}</div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Календарь действий */}
              <section className="rounded-xl border overflow-hidden">
                <div className="px-4 py-3 bg-primary/5 font-semibold text-sm flex items-center gap-2">
                  <Icon name="CalendarDays" size={16} className="text-primary" />
                  Календарь действий
                  <span className="ml-auto text-xs text-muted-foreground">{totalEvents} событий</span>
                </div>
                {totalEvents === 0 ? (
                  <div className="px-4 py-4 text-sm text-muted-foreground">Пока нет записей активности</div>
                ) : (
                  <>
                    <AuditActivityCalendar days={days} onSelectDay={openDay} />
                    <div className="px-4 pb-3 text-xs text-muted-foreground">
                      Нажмите на день с активностью, чтобы увидеть все действия за этот день.
                    </div>
                  </>
                )}
              </section>
            </>
          ) : null}
        </div>
      )}

      <AuditDayDialog
        day={selectedDay}
        events={dayEvents}
        loading={loadingDay}
        onClose={() => setSelectedDay(null)}
      />
    </div>
  );
};

export default AdminUserAudit;
