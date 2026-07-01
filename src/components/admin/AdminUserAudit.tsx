import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

const AUDIT_API = 'https://functions.poehali.dev/2016162f-bf9b-41e9-a0eb-e2e4c8249795';

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

interface ActivityRow {
  event_type: string;
  action: string;
  page_path: string | null;
  details: string | null;
  ip_address: string | null;
  created_at: string;
}

interface AuditData {
  user: Record<string, unknown>;
  legal_consents: LegalConsent[];
  recurring_consents: RecurringConsent[];
  activity: ActivityRow[];
}

const fmt = (v?: string | null) => {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' });
  } catch {
    return v;
  }
};

const eventIcon = (type: string): string => {
  if (type === 'page_view') return 'Eye';
  if (type === 'click') return 'MousePointerClick';
  return 'Activity';
};

const AdminUserAudit = () => {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selected, setSelected] = useState<UserRow | null>(null);
  const [audit, setAudit] = useState<AuditData | null>(null);
  const [loadingAudit, setLoadingAudit] = useState(false);

  const adminId = localStorage.getItem('userId') || '';

  const loadUsers = async (q: string) => {
    setLoadingUsers(true);
    try {
      const res = await fetch(`${AUDIT_API}?action=users&q=${encodeURIComponent(q)}`, {
        headers: { 'X-User-Id': adminId },
      });
      const data = await res.json();
      setUsers(data.users || []);
    } catch {
      toast.error('Не удалось загрузить пользователей');
    }
    setLoadingUsers(false);
  };

  useEffect(() => {
    loadUsers('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openUser = async (u: UserRow) => {
    setSelected(u);
    setAudit(null);
    setLoadingAudit(true);
    try {
      const res = await fetch(`${AUDIT_API}?action=user_audit&target_id=${u.id}`, {
        headers: { 'X-User-Id': adminId },
      });
      const data = await res.json();
      if (res.ok) {
        setAudit(data);
      } else {
        toast.error(data.error || 'Не удалось загрузить историю');
      }
    } catch {
      toast.error('Ошибка сети');
    }
    setLoadingAudit(false);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Поиск по ID, email, телефону или имени. Выберите пользователя — увидите все его согласия
        (юридические документы и автосписания) и журнал действий на сайте.
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
            onClick={() => { setSelected(null); setAudit(null); }}
            className="text-sm text-primary hover:underline inline-flex items-center gap-1"
          >
            <Icon name="ArrowLeft" size={14} /> К списку пользователей
          </button>

          <div className="rounded-xl border p-4 bg-muted/40">
            <div className="text-lg font-semibold">{selected.display || `Пользователь #${selected.id}`}</div>
            <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
              <div>ID: {selected.id} · Роль: {selected.role}</div>
              <div>Email: {selected.email || '—'} · Телефон: {selected.phone || '—'}</div>
              <div>Регистрация: {fmt(selected.created_at)} · Последний вход: {fmt(selected.last_login)}</div>
            </div>
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

              {/* Журнал действий */}
              <section className="rounded-xl border overflow-hidden">
                <div className="px-4 py-3 bg-primary/5 font-semibold text-sm flex items-center gap-2">
                  <Icon name="ScrollText" size={16} className="text-primary" />
                  Журнал действий
                  <span className="ml-auto text-xs text-muted-foreground">{audit.activity.length}</span>
                </div>
                {audit.activity.length === 0 ? (
                  <div className="px-4 py-4 text-sm text-muted-foreground">Пока нет записей активности</div>
                ) : (
                  <div className="divide-y max-h-[420px] overflow-y-auto">
                    {audit.activity.map((a, i) => (
                      <div key={i} className="px-4 py-2.5 text-sm flex items-start gap-3">
                        <Icon name={eventIcon(a.event_type)} size={15} className="text-muted-foreground mt-0.5 shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate">{a.action || a.event_type}</div>
                          <div className="text-muted-foreground text-xs truncate">
                            {a.page_path ? `${a.page_path} · ` : ''}{fmt(a.created_at)}{a.ip_address ? ` · IP: ${a.ip_address}` : ''}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </>
          ) : null}
        </div>
      )}
    </div>
  );
};

export default AdminUserAudit;
