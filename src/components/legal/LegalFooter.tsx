import { useEffect, useState } from 'react';
import { fetchLegalList, LegalDocMeta } from '@/lib/legalApi';
import CreateTicketDialog from '@/components/support/CreateTicketDialog';

const SLUG_PATH: Record<string, string> = {
  'offer': '/offer',
  'privacy-policy': '/privacy-policy',
  'personal-data': '/personal-data',
  'confidentiality': '/confidentiality',
  'cookie-policy': '/cookie-policy',
};

const SLUG_LABEL: Record<string, string> = {
  'offer': 'оферта',
  'privacy-policy': 'рекламные сообщения',
  'personal-data': 'обработка пд',
  'confidentiality': 'политика конфиденциальности',
  'cookie-policy': 'файлы cookie',
};

const LegalFooter = ({ className = '' }: { className?: string }) => {
  const [docs, setDocs] = useState<LegalDocMeta[]>([]);
  const [ticketOpen, setTicketOpen] = useState(false);

  useEffect(() => {
    fetchLegalList().then(setDocs).catch(() => setDocs([]));
  }, []);

  const year = new Date().getFullYear();
  const userId = localStorage.getItem('userId') || 'guest';
  const userName = localStorage.getItem('userName') || undefined;
  const userEmail = localStorage.getItem('userEmail') || undefined;

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
          <button
            onClick={() => setTicketOpen(true)}
            className="text-gray-300 hover:text-white transition-colors lowercase cursor-pointer bg-transparent border-0 p-0 font-[inherit] text-[inherit]"
          >
            тех.поддержка
          </button>
        </nav>

        <div className="text-xs text-gray-500 text-center md:text-right">
          НПД Пономарев Е.В. · ИНН 634502706508
        </div>
      </div>

      <CreateTicketDialog
        open={ticketOpen}
        onClose={() => setTicketOpen(false)}
        userId={userId}
        userName={userName}
        userEmail={userEmail}
        onCreated={() => setTicketOpen(false)}
      />
    </footer>
  );
};

export default LegalFooter;