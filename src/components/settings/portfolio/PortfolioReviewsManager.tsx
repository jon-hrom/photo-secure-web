import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { Portfolio, PortfolioReview, portfolioAction } from '@/lib/portfolioApi';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface Props {
  userId: string;
  portfolio: Portfolio;
  onChange: (p: Portfolio) => void;
}

type Confirm =
  | { kind: 'publish'; id: number; name: string }
  | { kind: 'unpublish'; id: number; name: string }
  | { kind: 'delete'; id: number; name: string }
  | null;

const Stars = ({ value, onChange }: { value: number; onChange?: (n: number) => void }) => (
  <div className="flex items-center gap-0.5">
    {[1, 2, 3, 4, 5].map((n) => (
      <button key={n} type="button" onClick={() => onChange?.(n)} disabled={!onChange} className="text-lg leading-none">
        <span className={n <= value ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600'}>★</span>
      </button>
    ))}
  </div>
);

const PortfolioReviewsManager = ({ userId, portfolio, onChange }: Props) => {
  const [author, setAuthor] = useState('');
  const [text, setText] = useState('');
  const [rating, setRating] = useState(5);
  const [saving, setSaving] = useState(false);

  const [editing, setEditing] = useState<PortfolioReview | null>(null);
  const [eAuthor, setEAuthor] = useState('');
  const [eText, setEText] = useState('');
  const [eRating, setERating] = useState(5);

  const [confirm, setConfirm] = useState<Confirm>(null);
  const [zoom, setZoom] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const reviews = portfolio.reviews || [];

  const add = async () => {
    if (!author.trim() || !text.trim()) return;
    setSaving(true);
    const p = await portfolioAction(userId, 'add_review', { author_name: author.trim(), text: text.trim(), rating });
    setSaving(false);
    setAuthor(''); setText(''); setRating(5);
    onChange(p);
  };

  const openEdit = (r: PortfolioReview) => {
    setEditing(r); setEAuthor(r.author_name); setEText(r.text); setERating(r.rating);
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusy(true);
    const p = await portfolioAction(userId, 'update_review', {
      id: editing.id, author_name: eAuthor.trim(), text: eText.trim(), rating: eRating,
    });
    setBusy(false);
    setEditing(null);
    onChange(p);
  };

  const runConfirm = async () => {
    if (!confirm) return;
    setBusy(true);
    const action = confirm.kind === 'publish' ? 'approve_review' : confirm.kind === 'unpublish' ? 'unpublish_review' : 'delete_review';
    const p = await portfolioAction(userId, action, { id: confirm.id });
    setBusy(false);
    setConfirm(null);
    onChange(p);
  };

  const pending = reviews.filter((r) => r.is_approved === false);
  const published = reviews.filter((r) => r.is_approved !== false);

  const renderReviewRow = (r: PortfolioReview, isPending: boolean) => (
    <div key={r.id} className={`rounded-lg border p-3 ${isPending ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{r.author_name}</span>
            <span className="text-xs text-amber-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
            {r.shooting_style && <span className="text-xs text-muted-foreground">· {r.shooting_style}</span>}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-line">{r.text}</p>
          {r.photos && r.photos.length > 0 && (
            <div className="mt-2">
              <p className="text-[11px] text-muted-foreground mb-1">Фото от клиента ({r.photos.length}):</p>
              <div className="flex gap-1.5 flex-wrap">
                {r.photos.map((u, i) => (
                  <button key={i} onClick={() => setZoom(u)} className="relative group">
                    <img src={u} alt="" className="w-14 h-14 object-cover rounded-md border border-gray-200 dark:border-gray-700" loading="lazy" />
                    <span className="absolute inset-0 rounded-md bg-black/0 group-hover:bg-black/30 flex items-center justify-center transition">
                      <Icon name="ZoomIn" size={16} className="text-white opacity-0 group-hover:opacity-100" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={() => openEdit(r)} className="text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded p-1" title="Редактировать">
            <Icon name="Pencil" size={15} />
          </button>
          <button onClick={() => setConfirm({ kind: 'delete', id: r.id, name: r.author_name })} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded p-1" title="Удалить">
            <Icon name="Trash2" size={15} />
          </button>
        </div>
      </div>

      <div className="flex gap-2 mt-2">
        {isPending ? (
          <Button size="sm" onClick={() => setConfirm({ kind: 'publish', id: r.id, name: r.author_name })} className="h-7 text-xs">
            <Icon name="Check" size={13} className="mr-1" /> Опубликовать
          </Button>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setConfirm({ kind: 'unpublish', id: r.id, name: r.author_name })} className="h-7 text-xs">
            <Icon name="EyeOff" size={13} className="mr-1" /> Снять с публикации
          </Button>
        )}
      </div>
    </div>
  );

  const confirmMeta = confirm && {
    publish: {
      title: 'Опубликовать отзыв?',
      desc: `Отзыв от «${confirm.name}» появится на странице отзывов вашего портфолио, его увидят все посетители.`,
      btn: 'Опубликовать',
    },
    unpublish: {
      title: 'Снять отзыв с публикации?',
      desc: `Отзыв от «${confirm.name}» перестанет показываться на портфолио. Вы сможете опубликовать его снова.`,
      btn: 'Снять с публикации',
    },
    delete: {
      title: 'Удалить отзыв?',
      desc: `Отзыв от «${confirm.name}» будет удалён навсегда. Это действие нельзя отменить.`,
      btn: 'Удалить',
    },
  }[confirm.kind];

  return (
    <div className="space-y-3">
      {pending.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
            <Icon name="BellDot" size={16} /> Новые отзывы от клиентов ({pending.length})
          </div>
          {pending.map((r) => renderReviewRow(r, true))}
        </div>
      )}

      {published.length > 0 && (
        <div className="space-y-2">
          {published.map((r) => renderReviewRow(r, false))}
        </div>
      )}

      <div className="rounded-lg border border-dashed border-gray-300 dark:border-gray-700 p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Имя клиента" className="h-8 text-sm flex-1" />
          <Stars value={rating} onChange={setRating} />
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Текст отзыва..."
          rows={2}
          className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm resize-y"
        />
        <Button size="sm" variant="outline" onClick={add} disabled={saving || !author.trim() || !text.trim()}>
          <Icon name="Plus" size={14} className="mr-1" /> Добавить отзыв
        </Button>
      </div>

      {/* Диалог редактирования */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Редактировать отзыв</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Input value={eAuthor} onChange={(e) => setEAuthor(e.target.value)} placeholder="Имя клиента" className="h-9 text-sm flex-1" />
              <Stars value={eRating} onChange={setERating} />
            </div>
            <textarea
              value={eText}
              onChange={(e) => setEText(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm resize-y"
            />
            {editing?.photos && editing.photos.length > 0 && (
              <div className="flex gap-1.5 flex-wrap">
                {editing.photos.map((u, i) => (
                  <img key={i} src={u} alt="" className="w-12 h-12 object-cover rounded border border-gray-200 dark:border-gray-700" />
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Отмена</Button>
            <Button onClick={saveEdit} disabled={busy || !eAuthor.trim() || !eText.trim()}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Подтверждение публикации / снятия / удаления */}
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirmMeta?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirmMeta?.desc}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); runConfirm(); }}
              disabled={busy}
              className={confirm?.kind === 'delete' ? 'bg-red-600 hover:bg-red-700' : ''}
            >
              {confirmMeta?.btn}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Просмотр фото */}
      {zoom && (
        <div className="fixed inset-0 z-[70] bg-black/90 flex items-center justify-center p-4" onClick={() => setZoom(null)}>
          <button className="absolute top-5 right-5 text-white/80 hover:text-white"><Icon name="X" size={28} /></button>
          <img src={zoom} alt="" className="max-w-full max-h-full object-contain rounded-lg" />
        </div>
      )}
    </div>
  );
};

export default PortfolioReviewsManager;
