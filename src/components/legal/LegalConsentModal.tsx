import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { fetchPendingDocs, acceptDocs, LegalDoc } from '@/lib/legalApi';

interface LegalConsentModalProps {
  userId: string | number | null;
}

const SLUG_PATH: Record<string, string> = {
  'offer': '/offer',
  'privacy-policy': '/privacy-policy',
  'personal-data': '/personal-data',
};

const POLL_INTERVAL = 60000;

const LegalConsentModal = ({ userId }: LegalConsentModalProps) => {
  const [pending, setPending] = useState<LegalDoc[]>([]);
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const skipKey = userId ? `legal_consent_skipped_${userId}` : '';

  const load = useCallback(async () => {
    if (!userId) return;
    const docs = await fetchPendingDocs(String(userId));
    setPending(docs);
    if (docs.length > 0) {
      setOpen(true);
    } else {
      setOpen(false);
      // Подписали всё — сбрасываем флаг пропуска
      if (skipKey) localStorage.removeItem(skipKey);
    }
  }, [userId, skipKey]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [load]);

  if (!open || pending.length === 0) return null;

  const alreadySkipped = skipKey ? localStorage.getItem(skipKey) === '1' : false;
  const canSkip = !alreadySkipped;
  const allChecked = pending.every((d) => checked[d.slug]);

  const toggle = (slug: string) => {
    setChecked((prev) => ({ ...prev, [slug]: !prev[slug] }));
  };

  const handleSkip = () => {
    if (skipKey) localStorage.setItem(skipKey, '1');
    setOpen(false);
  };

  const handleAccept = async () => {
    if (!allChecked || !userId) return;
    setSaving(true);
    const ok = await acceptDocs(String(userId), pending.map((d) => d.slug));
    setSaving(false);
    if (ok) {
      if (skipKey) localStorage.removeItem(skipKey);
      setOpen(false);
      setChecked({});
      load();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-background w-full max-w-lg rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        <div className="p-5 border-b flex items-center gap-3">
          <div className="p-2 rounded-xl bg-primary/10">
            <Icon name="ShieldAlert" size={22} className="text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold">Обновлены документы</h2>
            <p className="text-sm text-muted-foreground">
              Мы обновили правовые документы. Ознакомьтесь и подтвердите согласие.
            </p>
          </div>
        </div>

        <div className="p-5 space-y-3 overflow-y-auto">
          {pending.map((d) => (
            <label
              key={d.slug}
              className="flex items-start gap-3 p-3 rounded-xl border border-input hover:bg-muted/40 cursor-pointer transition-colors"
            >
              <input
                type="checkbox"
                checked={!!checked[d.slug]}
                onChange={() => toggle(d.slug)}
                className="mt-1 h-4 w-4 accent-primary cursor-pointer"
              />
              <span className="text-sm">
                Я ознакомился и согласен с{' '}
                <a
                  href={SLUG_PATH[d.slug] || `/legal/${d.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline font-medium"
                  onClick={(e) => e.stopPropagation()}
                >
                  «{d.title}»
                </a>{' '}
                <span className="text-muted-foreground">(ред. {d.version})</span>
              </span>
            </label>
          ))}
        </div>

        <div className="p-5 border-t flex items-center justify-between gap-3">
          {canSkip ? (
            <Button variant="ghost" onClick={handleSkip} className="text-muted-foreground">
              Пропустить
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              Чтобы продолжить работу, необходимо согласие
            </span>
          )}
          <Button onClick={handleAccept} disabled={!allChecked || saving} className="gap-2">
            <Icon name={saving ? 'Loader2' : 'Check'} size={16} className={saving ? 'animate-spin' : ''} />
            Согласиться
          </Button>
        </div>
      </div>
    </div>
  );
};

export default LegalConsentModal;