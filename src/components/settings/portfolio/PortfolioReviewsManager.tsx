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

  return (
    <div className="space-y-3">
      {reviews.length > 0 && (
        <div className="space-y-2">
          {reviews.map((r) => (
            <div key={r.id} className="flex items-start gap-3 rounded-lg border border-gray-200 dark:border-gray-700 p-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{r.author_name}</span>
                  <span className="text-xs text-amber-500">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{r.text}</p>
              </div>
              <button onClick={() => remove(r.id)} className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded p-1">
                <Icon name="Trash2" size={15} />
              </button>
            </div>
          ))}
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
