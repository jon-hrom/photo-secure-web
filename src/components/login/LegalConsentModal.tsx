import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { fetchLegalList, acceptDocs, LegalDocMeta } from '@/lib/legalApi';

interface LegalConsentModalProps {
  open: boolean;
  userId: string;
  onAccepted: () => void;
  onCancel: () => void;
}

const LegalConsentModal = ({ open, userId, onAccepted, onCancel }: LegalConsentModalProps) => {
  const [docs, setDocs] = useState<LegalDocMeta[]>([]);
  const [accepted, setAccepted] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetchLegalList().then((list) => {
      setDocs(list);
      const initial: Record<string, boolean> = {};
      list.forEach((d) => { initial[d.slug] = false; });
      setAccepted(initial);
      setLoading(false);
    });
  }, [open]);

  const allAccepted = docs.length > 0 && docs.every((d) => accepted[d.slug]);

  const handleAccept = async () => {
    setSaving(true);
    const slugs = docs.map((d) => d.slug);
    await acceptDocs(userId, slugs);
    setSaving(false);
    onAccepted();
  };

  const slugToUrl: Record<string, string> = {
    'offer': '/offer',
    'privacy-policy': '/privacy-policy',
    'personal-data': '/personal-data',
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Согласие с документами</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Загрузка документов...</div>
        ) : (
          <ScrollArea className="max-h-64 pr-2">
            <div className="space-y-3 py-2">
              {docs.map((doc) => (
                <div key={doc.slug} className="flex items-start gap-3">
                  <Checkbox
                    id={`consent-${doc.slug}`}
                    checked={accepted[doc.slug] ?? false}
                    onCheckedChange={(v) => setAccepted((prev) => ({ ...prev, [doc.slug]: !!v }))}
                    className="mt-0.5"
                  />
                  <label htmlFor={`consent-${doc.slug}`} className="text-sm text-muted-foreground leading-relaxed cursor-pointer">
                    Я принимаю{' '}
                    <a
                      href={slugToUrl[doc.slug] || `/legal/${doc.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-medium"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {doc.title}
                    </a>
                  </label>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        <DialogFooter className="gap-2 mt-2">
          <Button variant="outline" onClick={onCancel} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={handleAccept} disabled={!allAccepted || saving || loading}>
            {saving ? 'Сохранение...' : 'Подтвердить и войти'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default LegalConsentModal;
