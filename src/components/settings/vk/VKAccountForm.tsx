import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { VKAccount } from './VKAccountsList';
import VKUserTokenHelp from './VKUserTokenHelp';

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
  const [kind, setKind] = useState<'group' | 'user'>('group');
  const [targetId, setTargetId] = useState('');
  const [token, setToken] = useState('');
  const [title, setTitle] = useState('');

  useEffect(() => {
    if (editing) {
      setKind(editing.kind);
      setTargetId(editing.vk_screen_name || editing.vk_target_id);
      setTitle(editing.title);
      setToken('');
    } else {
      setKind('group');
      setTargetId('');
      setTitle('');
      setToken('');
    }
  }, [editing]);

  const canSave = kind === 'user'
    ? (!!token.trim() || !!editing)
    : (!!targetId.trim() && (!!token.trim() || !!editing));

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <p className="font-semibold">
        {editing ? 'Изменить подключение' : 'Новое подключение'}
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant={kind === 'group' ? 'default' : 'outline'}
          onClick={() => setKind('group')}
          className={kind === 'group' ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          <Icon name="Users" size={18} className="mr-2" />
          Сообщество
        </Button>
        <Button
          type="button"
          variant={kind === 'user' ? 'default' : 'outline'}
          onClick={() => setKind('user')}
          className={kind === 'user' ? 'bg-blue-600 hover:bg-blue-700' : ''}
        >
          <Icon name="User" size={18} className="mr-2" />
          Моя страница
        </Button>
      </div>

      {kind === 'user' && <VKUserTokenHelp />}

      {kind === 'group' && (
        <div className="space-y-2">
          <Label htmlFor="vk-target">ID или короткое имя сообщества</Label>
          <Input
            id="vk-target"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            placeholder="Например: 123456789 или mystudio"
          />
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="vk-token">
          {kind === 'group' ? 'Токен сообщества' : 'Токен вашей страницы'}
          {editing && <span className="ml-1 text-muted-foreground">(пусто — не менять)</span>}
        </Label>
        <Input
          id="vk-token"
          type={kind === 'user' ? 'text' : 'password'}
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder={
            kind === 'user'
              ? 'Вставьте адрес из адресной строки целиком'
              : 'vk1.a.xxxxxxxxxxxx'
          }
        />
        {kind === 'user' && (
          <p className="text-xs text-muted-foreground">
            Можно вставить весь адрес — система сама найдёт в нём токен.
          </p>
        )}
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
            kind,
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