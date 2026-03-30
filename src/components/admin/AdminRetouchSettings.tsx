import { useState, useEffect } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import func2url from '@/../backend/func2url.json';

const SETTINGS_URL = (func2url as Record<string, string>)['retouch-settings'];

const QUALITY_LABELS: Record<number, string> = {
  5: 'Быстро',
  10: 'Быстро',
  15: 'Стандарт',
  20: 'Оптимально',
  25: 'Хорошо',
  30: 'Высокое',
  35: 'Высокое',
  40: 'Максимум',
  45: 'Максимум',
  50: 'Максимум',
};

function getQualityLabel(steps: number): string {
  if (steps <= 5) return 'Быстро';
  if (steps <= 10) return 'Быстро';
  if (steps <= 15) return 'Стандарт';
  if (steps <= 20) return 'Оптимально';
  if (steps <= 25) return 'Хорошо';
  if (steps <= 35) return 'Высокое';
  return 'Максимум';
}

function getQualityColor(steps: number): string {
  if (steps <= 10) return 'text-yellow-600';
  if (steps <= 20) return 'text-green-600';
  if (steps <= 35) return 'text-blue-600';
  return 'text-purple-600';
}

export default function AdminRetouchSettings() {
  const [ldmSteps, setLdmSteps] = useState(20);
  const [savedValue, setSavedValue] = useState(20);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const userId = localStorage.getItem('user_id') || '';

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await fetch(SETTINGS_URL, {
        headers: { 'X-User-Id': userId },
      });
      const data = await res.json();
      if (data.settings?.ldm_steps) {
        const val = parseInt(data.settings.ldm_steps.value);
        setLdmSteps(val);
        setSavedValue(val);
      }
    } catch {
      setMessage('Не удалось загрузить настройки');
    }
    setLoading(false);
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage('');
    try {
      const res = await fetch(SETTINGS_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({ key: 'ldm_steps', value: String(ldmSteps) }),
      });
      const data = await res.json();
      if (data.success) {
        setSavedValue(ldmSteps);
        setMessage('Сохранено');
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage(data.error || 'Ошибка сохранения');
      }
    } catch {
      setMessage('Ошибка сети');
    }
    setSaving(false);
  };

  const hasChanges = ldmSteps !== savedValue;

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Icon name="Loader2" size={16} className="animate-spin" />
        Загрузка настроек...
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border">
        <h4 className="font-semibold mb-1 flex items-center gap-2">
          <Icon name="Sparkles" size={16} />
          Качество ретуши LaMa
        </h4>
        <p className="text-xs text-muted-foreground mb-4">
          Количество шагов обработки (ldm_steps). Больше шагов — лучше качество, но медленнее обработка.
        </p>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Быстро</span>
            <span className={`text-lg font-bold ${getQualityColor(ldmSteps)}`}>
              {ldmSteps} шагов — {getQualityLabel(ldmSteps)}
            </span>
            <span className="text-sm text-muted-foreground">Максимум</span>
          </div>

          <Slider
            value={[ldmSteps]}
            onValueChange={(v) => setLdmSteps(v[0])}
            min={1}
            max={50}
            step={1}
            className="w-full"
          />

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>1</span>
            <span>10</span>
            <span>20</span>
            <span>30</span>
            <span>40</span>
            <span>50</span>
          </div>

          <div className="flex items-center gap-3">
            <Button
              onClick={saveSettings}
              disabled={saving || !hasChanges}
              size="sm"
            >
              <Icon name={saving ? 'Loader2' : 'Save'} size={14} className={saving ? 'animate-spin mr-1' : 'mr-1'} />
              Сохранить
            </Button>

            {hasChanges && (
              <Button
                onClick={() => setLdmSteps(savedValue)}
                variant="ghost"
                size="sm"
              >
                Отмена
              </Button>
            )}

            <Button
              onClick={() => setLdmSteps(20)}
              variant="outline"
              size="sm"
              disabled={ldmSteps === 20}
            >
              По умолчанию (20)
            </Button>

            {message && (
              <span className={`text-sm ${message === 'Сохранено' ? 'text-green-600' : 'text-red-500'}`}>
                {message === 'Сохранено' && <Icon name="Check" size={14} className="inline mr-1" />}
                {message}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border border-blue-200 dark:border-blue-800">
        <p className="text-xs text-blue-700 dark:text-blue-300">
          <Icon name="Info" size={12} className="inline mr-1" />
          Настройка влияет на точечную ретушь (LaMa) и автоматическое удаление дефектов. Рекомендуемое значение — 20.
          При значении ниже 10 качество может заметно ухудшиться. Выше 30 — прирост качества минимален, а время обработки увеличивается.
        </p>
      </div>
    </div>
  );
}
