import Icon from '@/components/ui/icon';

const MAX_ICON = 'https://cdn.poehali.dev/projects/07a45ae1-582a-4829-83a6-3f379eb489ff/bucket/7f4f7cba-6d47-47ce-b655-35fb6674612d.png';

interface OfflineContactActionsProps {
  clientName: string;
  clientPhone: string;
  maxLink?: string;
  galleryCode?: string;
  photographerName?: string;
}

const OfflineContactActions = ({ clientPhone }: OfflineContactActionsProps) => {
  const phoneDigits = (clientPhone || '').replace(/[^\d]/g, '');
  const hasPhone = phoneDigits.length >= 10;

  if (!hasPhone) {
    return (
      <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 dark:bg-amber-950/40 dark:text-amber-400 rounded-md px-3 py-2">
        <Icon name="TriangleAlert" size={14} className="shrink-0 mt-0.5" />
        <span>У клиента не указан номер телефона — уведомление в MAX отправить не получится.</span>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-2">
      <img src={MAX_ICON} alt="MAX" className="w-4 h-4 rounded-sm shrink-0 mt-0.5" />
      <span>
        Клиент сейчас не на сайте. Ваше сообщение автоматически придёт ему в <b>MAX</b> с обращением по имени и ссылкой на чат — как только вы его отправите.
      </span>
    </div>
  );
};

export default OfflineContactActions;