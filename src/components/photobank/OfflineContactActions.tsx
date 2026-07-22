import Icon from '@/components/ui/icon';
import { maxContacts } from '@/utils/maxLink';

const MAX_ICON = 'https://cdn.poehali.dev/projects/07a45ae1-582a-4829-83a6-3f379eb489ff/bucket/7f4f7cba-6d47-47ce-b655-35fb6674612d.png';

interface OfflineContactActionsProps {
  clientName: string;
  clientPhone: string;
  maxLink?: string;
  galleryCode?: string;
  photographerName?: string;
}

// Берём первое слово из ФИО как имя для обращения
const firstName = (fullName: string): string => {
  const n = (fullName || '').trim().split(/\s+/)[0];
  return n || 'Здравствуйте';
};

const OfflineContactActions = ({
  clientName,
  clientPhone,
  maxLink,
  galleryCode,
  photographerName,
}: OfflineContactActionsProps) => {
  const name = firstName(clientName);
  const chatUrl = galleryCode ? `https://foto-mix.ru/g/${galleryCode}` : '';

  const greeting = `${name}, здравствуйте! Это фотограф${photographerName ? ` ${photographerName}` : ''}. Написал(а) вам в чат галереи.`;
  const messageText = chatUrl
    ? `${greeting}\nОтветить можно тут: ${chatUrl}`
    : greeting;

  const encoded = encodeURIComponent(messageText);

  const phoneDigits = (clientPhone || '').replace(/[^\d]/g, '');
  const waPhone = phoneDigits.length === 11 && phoneDigits.startsWith('8')
    ? '7' + phoneDigits.slice(1)
    : phoneDigits;
  const hasWhatsApp = waPhone.length >= 10;
  const whatsappUrl = `https://wa.me/${waPhone}?text=${encoded}`;

  const maxBtns = maxContacts(maxLink, MAX_ICON, 'max');
  const hasMax = maxBtns.length > 0;
  const maxUrl = hasMax ? maxBtns[0].href : '';

  if (!hasWhatsApp && !hasMax) {
    return (
      <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 rounded-md px-3 py-2">
        <Icon name="TriangleAlert" size={14} className="shrink-0 mt-0.5" />
        <span>Нет контактов для связи в мессенджере. У клиента не указан номер телефона и профиль MAX.</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground flex items-center gap-1.5">
        <Icon name="MoonStar" size={13} />
        Клиент сейчас не на сайте — напишите ему в мессенджер:
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {hasWhatsApp && (
          <a
            href={whatsappUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-green-600 text-white text-sm font-medium hover:bg-green-700 transition-colors"
          >
            <Icon name="MessageCircle" size={16} />
            Написать в WhatsApp
          </a>
        )}
        {hasMax && (
          <a
            href={maxUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-md bg-[#2787F5] text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <img src={MAX_ICON} alt="MAX" className="w-4 h-4 rounded-sm" />
            Написать в MAX
          </a>
        )}
      </div>
      {!hasMax && (
        <p className="text-[11px] text-muted-foreground flex items-center gap-1">
          <Icon name="Info" size={11} className="shrink-0" />
          MAX недоступен: у клиента не указан профиль MAX (по номеру телефона MAX писать не умеет).
        </p>
      )}
    </div>
  );
};

export default OfflineContactActions;
