import { useEffect, useState } from 'react';
import { fetchLegalList, LegalDocMeta } from '@/lib/legalApi';

const SLUG_PATH: Record<string, string> = {
  'offer': '/offer',
  'privacy-policy': '/privacy-policy',
  'personal-data': '/personal-data',
};

const SLUG_LABEL: Record<string, string> = {
  'offer': 'оферта',
  'privacy-policy': 'конфиденциальность',
  'personal-data': 'обработка пд',
};

const LegalFooter = ({ className = '' }: { className?: string }) => {
  const [docs, setDocs] = useState<LegalDocMeta[]>([]);

  useEffect(() => {
    fetchLegalList().then(setDocs).catch(() => setDocs([]));
  }, []);

  const year = new Date().getFullYear();

  return (
    <footer className={`w-full border-t border-border bg-black/90 text-gray-300 ${className}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold text-white">Foto-Mix</span>
          <span className="text-gray-500">{year} ©</span>
        </div>

        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm">
          {docs.map((d) => (
            <a
              key={d.slug}
              href={SLUG_PATH[d.slug] || `/legal/${d.slug}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-300 hover:text-white transition-colors lowercase"
            >
              {SLUG_LABEL[d.slug] || d.title}
            </a>
          ))}
          <a
            href="mailto:support@foto-mix.ru"
            className="text-gray-300 hover:text-white transition-colors lowercase"
          >
            поддержка
          </a>
        </nav>

        <div className="text-xs text-gray-500 text-center md:text-right">
          НПД Пономарев Е.В. · ИНН 634502706508
        </div>
      </div>
    </footer>
  );
};

export default LegalFooter;