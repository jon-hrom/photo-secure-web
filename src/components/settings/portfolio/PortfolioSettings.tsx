import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import {
  Portfolio,
  getMyPortfolio,
  savePortfolio,
  portfolioAction,
  checkSlug,
} from '@/lib/portfolioApi';
import { slugify, suggestSlugs } from '@/utils/slugify';

import PortfolioPhotosManager from './PortfolioPhotosManager';
import PortfolioReviewsManager from './PortfolioReviewsManager';

const PUBLIC_BASE = typeof window !== 'undefined' ? window.location.origin : '';

interface Props {
  userId: string;
}

const PortfolioSettings = ({ userId }: Props) => {
  const { toast } = useToast();
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'ok' | 'taken'>('idle');
  const [about, setAbout] = useState('');
  const [phone, setPhone] = useState('');
  const [instagram, setInstagram] = useState('');
  const [telegram, setTelegram] = useState('');
  const [vk, setVk] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [accent, setAccent] = useState('#7c3aed');
  const [menuPosition, setMenuPosition] = useState('top-right');
  const [logoText, setLogoText] = useState('');
  const [showReviews, setShowReviews] = useState(true);
  const [showAbout, setShowAbout] = useState(true);
  const [showStories, setShowStories] = useState(true);
  const [slideshow, setSlideshow] = useState(true);
  const [published, setPublished] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);


  const applyPortfolio = useCallback((p: Portfolio) => {
    setPortfolio(p);
    setTitle(p.title || '');
    setSubtitle(p.subtitle || '');
    setSlug(p.slug || '');
    setAbout(p.about || '');
    setPhone(p.phone || '');
    setInstagram(p.instagram || '');
    setTelegram(p.telegram || '');
    setVk(p.vk || '');
    setWhatsapp(p.whatsapp || '');
    setAccent(p.accent_color || '#7c3aed');
    setMenuPosition(p.menu_position || 'top-right');
    setLogoText(p.logo_text || '');
    setShowReviews(p.show_reviews);
    setShowAbout(p.show_about);
    setShowStories(p.show_stories_block !== false);
    setSlideshow(p.slideshow_enabled);
    setPublished(p.is_published);
    const name = p.user_profile?.name || p.user_profile?.display_name || '';
    setSuggestions(suggestSlugs(name));
  }, []);

  useEffect(() => {
    getMyPortfolio(userId)
      .then(applyPortfolio)
      .finally(() => setLoading(false));
  }, [userId, applyPortfolio]);

  // Проверка доступности slug с задержкой
  useEffect(() => {
    if (!slug || slug === portfolio?.slug) {
      setSlugStatus('idle');
      return;
    }
    setSlugStatus('checking');
    const t = setTimeout(async () => {
      const r = await checkSlug(slug, userId);
      setSlugStatus(r.available ? 'ok' : 'taken');
    }, 500);
    return () => clearTimeout(t);
  }, [slug, portfolio?.slug, userId]);

  const handleSave = async () => {
    if (slugStatus === 'taken') {
      toast({ title: 'Адрес занят', description: 'Выберите другой адрес портфолио', variant: 'destructive' });
      return;
    }
    setSaving(true);
    const r = await savePortfolio(userId, {
      title, subtitle, slug: slugify(slug), about, phone,
      instagram, telegram, vk, whatsapp, accent_color: accent,
      menu_position: menuPosition, logo_text: logoText,
      show_reviews: showReviews, show_about: showAbout,
      show_stories_block: showStories,
      slideshow_enabled: slideshow, is_published: published,
    });
    setSaving(false);
    if (!r.ok) {
      toast({ title: 'Ошибка', description: r.error === 'slug_taken' ? 'Адрес занят' : 'Не удалось сохранить', variant: 'destructive' });
      return;
    }
    if (r.portfolio) applyPortfolio(r.portfolio);
    toast({ title: 'Сохранено', description: 'Портфолио обновлено' });
  };

  const refresh = (p: Portfolio) => applyPortfolio(p);

  const publicUrl = `${PUBLIC_BASE}/p/${slugify(slug) || portfolio?.slug || ''}`;

  if (loading) {
    return (
      <div className="py-10 flex justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Статус публикации + ссылка */}
      <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon name="Globe" size={18} className="text-primary" />
            <span className="font-medium">Публикация портфолио</span>
          </div>
          <Switch checked={published} onCheckedChange={setPublished} />
        </div>
        <p className="text-xs text-muted-foreground">
          {published ? 'Портфолио доступно всем по ссылке.' : 'Портфолио скрыто. Включите, чтобы поделиться.'}
        </p>
        {(slugify(slug) || portfolio?.slug) && (
          <>
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-900 rounded-lg px-3 py-2">
              <Icon name="Link" size={15} className="text-muted-foreground shrink-0" />
              <span className="text-sm truncate flex-1">{publicUrl}</span>
              <button
                onClick={() => { navigator.clipboard.writeText(publicUrl); toast({ title: 'Скопировано' }); }}
                className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded"
                title="Скопировать"
              >
                <Icon name="Copy" size={15} />
              </button>
              <a href={publicUrl} target="_blank" rel="noreferrer" className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded" title="Открыть">
                <Icon name="ExternalLink" size={15} />
              </a>
            </div>
            <Button
              variant="outline"
              className="w-full gap-2"
              onClick={() => window.open(publicUrl, '_blank', 'noreferrer')}
            >
              <Icon name="ExternalLink" size={16} />
              Открыть мою публичную страницу
            </Button>
            {!published && (
              <p className="text-xs text-amber-600 dark:text-amber-500">
                Портфолио скрыто — по ссылке его увидите только вы. Включите публикацию, чтобы показать гостям.
              </p>
            )}
          </>
        )}
      </div>

      {/* Адрес (slug) */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Адрес портфолио (латиницей)</label>
        <div className="relative">
          <Input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            onBlur={() => setSlug(slugify(slug))}
            placeholder="ponomarev-evgeniy"
            className="pr-9"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {slugStatus === 'checking' && <Icon name="Loader2" size={16} className="animate-spin text-muted-foreground" />}
            {slugStatus === 'ok' && <Icon name="Check" size={16} className="text-green-500" />}
            {slugStatus === 'taken' && <Icon name="X" size={16} className="text-red-500" />}
          </div>
        </div>
        {slugStatus === 'taken' && <p className="text-xs text-red-500">Этот адрес уже занят</p>}
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            <span className="text-xs text-muted-foreground py-1">Варианты:</span>
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setSlug(s)}
                className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Название и подзаголовок */}
      <div className="grid gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Заголовок портфолио</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Евгений Пономарёв — фотограф" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Подзаголовок</label>
          <Input value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Свадебная и семейная съёмка" />
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-medium">Текст логотипа (в углу меню)</label>
          <Input value={logoText} onChange={(e) => setLogoText(e.target.value)} placeholder="EVGENIY PONOMAREV" />
        </div>
      </div>

      {/* Положение меню */}
      <div className="space-y-2">
        <label className="text-sm font-medium">Расположение меню на странице</label>
        <div className="grid grid-cols-3 gap-2">
          {[
            { v: 'top-left', label: 'Слева', icon: 'AlignLeft' },
            { v: 'top-center', label: 'По центру', icon: 'AlignCenter' },
            { v: 'top-right', label: 'Справа', icon: 'AlignRight' },
          ].map((opt) => (
            <button
              key={opt.v}
              onClick={() => setMenuPosition(opt.v)}
              className={`flex flex-col items-center gap-1 py-3 rounded-xl border-2 transition ${
                menuPosition === opt.v ? 'border-primary bg-primary/5' : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <Icon name={opt.icon} size={20} className={menuPosition === opt.v ? 'text-primary' : 'text-muted-foreground'} />
              <span className="text-xs">{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Фотографии */}
      <PortfolioPhotosManager
        userId={userId}
        portfolio={portfolio!}
        onChange={refresh}
      />

      {/* Показ слайд-шоу */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2">
          <Icon name="Play" size={18} className="text-primary" />
          <span className="text-sm font-medium">Автоматическое слайд-шоу на обложке</span>
        </div>
        <Switch checked={slideshow} onCheckedChange={setSlideshow} />
      </div>

      {/* Блок категорий на главной */}
      <div className="flex items-center justify-between rounded-xl border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center gap-2">
          <Icon name="LayoutGrid" size={18} className="text-primary" />
          <div>
            <span className="text-sm font-medium block">Блок категорий на главной</span>
            <span className="text-xs text-muted-foreground">Карточки-обложки съёмок. Из меню сверху они доступны всегда.</span>
          </div>
        </div>
        <Switch checked={showStories} onCheckedChange={setShowStories} />
      </div>

      {/* Отзывы */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="MessageSquareQuote" size={18} className="text-primary" />
            <span className="font-medium">Блок «Отзывы клиентов»</span>
          </div>
          <Switch checked={showReviews} onCheckedChange={setShowReviews} />
        </div>
        {showReviews && (
          <PortfolioReviewsManager userId={userId} portfolio={portfolio!} onChange={refresh} />
        )}
      </div>

      {/* Обо мне и контакты */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="User" size={18} className="text-primary" />
            <span className="font-medium">Блок «Обо мне и контакты»</span>
          </div>
          <Switch checked={showAbout} onCheckedChange={setShowAbout} />
        </div>
        {showAbout && (
          <div className="space-y-3">
            <textarea
              value={about}
              onChange={(e) => setAbout(e.target.value)}
              placeholder="Расскажите о себе, опыте, стиле съёмки..."
              rows={4}
              className="w-full rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent px-3 py-2 text-sm resize-y"
            />
            <div className="grid sm:grid-cols-2 gap-3">
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Телефон" />
              <Input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="WhatsApp (номер)" />
              <Input value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="Instagram (ссылка)" />
              <Input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="Telegram (@ник или ссылка)" />
              <Input value={vk} onChange={(e) => setVk(e.target.value)} placeholder="ВКонтакте (ссылка)" />
            </div>
          </div>
        )}
      </div>

      {/* Акцентный цвет */}
      <div className="flex items-center gap-3">
        <label className="text-sm font-medium">Акцентный цвет</label>
        <input type="color" value={accent} onChange={(e) => setAccent(e.target.value)} className="w-10 h-8 rounded cursor-pointer bg-transparent" />
        <span className="text-xs text-muted-foreground">{accent}</span>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? 'Сохранение...' : 'Сохранить портфолио'}
      </Button>
    </div>
  );
};

export default PortfolioSettings;