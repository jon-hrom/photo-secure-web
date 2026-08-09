import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';

export interface VKAccount {
  id: number;
  title: string;
  kind: 'group' | 'user';
  vk_target_id: string;
  vk_screen_name: string;
  is_default: boolean;
  is_active: boolean;
  has_token: boolean;
}

interface Props {
  accounts: VKAccount[];
  onEdit: (account: VKAccount) => void;
  onDelete: (account: VKAccount) => void;
  onSetDefault: (account: VKAccount) => void;
  busyId: number | null;
}

const VKAccountsList = ({ accounts, onEdit, onDelete, onSetDefault, busyId }: Props) => {
  if (accounts.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Пока нет подключений. Добавьте сообщество или свою страницу ВКонтакте.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {accounts.map((acc) => (
        <div
          key={acc.id}
          className="flex items-center gap-3 rounded-lg border p-3"
        >
          <Icon
            name={acc.kind === 'group' ? 'Users' : 'User'}
            size={20}
            className="shrink-0 text-blue-600"
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="truncate font-medium">{acc.title}</span>
              {acc.is_default && (
                <span className="rounded bg-blue-100 px-1.5 py-0.5 text-xs text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                  По умолчанию
                </span>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {acc.kind === 'group' ? 'Сообщество' : 'Личная страница'}
              {acc.vk_screen_name ? ` · vk.com/${acc.vk_screen_name}` : ''}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {!acc.is_default && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-xs"
                disabled={busyId === acc.id}
                onClick={() => onSetDefault(acc)}
                title="Сделать основным"
              >
                <Icon name="Star" size={16} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              disabled={busyId === acc.id}
              onClick={() => onEdit(acc)}
              title="Изменить"
            >
              <Icon name="Pencil" size={16} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-red-500 hover:text-red-600"
              disabled={busyId === acc.id}
              onClick={() => onDelete(acc)}
              title="Удалить"
            >
              <Icon name="Trash2" size={16} />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default VKAccountsList;
