import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { isAdminUser } from '@/utils/adminCheck';
import Icon from '@/components/ui/icon';

const API_URL = 'https://functions.poehali.dev/885fca99-51b3-4dd5-97da-cde77d340794';

interface PipelineOp {
  op: string;
  [key: string]: string | number | boolean;
}

interface Preset {
  id: number;
  name: string;
  pipeline_json: PipelineOp[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

const getAuthHeaders = (): Record<string, string> => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const session = localStorage.getItem('authSession');
  if (session) {
    try {
      const parsed = JSON.parse(session);
      if (parsed.userId) headers['X-User-Id'] = String(parsed.userId);
    } catch (e) { console.error('Auth parse error', e); }
  }
  return headers;
};

export default function AdminPipelineEditor() {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editName, setEditName] = useState('default');
  const [editJson, setEditJson] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [jsonError, setJsonError] = useState('');
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    const session = localStorage.getItem('authSession');
    const vkUser = localStorage.getItem('vk_user');
    let email = null, vkData = null;
    if (session) try { email = JSON.parse(session).userEmail; } catch (e) { console.error(e); }
    if (vkUser) try { vkData = JSON.parse(vkUser); } catch (e) { console.error(e); }
    if (!isAdminUser(email, vkData)) {
      toast({ title: 'Нет доступа', variant: 'destructive' });
      navigate('/');
      return;
    }
    loadPresets();
  }, []);

  const loadPresets = async () => {
    setLoading(true);
    try {
      const res = await fetch(API_URL, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPresets(data.presets || []);
      const def = (data.presets || []).find((p: Preset) => p.is_default) || data.presets?.[0];
      if (def) selectPreset(def);
    } catch (e: unknown) {
      toast({ title: 'Ошибка загрузки', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const selectPreset = (preset: Preset) => {
    setEditName(preset.name);
    setEditJson(JSON.stringify(preset.pipeline_json, null, 2));
    setIsDefault(preset.is_default);
    setJsonError('');
  };

  const validateJson = (text: string): PipelineOp[] | null => {
    try {
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) { setJsonError('Должен быть массив []'); return null; }
      for (let i = 0; i < parsed.length; i++) {
        if (!parsed[i].op) { setJsonError(`Элемент [${i}]: нет поля "op"`); return null; }
      }
      setJsonError('');
      return parsed;
    } catch (e: unknown) {
      setJsonError(`JSON ошибка: ${e instanceof Error ? e.message : 'invalid'}`);
      return null;
    }
  };

  const handleSave = async () => {
    const pipeline = validateJson(editJson);
    if (!pipeline) return;
    if (!editName.trim()) { toast({ title: 'Введите имя пресета', variant: 'destructive' }); return; }

    setSaving(true);
    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ name: editName.trim(), pipeline_json: pipeline, is_default: isDefault }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: 'Сохранено', description: `Пресет "${editName}" обновлён` });
      loadPresets();
    } catch (e: unknown) {
      toast({ title: 'Ошибка сохранения', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (name: string) => {
    if (!confirm(`Удалить пресет "${name}"?`)) return;
    try {
      const res = await fetch(`${API_URL}?name=${encodeURIComponent(name)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: 'Удалено' });
      loadPresets();
    } catch (e: unknown) {
      toast({ title: 'Ошибка', description: e instanceof Error ? e.message : 'Unknown error', variant: 'destructive' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Icon name="Loader2" className="animate-spin" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/admin/storage')}>
            <Icon name="ArrowLeft" size={20} />
          </Button>
          <h1 className="text-2xl font-bold">Pipeline Editor</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Пресеты</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {presets.map((p) => (
                <div
                  key={p.id}
                  className={`flex items-center justify-between p-2 rounded cursor-pointer transition-colors ${
                    editName === p.name ? 'bg-primary/10 border border-primary/30' : 'hover:bg-muted'
                  }`}
                  onClick={() => selectPreset(p)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{p.name}</span>
                    {p.is_default && (
                      <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">default</span>
                    )}
                  </div>
                  {p.name !== 'default' && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => { e.stopPropagation(); handleDelete(p.name); }}
                    >
                      <Icon name="Trash2" size={14} />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => {
                  setEditName('');
                  setEditJson('[\n  {"op": "skin_smooth", "strength": 0.4}\n]');
                  setIsDefault(false);
                  setJsonError('');
                }}
              >
                <Icon name="Plus" size={14} className="mr-1" /> Новый пресет
              </Button>
            </CardContent>
          </Card>

          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-lg">Редактор</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-3">
                <Input
                  placeholder="Имя пресета"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1"
                />
                <label className="flex items-center gap-2 text-sm cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={isDefault}
                    onChange={(e) => setIsDefault(e.target.checked)}
                    className="rounded"
                  />
                  По умолчанию
                </label>
              </div>

              <div>
                <label className="text-sm text-muted-foreground mb-1 block">
                  Pipeline JSON (массив операций)
                </label>
                <Textarea
                  value={editJson}
                  onChange={(e) => {
                    setEditJson(e.target.value);
                    if (jsonError) validateJson(e.target.value);
                  }}
                  onBlur={() => validateJson(editJson)}
                  className="font-mono text-sm min-h-[300px]"
                  placeholder='[{"op": "skin_smooth", "strength": 0.4}]'
                />
                {jsonError && (
                  <p className="text-sm text-destructive mt-1 flex items-center gap-1">
                    <Icon name="AlertCircle" size={14} /> {jsonError}
                  </p>
                )}
              </div>

              <div className="flex gap-3">
                <Button onClick={handleSave} disabled={saving || !!jsonError}>
                  {saving ? <Icon name="Loader2" className="animate-spin mr-2" size={16} /> : <Icon name="Save" className="mr-2" size={16} />}
                  Сохранить
                </Button>
                <Button variant="outline" onClick={() => {
                  try {
                    const parsed = JSON.parse(editJson);
                    setEditJson(JSON.stringify(parsed, null, 2));
                    setJsonError('');
                  } catch (e) { console.error(e); }
                }}>
                  <Icon name="AlignLeft" className="mr-2" size={16} /> Форматировать
                </Button>
              </div>

              <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
                <p>Каждая операция — объект с полем <code className="bg-muted px-1 rounded">"op"</code> и параметрами.</p>
                <p>Пример: <code className="bg-muted px-1 rounded">{'{"op":"deshine","strength":0.55,"knee":0.8}'}</code></p>
                <p>Операции выполняются по порядку сверху вниз.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}