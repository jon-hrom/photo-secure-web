import { useState } from 'react';
import Icon from '@/components/ui/icon';
import { PortfolioCategory } from '@/lib/portfolioApi';

interface Props {
  logo: string;
  categories: PortfolioCategory[];
  position: string;
  showReviews: boolean;
  showAbout: boolean;
  onOpenCategory: (categorySlug: string) => void;
  onScrollTo: (id: string) => void;
}

const posClasses: Record<string, string> = {
  'top-right': 'justify-between',
  'top-left': 'flex-row-reverse justify-between',
  'top-center': 'justify-center gap-8',
};

const PortfolioNav = ({ logo, categories, position, showReviews, showAbout, onOpenCategory, onScrollTo }: Props) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = (
    <>
      {categories.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-1 uppercase tracking-widest text-sm font-medium hover:text-white/70 transition"
          >
            Меню <Icon name="ChevronDown" size={14} className={`transition ${menuOpen ? 'rotate-180' : ''}`} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 mt-3 min-w-[200px] bg-black/95 backdrop-blur border border-white/10 rounded-xl py-2 z-50">
              {categories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { onOpenCategory(c.slug); setMenuOpen(false); setMobileOpen(false); }}
                  className="block w-full text-left px-4 py-2 text-sm hover:bg-white/10 transition"
                >
                  {c.title}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      {showReviews && (
        <button onClick={() => { onScrollTo('reviews'); setMobileOpen(false); }} className="uppercase tracking-widest text-sm font-medium hover:text-white/70 transition">
          Отзывы
        </button>
      )}
      <button onClick={() => { onScrollTo('stories'); setMobileOpen(false); }} className="uppercase tracking-widest text-sm font-medium hover:text-white/70 transition">
        Истории
      </button>
      {showAbout && (
        <button onClick={() => { onScrollTo('contacts'); setMobileOpen(false); }} className="uppercase tracking-widest text-sm font-medium hover:text-white/70 transition">
          Контакты
        </button>
      )}
    </>
  );

  return (
    <header className="absolute top-0 left-0 right-0 z-40 px-5 sm:px-10 py-5">
      <div className={`flex items-center ${posClasses[position] || posClasses['top-right']}`}>
        <button onClick={() => onScrollTo('top')} className="border border-white/70 px-3 py-1.5 text-[11px] tracking-[0.2em] uppercase font-light hover:bg-white/10 transition">
          {logo}
        </button>
        <nav className="hidden md:flex items-center gap-7 text-white">{links}</nav>
        <button className="md:hidden text-white" onClick={() => setMobileOpen(true)}>
          <Icon name="Menu" size={26} />
        </button>
      </div>

      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center gap-8 text-white">
          <button className="absolute top-5 right-5" onClick={() => setMobileOpen(false)}>
            <Icon name="X" size={28} />
          </button>
          {links}
        </div>
      )}
    </header>
  );
};

export default PortfolioNav;