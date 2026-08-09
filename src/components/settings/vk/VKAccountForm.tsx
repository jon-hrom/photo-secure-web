import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { VKAccount } from './VKAccountsList';

interface Props {
  editing: VKAccount | null;
  saving: boolean;
  onSave: (payload: {
    id?: number;
    kind: 'group' | 'user';
    vk_target_id: string;
    access_token: string;
    title: string;
  }) => void;
  onCancel: () => void;
}

const VKAccountForm = ({ editing, saving, onSave, onCancel }: Props) => {
  const [targetId, setTargetId] = useState('');
  const [token, setToken] = useState('');
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (editing) {
      setTargetId(editing.vk_screen_name || editing.vk_target_id);
      setTitle(editing.title);
      setToken('');
    } else {
      setTargetId('');
      setTitle('');
      setToken('');
    }
  }, [editing]);

  const canSave = !!targetId.trim() && (!!token.trim() || !!editing);

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <p className="flex items-center gap-2 font-semibold">
        <Icon name="Users" size={18} className="text-blue-600" />
        {editing ? 'Изменить сообщество' : 'Новое сообщество'}
      </p>

      <div className="space-y-2">
        <Label htmlFor="vk-target">ID или короткое имя сообщества</Label>
        <Input
          id="vk-target"
          value={targetId}
          onChange={(e) => setTargetId(e.target.value)}
          placeholder="Например: 123456789 или mystudio"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="vk-token">
          Токен сообщества
          {editing && <span className="ml-1 text-muted-foreground">(пусто — не менять)</span>}
        </Label>
        <Input
          id="vk-token"
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="vk1.a.xxxxxxxxxxxx"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="vk-title">Название (необязательно)</Label>
        <Input
          id="vk-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Например: Основная группа"
        />
      </div>

      <div className="flex gap-2">
        <Button
          onClick={() => onSave({
            id: editing?.id,
            kind: 'group',
            vk_target_id: targetId.trim(),
            access_token: token.trim(),
            title: title.trim(),
          })}
          disabled={saving || !canSave}
          className="flex-1 bg-blue-600 hover:bg-blue-700"
        >
          {saving ? (
            <>
              <Icon name="Loader2" size={18} className="mr-2 animate-spin" />
              Проверяю в ВК...
            </>
          ) : (
            <>
              <Icon name="Save" size={18} className="mr-2" />
              Сохранить
            </>
          )}
        </Button>
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Отмена
        </Button>
      </div>
    </div>
  );
};

export default VKAccountForm;
