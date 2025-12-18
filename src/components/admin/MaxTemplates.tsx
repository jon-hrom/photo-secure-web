import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import Icon from '@/components/ui/icon';
import { toast } from 'sonner';

interface Template {
  id?: number;
  template_type: string;
  template_text: string;
  variables: string[];
  is_active: boolean;
}

const MaxTemplates = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [newTemplate, setNewTemplate] = useState<Template>({
    template_type: '',
    template_text: '',
    variables: [],
    is_active: true
  });

  const maxUrl = 'https://functions.poehali.dev/6bd5e47e-49f9-4af3-a814-d426f5cd1f6d';

  const loadTemplates = async () => {
    try {
      const savedSession = localStorage.getItem('authSession');
      const vkUser = localStorage.getItem('vk_user');
      let userId = null;

      if (savedSession) {
        const session = JSON.parse(savedSession);
        userId = session.userId;
      } else if (vkUser) {
        const user = JSON.parse(vkUser);
        userId = user.id;
      }

      const response = await fetch(maxUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId?.toString() || '1'
        },
        body: JSON.stringify({ action: 'get_templates' })
      });

      const data = await response.json();
      
      if (data.templates) {
        setTemplates(data.templates);
      }
    } catch (error) {
      console.error('Ошибка загрузки шаблонов:', error);
      toast.error('Не удалось загрузить шаблоны');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{([^}]+)\}/g);
    if (!matches) return [];
    return [...new Set(matches.map(m => m.slice(1, -1)))];
  };

  const handleSave = async (template: Template) => {
    try {
      const savedSession = localStorage.getItem('authSession');
      const vkUser = localStorage.getItem('vk_user');
      let userId = null;

      if (savedSession) {
        const session = JSON.parse(savedSession);
        userId = session.userId;
      } else if (vkUser) {
        const user = JSON.parse(vkUser);
        userId = user.id;
      }

      const response = await fetch(maxUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId?.toString() || '1'
        },
        body: JSON.stringify({
          action: 'save_template',
          ...template
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success(template.id ? 'Шаблон обновлён' : 'Шаблон создан');
        setEditingId(null);
        setNewTemplate({
          template_type: '',
          template_text: '',
          variables: [],
          is_active: true
        });
        loadTemplates();
      } else {
        toast.error(data.error || 'Ошибка сохранения');
      }
    } catch (error) {
      console.error('Ошибка сохранения:', error);
      toast.error('Не удалось сохранить шаблон');
    }
  };

  const handleToggleActive = async (template: Template) => {
    try {
      const savedSession = localStorage.getItem('authSession');
      const vkUser = localStorage.getItem('vk_user');
      let userId = null;

      if (savedSession) {
        const session = JSON.parse(savedSession);
        userId = session.userId;
      } else if (vkUser) {
        const user = JSON.parse(vkUser);
        userId = user.id;
      }

      const response = await fetch(maxUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': userId?.toString() || '1'
        },
        body: JSON.stringify({
          action: 'toggle_template',
          id: template.id,
          is_active: !template.is_active
        })
      });

      const data = await response.json();
      
      if (data.success) {
        toast.success('Статус обновлён');
        loadTemplates();
      } else {
        toast.error(data.error || 'Ошибка обновления');
      }
    } catch (error) {
      console.error('Ошибка:', error);
      toast.error('Не удалось обновить статус');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-primary/20 border-t-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-green-50 to-blue-50 rounded-lg border-2 border-green-200 p-6">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-green-500 rounded-lg">
            <Icon name="MessageSquare" className="h-8 w-8 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-xl font-bold mb-2">Шаблоны сообщений MAX</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Управление шаблонами автоматических сообщений через MAX мессенджер
            </p>
            <div className="bg-white rounded-lg p-4 border border-green-200">
              <h4 className="font-semibold mb-2">💡 Как использовать переменные:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• <code className="bg-gray-100 px-2 py-0.5 rounded">{'{code}'}</code> — код подтверждения</li>
                <li>• <code className="bg-gray-100 px-2 py-0.5 rounded">{'{date}'}</code> — дата</li>
                <li>• <code className="bg-gray-100 px-2 py-0.5 rounded">{'{time}'}</code> — время</li>
                <li>• <code className="bg-gray-100 px-2 py-0.5 rounded">{'{photographer_name}'}</code> — имя фотографа</li>
                <li>• <code className="bg-gray-100 px-2 py-0.5 rounded">{'{amount}'}</code> — сумма</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        {templates.map((template) => (
          <div key={template.id} className="border rounded-lg p-6 bg-card">
            {editingId === template.id ? (
              <div className="space-y-4">
                <div>
                  <Label>Тип шаблона</Label>
                  <Input
                    value={template.template_type}
                    disabled
                    className="bg-gray-50"
                  />
                </div>
                <div>
                  <Label>Текст сообщения</Label>
                  <Textarea
                    value={template.template_text}
                    onChange={(e) => {
                      const updated = templates.map(t =>
                        t.id === template.id
                          ? { ...t, template_text: e.target.value }
                          : t
                      );
                      setTemplates(updated);
                    }}
                    rows={8}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Переменные: {extractVariables(template.template_text).join(', ') || 'нет'}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => handleSave(template)} size="sm">
                    <Icon name="Check" className="mr-2 h-4 w-4" />
                    Сохранить
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditingId(null)}
                    size="sm"
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${template.is_active ? 'bg-green-500' : 'bg-gray-300'}`} />
                    <div>
                      <h4 className="font-semibold">{template.template_type}</h4>
                      <p className="text-xs text-muted-foreground">
                        Переменные: {Array.isArray(template.variables) ? template.variables.join(', ') : 'нет'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(template.id!)}
                    >
                      <Icon name="Edit" className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleToggleActive(template)}
                    >
                      <Icon name={template.is_active ? 'EyeOff' : 'Eye'} className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="bg-gray-50 rounded p-3 text-sm whitespace-pre-wrap font-mono border">
                  {template.template_text}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <h4 className="font-semibold mb-4">➕ Создать новый шаблон</h4>
        <div className="space-y-4">
          <div>
            <Label>Тип шаблона (латиницей)</Label>
            <Input
              value={newTemplate.template_type}
              onChange={(e) => setNewTemplate({ ...newTemplate, template_type: e.target.value })}
              placeholder="new_order"
            />
          </div>
          <div>
            <Label>Текст сообщения</Label>
            <Textarea
              value={newTemplate.template_text}
              onChange={(e) => setNewTemplate({ ...newTemplate, template_text: e.target.value })}
              rows={6}
              placeholder="Используйте {переменная} для вставки данных"
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Переменные: {extractVariables(newTemplate.template_text).join(', ') || 'нет'}
            </p>
          </div>
          <Button onClick={() => handleSave(newTemplate)}>
            <Icon name="Plus" className="mr-2 h-4 w-4" />
            Создать шаблон
          </Button>
        </div>
      </div>
    </div>
  );
};

export default MaxTemplates;