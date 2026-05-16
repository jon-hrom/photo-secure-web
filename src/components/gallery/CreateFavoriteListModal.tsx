import { useEffect, useState } from 'react';
import Icon from '@/components/ui/icon';

interface CreateFavoriteListModalProps {
  isOpen: boolean;
  onClose: () => void;
  shortCode: string;
  clientId: number;
  isDarkTheme?: boolean;
  onCreated: (list: { id: number; name: string; note: string | null; photo_count: number; created_at: string | null }) => void;
}

const FAVORITES_URL = 'https://functions.poehali.dev/0ba5ca79-a9a1-4c3f-94b6-c11a71538723';

export default function CreateFavoriteListModal({
  isOpen,
  onClose,
  shortCode,
  clientId,
  isDarkTheme,
  onCreated,
}: CreateFavoriteListModalProps) {
  const [name, setName] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setName('');
      setNote('');
      setError(null);
      setSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Введите название списка');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(FAVORITES_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_list',
          gallery_code: shortCode,
          client_id: clientId,
          name: name.trim(),
          note: note.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Не удалось создать список');
        setSubmitting(false);
        return;
      }
      onCreated(data.list);
      onClose();
    } catch (err) {
      setError('Ошибка сети');
      setSubmitting(false);
    }
  };

  const bgPanel = isDarkTheme ? '#1f1f3a' : '#ffffff';
  const text = isDarkTheme ? '#ffffff' : '#111827';
  const border = isDarkTheme ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
  const inputBg = isDarkTheme ? 'rgba(255,255,255,0.06)' : '#f9fafb';

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.55)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl shadow-2xl"
        style={{ background: bgPanel, color: text, border: `1px solid ${border}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: `1px solid ${border}` }}>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Icon name="Star" size={18} className="text-yellow-500" />
            Новый список избранного
          </h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-black/10 dark:hover:bg-white/10">
            <Icon name="X" size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5 opacity-80">Название списка <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Например: На печать в фотокнигу"
              maxLength={255}
              autoFocus
              className="w-full px-3 py-2.5 rounded-lg outline-none text-sm"
              style={{ background: inputBg, color: text, border: `1px solid ${border}` }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5 opacity-80">Комментарий для фотографа</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Дополнительная информация — пожелания, формат печати, размер и т.п."
              rows={4}
              className="w-full px-3 py-2.5 rounded-lg outline-none text-sm resize-none"
              style={{ background: inputBg, color: text, border: `1px solid ${border}` }}
            />
          </div>
          {error && (
            <div className="text-xs text-red-500 bg-red-500/10 rounded-lg px-3 py-2">{error}</div>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium"
              style={{ background: isDarkTheme ? 'rgba(255,255,255,0.08)' : '#f3f4f6', color: text }}
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2.5 rounded-lg text-sm font-medium bg-purple-500 text-white active:bg-purple-700 disabled:opacity-50"
            >
              {submitting ? 'Создание...' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
