import { useState, useEffect } from 'react';
import Icon from '@/components/ui/icon';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import ChatModal from '@/components/gallery/ChatModal';

interface BlockedContactButtonProps {
  code: string;
  photographerId: number;
}

interface SavedClient {
  client_id: number;
  full_name?: string;
  phone?: string;
  email?: string;
}

export default function BlockedContactButton({ code, photographerId }: BlockedContactButtonProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [savedClient, setSavedClient] = useState<SavedClient | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(`client_${photographerId}_${code}`);
      if (raw) {
        const parsed = JSON.parse(raw) as SavedClient;
        if (parsed?.client_id) {
          setSavedClient(parsed);
          setFullName(parsed.full_name || '');
          setPhone(parsed.phone || '');
          setEmail(parsed.email || '');
        }
      }
    } catch {
      // ignore
    }
  }, [photographerId, code]);

  const handleClick = () => {
    if (savedClient?.client_id) {
      setIsChatOpen(true);
    } else {
      setIsFormOpen(true);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!fullName.trim()) {
      setFormError('Укажите ваше имя');
      return;
    }
    if (!phone.trim() && !email.trim()) {
      setFormError('Укажите телефон или email');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'register_client',
          gallery_code: code,
          full_name: fullName.trim(),
          phone: phone.trim(),
          email: email.trim() || null,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.client_id) {
        setFormError(result.error || 'Не удалось связаться с фотографом');
        setSubmitting(false);
        return;
      }

      const clientData: SavedClient = {
        client_id: result.client_id,
        full_name: fullName.trim(),
        phone: phone.trim(),
        email: email.trim(),
      };
      try {
        localStorage.setItem(`client_${photographerId}_${code}`, JSON.stringify(clientData));
      } catch {
        // ignore quota
      }
      setSavedClient(clientData);
      setIsFormOpen(false);
      setIsChatOpen(true);
    } catch (err) {
      setFormError('Ошибка сети. Попробуйте ещё раз');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="group relative mt-2 w-full overflow-hidden rounded-xl bg-gradient-to-r from-violet-600 via-purple-600 to-fuchsia-600 px-6 py-4 font-semibold text-white shadow-lg transition-all hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2"
      >
        <span className="absolute inset-0 bg-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
        <span className="relative flex items-center justify-center gap-2">
          <Icon name="MessageCircle" size={20} />
          Написать фотографу
        </span>
      </button>

      <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Написать фотографу</DialogTitle>
            <DialogDescription>
              Оставьте контакты, чтобы фотограф увидел ваше сообщение и ответил.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="bcb-name">Ваше имя *</Label>
              <Input
                id="bcb-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Например, Елена"
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bcb-phone">Телефон</Label>
              <Input
                id="bcb-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+7 999 123-45-67"
                inputMode="tel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bcb-email">Email</Label>
              <Input
                id="bcb-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
            </div>
            <p className="text-xs text-gray-500">Укажите телефон или email — как вам удобнее.</p>
            {formError && (
              <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">{formError}</div>
            )}
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setIsFormOpen(false)} disabled={submitting}>
                Отмена
              </Button>
              <Button type="submit" className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 text-white hover:from-violet-700 hover:to-fuchsia-700" disabled={submitting}>
                {submitting ? 'Открываем чат…' : 'Перейти в чат'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {isChatOpen && savedClient?.client_id && (
        <ChatModal
          isOpen={isChatOpen}
          onClose={() => setIsChatOpen(false)}
          photographerId={photographerId}
          clientId={savedClient.client_id}
          clientName={savedClient.full_name || savedClient.phone || 'Клиент'}
          photographerName="Фотограф"
          senderType="client"
        />
      )}
    </>
  );
}
