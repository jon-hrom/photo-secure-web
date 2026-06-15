import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';
import { adminListDocs, adminPublishDoc, LegalDoc } from '@/lib/legalApi';
import RichTextEditor from '@/components/admin/RichTextEditor';

const AdminPersonalData = () => {
  const [docs, setDocs] = useState<LegalDoc[]>([]);
  const [activeSlug, setActiveSlug] = useState<string>('');
  const [draft, setDraft] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const userId = localStorage.getItem('userId') || '';

  const load = async () => {
    setLoading(true);
    const list = await adminListDocs(userId);
    setDocs(list);
    if (list.length) {
      const first = activeSlug || list[0].slug;
      setActiveSlug(first);
      const cur = list.find((d) => d.slug === first) || list[0];
      setDraft(cur.content);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectDoc = (slug: string) => {
    setActiveSlug(slug);
    const cur = docs.find((d) => d.slug === slug);
    setDraft(cur?.content || '');
  };

  const activeDoc = docs.find((d) => d.slug === activeSlug);
  const isDirty = activeDoc ? draft !== activeDoc.content : false;

  const handleApply = async () => {
    if (!activeDoc) return;
    setSaving(true);
    const res = await adminPublishDoc(userId, activeDoc.slug, activeDoc.title, draft);
    setSaving(false);
    if (res.success) {
      if (res.changed) {
        toast.success(`Опубликовано. Новая редакция № ${res.version}. Фотографам покажем согласие.`);
      } else {
        toast.success('Сохранено (текст не изменился).');
      }
      await load();
    } else {
      toast.error(res.error || 'Не удалось опубликовать');
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Выберите документ, отредактируйте текст (можно вставить из Word) и нажмите «Применить».
        После публикации изменённой версии все фотографы увидят окно с просьбой согласиться.
      </p>

      <div className="flex flex-wrap gap-2">
        {docs.map((d) => (
          <button
            key={d.slug}
            onClick={() => selectDoc(d.slug)}
            className={`px-3 h-9 rounded-lg text-sm font-medium transition-colors border ${
              activeSlug === d.slug
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-muted border-input'
            }`}
          >
            {d.title}
            <span className="ml-2 text-xs opacity-70">ред. {d.version}</span>
          </button>
        ))}
      </div>

      {activeDoc && (
        <div className="space-y-3">
          <RichTextEditor value={draft} onChange={setDraft} />

          <div className="flex items-center justify-between gap-3 pt-2">
            <a
              href={`/legal/${activeDoc.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-primary hover:underline inline-flex items-center gap-1"
            >
              <Icon name="ExternalLink" size={14} />
              Посмотреть на сайте
            </a>
            <Button onClick={handleApply} disabled={saving || !isDirty} className="gap-2">
              <Icon name={saving ? 'Loader2' : 'Check'} size={16} className={saving ? 'animate-spin' : ''} />
              Применить
            </Button>
          </div>
          {!isDirty && (
            <p className="text-xs text-muted-foreground text-right">Нет изменений для публикации</p>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminPersonalData;