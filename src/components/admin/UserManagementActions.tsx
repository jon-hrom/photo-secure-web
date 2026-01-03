import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';

interface UserManagementActionsProps {
  isBlocked: boolean;
  showBlockForm: boolean;
  blockReason: string;
  userId: string | number;
  onBlockReasonChange: (reason: string) => void;
  onShowBlockForm: (show: boolean) => void;
  onBlock: () => void;
  onUnblock: () => void;
  onDelete: () => void;
  onOpenPhotoBank: (userId: string | number) => void;
}

const UserManagementActions = ({
  isBlocked,
  showBlockForm,
  blockReason,
  userId,
  onBlockReasonChange,
  onShowBlockForm,
  onBlock,
  onUnblock,
  onDelete,
  onOpenPhotoBank
}: UserManagementActionsProps) => {
  return (
    <div className="border-t pt-4 space-y-3">
      <h4 className="font-semibold flex items-center gap-2">
        <Icon name="Settings" size={18} />
        Управление пользователем
      </h4>

      <Button
        variant="outline"
        onClick={() => {
          console.log('[USER_MANAGEMENT_ACTIONS] Opening photo bank for userId:', userId);
          onOpenPhotoBank(userId);
        }}
        className="w-full gap-2 border-blue-500 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-950/20"
      >
        <Icon name="Images" size={18} />
        Открыть Фото банк пользователя
      </Button>

      {!isBlocked ? (
        <>
          {!showBlockForm ? (
            <Button
              variant="destructive"
              onClick={() => onShowBlockForm(true)}
              className="w-full gap-2"
            >
              <Icon name="Ban" size={18} />
              Заблокировать пользователя
            </Button>
          ) : (
            <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
              <label className="text-sm font-medium">
                Причина блокировки
              </label>
              <Textarea
                value={blockReason}
                onChange={(e) => onBlockReasonChange(e.target.value)}
                placeholder="Укажите причину блокировки..."
                rows={3}
              />
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  onClick={onBlock}
                  className="flex-1 gap-2"
                >
                  <Icon name="Ban" size={16} />
                  Подтвердить блокировку
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    onShowBlockForm(false);
                    onBlockReasonChange('');
                  }}
                  className="flex-1"
                >
                  Отмена
                </Button>
              </div>
            </div>
          )}
        </>
      ) : (
        <Button
          variant="default"
          onClick={onUnblock}
          className="w-full gap-2"
        >
          <Icon name="CheckCircle" size={18} />
          Разблокировать пользователя
        </Button>
      )}

      <Button
        variant="outline"
        onClick={onDelete}
        className="w-full gap-2 border-red-500 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
      >
        <Icon name="Trash2" size={18} />
        Удалить пользователя и все данные
      </Button>
    </div>
  );
};

export default UserManagementActions;