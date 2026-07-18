import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import Icon from '@/components/ui/icon';
import { Portfolio, portfolioAction } from '@/lib/portfolioApi';

interface Props {
  userId: string;
  portfolio: Portfolio;
  onChange: (p: Portfolio) => void;
}

const PortfolioReviewsManager = ({ userId, portfolio, onChange }: Props) => {
  const [author, setAuthor] = useState('');
  const [text, setText] = useState('');
  const [rating, setRating] = useState(5);
  const [saving, setSaving] = useState(false);

  const reviews = portfolio.reviews || [];

  const add = async () => {
    if (!author.trim() || !text.trim()) return;
    setSaving(true);
    const p = await portfolioAction(userId, 'add_review', { author_name: author.trim(), text: text.trim(), rating });
    setSaving(false);
    setAuthor('');
    setText('');
    setRating(5);
    onChange(p);
  };

  const remove = async (id: number) => {
    const p = await portfolioAction(userId, 'delete_review', { id });
    onChange(p);
  };

  const approve = async (id: number) => {
    const p = await portfolioAction(userId, 'approve_review', { id });
    onChange(p);
  };

  const pending = reviews.filter((r) => r.is_approved === false);
  const published = reviews.filter((r) => r.is_approved !== false);

  const renderReviewRow = (r: typeof reviews[number], isPending: boolean) => (
    <div key={r.id} className={`rounded-lg border p-3 ${isPending ? 'border-amber-300 bg-amber-50 dark:bg-amber-900/10' : 'border-gray-200 dark:border-gray-700'}`}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium">{r.author_name}</span>
            <span className="text-xs text-amber-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
            {r.shooting_style && <span className="text-xs text-muted-foreground">· {r.shooting_style}</span>}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-line">{r.text}</p>
          {r.photos && r.photos.length > 0 && (
            <div className="flex gap-1 mt-2 flex-wrap">
              {r.photos.map((u, i) => (
                <img key={i} src={u} alt="" className="w-12 h-12 object-cover rounded" loading="lazy" />
              ))}
            </div>
          )}
        </div>
        <button onClick={() => remove(r.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded p-1 shrink-0">
          <Icon name="Trash2" size={15} />
        </button>
      </div>
      {isPending && (
        <div className="flex gap-2 mt-2">
          <Button size="sm" onClick={() => approve(r.id)} className="h-7 text-xs">
            <Icon name="Check" size={13} className="mr-1" /> Опубликовать
          </Button>
          <Button size="sm" variant="outline" onClick={() => remove(r.id)} className="h-7 text-xs">
            Отклонить
          </Button>
        </div>
      )}
    </div>
  );

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
          <div className="flex items-center gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} className="text-lg leading-none">
                <span className={n <= rating ? 'text-amber-500' : 'text-gray-300 dark:text-gray-600'}>★</span>
              </button>
            ))}
          </div>
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
    </div>
  );
};

export default PortfolioReviewsManager;