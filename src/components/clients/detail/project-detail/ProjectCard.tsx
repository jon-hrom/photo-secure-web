import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { Project, PhotoItem } from '@/components/clients/ClientsTypes';
import { ShootingStyleSelector } from '@/components/clients/dialog/ShootingStyleSelector';
import { getShootingStyles } from '@/data/shootingStyles';
import { getUserTimezoneShort } from '@/utils/regionTimezone';
import DurationSelect from './DurationSelect';
import { useState, useRef, useEffect, useMemo } from 'react';

interface ProjectCardProps {
  project: Project;
  isExpanded: boolean;
  selectorKey: number;
  animateKey: number;
  projectPaid: number;
  projectRemaining: number;
  statusBadge: JSX.Element;
  onToggleExpand: () => void;
  onDelete: () => void;
  onSaveChanges: (updates: Partial<Project>, notifyClient?: boolean) => void | Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onResendNotifications?: (projectId: number) => void | Promise<void>;
}

type DraftFields = {
  budget: number;
  startDate: string;
  shootingStyleId?: string;
  shooting_time?: string;
  shooting_duration?: number;
  shooting_address?: string;
  hourly_rate?: number;
  studio_hourly_rate?: number;
  photobook_count?: number;
  photobook_price?: number;
  photo_items: PhotoItem[];
  status: Project['status'];
  cancel_reason?: string;
};

const PHOTO_FORMAT_PRESETS = ['20×30 (A4)', '15×20', '10×15', '21×30 (A4)', '30×40', '13×18'];

const toDateInputValue = (value?: string | null) => {
  if (!value || value === 'None' || value === 'null') return '';
  if (typeof value !== 'string') return '';
  const isoMatch = value.match(/^(\d{4}-\d{2}-\d{2})/);
  if (isoMatch) return isoMatch[1];
  try {
    const date = new Date(value);
    if (isNaN(date.getTime())) return '';
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  } catch {
    return '';
  }
};

const buildDraftFromProject = (project: Project): DraftFields => ({
  budget: project.budget,
  startDate: toDateInputValue(project.startDate),
  shootingStyleId: project.shootingStyleId,
  shooting_time: project.shooting_time,
  shooting_duration: project.shooting_duration,
  shooting_address: project.shooting_address,
  hourly_rate: project.hourly_rate,
  studio_hourly_rate: project.studio_hourly_rate,
  photobook_count: project.photobook_count,
  photobook_price: project.photobook_price,
  photo_items: Array.isArray(project.photo_items) ? project.photo_items : [],
  status: project.status,
  cancel_reason: project.cancel_reason,
});

// Полный пересчёт бюджета: съёмка + фотокниги + печать фото
const calcFullBudget = (d: DraftFields): number => {
  const rate = Number(d.hourly_rate) || 0;
  const durationMin = Number(d.shooting_duration) || 0;
  const shooting = rate > 0 ? (durationMin / 60) * rate : 0;
  const studioRate = Number(d.studio_hourly_rate) || 0;
  const studio = studioRate > 0 ? (durationMin / 60) * studioRate : 0;
  const books = (Number(d.photobook_count) || 0) * (Number(d.photobook_price) || 0);
  const photos = (d.photo_items || []).reduce(
    (s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0),
    0
  );
  return Math.round(shooting + studio + books + photos);
};

const ProjectCard = ({
  project,
  isExpanded,
  selectorKey,
  animateKey,
  projectPaid,
  projectRemaining,
  statusBadge,
  onToggleExpand,
  onDelete,
  onSaveChanges,
  onDirtyChange,
  onTouchStart,
  onTouchEnd,
  onResendNotifications,
}: ProjectCardProps) => {
  const [isResending, setIsResending] = useState(false);
  const [draft, setDraft] = useState<DraftFields>(() => buildDraftFromProject(project));
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetValue, setBudgetValue] = useState(String(project.budget));
  const budgetInputRef = useRef<HTMLInputElement>(null);
  const reasonInputRef = useRef<HTMLTextAreaElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isDirtyRef = useRef(false);
  // Только что сохранённое значение ставки. Сервер в фоновом ответе может
  // временно прислать проект без неё — тогда держим сохранённое значение,
  // чтобы поле не обнулялось и карточка не зацикливалась на "не сохранено".
  const justSavedRateRef = useRef<number | null | undefined>(undefined);

  // "Эталонный" проект с учётом только что сохранённой ставки — от него
  // строится и draft, и сравнение isDirty, чтобы не было рассинхрона.
  const originalDraft = useMemo<DraftFields>(() => {
    const base = buildDraftFromProject(project);
    if (justSavedRateRef.current !== undefined) {
      base.hourly_rate = justSavedRateRef.current ?? undefined;
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    project.id,
    project.budget,
    project.startDate,
    project.shootingStyleId,
    project.shooting_time,
    project.shooting_duration,
    project.shooting_address,
    project.hourly_rate,
    project.studio_hourly_rate,
    project.status,
    project.cancel_reason,
  ]);

  useEffect(() => {
    // Если сервер подтвердил нашу сохранённую ставку — снимаем защиту.
    if (
      justSavedRateRef.current !== undefined &&
      (project.hourly_rate ?? undefined) === (justSavedRateRef.current ?? undefined)
    ) {
      justSavedRateRef.current = undefined;
    }
    // Не перетираем несохранённые правки пользователя при фоновом обновлении.
    if (isDirtyRef.current) return;
    setDraft(originalDraft);
    setBudgetValue(String(originalDraft.budget));
  }, [originalDraft, project.hourly_rate]);

  useEffect(() => {
    if (isEditingBudget && budgetInputRef.current) {
      budgetInputRef.current.focus();
      budgetInputRef.current.select();
    }
  }, [isEditingBudget]);

  const isDirty = useMemo(() => {
    return (
      draft.budget !== originalDraft.budget ||
      draft.startDate !== originalDraft.startDate ||
      (draft.shootingStyleId || '') !== (originalDraft.shootingStyleId || '') ||
      (draft.shooting_time || '') !== (originalDraft.shooting_time || '') ||
      (draft.shooting_duration || 0) !== (originalDraft.shooting_duration || 0) ||
      (draft.shooting_address || '') !== (originalDraft.shooting_address || '') ||
      (draft.hourly_rate || 0) !== (originalDraft.hourly_rate || 0) ||
      (draft.studio_hourly_rate || 0) !== (originalDraft.studio_hourly_rate || 0) ||
      (draft.photobook_count || 0) !== (originalDraft.photobook_count || 0) ||
      (draft.photobook_price || 0) !== (originalDraft.photobook_price || 0) ||
      JSON.stringify(draft.photo_items || []) !== JSON.stringify(originalDraft.photo_items || []) ||
      draft.status !== originalDraft.status ||
      (draft.cancel_reason || '') !== (originalDraft.cancel_reason || '')
    );
  }, [draft, originalDraft]);

  const isCancelled = draft.status === 'cancelled';
  const cancelReasonMissing = isCancelled && !(draft.cancel_reason || '').trim();

  useEffect(() => {
    isDirtyRef.current = isDirty;
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const updateDraft = (patch: Partial<DraftFields>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
  };

  // Применяем изменение и пересчитываем бюджет от всех составляющих
  const applyAndRecalc = (patch: Partial<DraftFields>) => {
    setDraft((prev) => {
      const next = { ...prev, ...patch };
      const newBudget = calcFullBudget(next);
      next.budget = newBudget;
      setBudgetValue(String(newBudget));
      return next;
    });
  };

  const handleRateChange = (rateStr: string) => {
    const rate = rateStr === '' ? undefined : parseFloat(rateStr.replace(',', '.'));
    applyAndRecalc({ hourly_rate: rate });
  };

  const handleStudioRateChange = (rateStr: string) => {
    const rate = rateStr === '' ? undefined : parseFloat(rateStr.replace(',', '.'));
    applyAndRecalc({ studio_hourly_rate: rate });
  };

  const handleDurationChange = (durationMin: number) => {
    applyAndRecalc({ shooting_duration: durationMin });
  };

  const updatePhotoItem = (index: number, patch: Partial<PhotoItem>) => {
    const items = (draft.photo_items || []).map((it, i) => (i === index ? { ...it, ...patch } : it));
    applyAndRecalc({ photo_items: items });
  };

  const addPhotoItem = () => {
    applyAndRecalc({ photo_items: [...(draft.photo_items || []), { format: '', qty: 1, price: 0 }] });
  };

  const removePhotoItem = (index: number) => {
    applyAndRecalc({ photo_items: (draft.photo_items || []).filter((_, i) => i !== index) });
  };

  const handleBudgetSave = () => {
    const parsed = parseFloat(budgetValue);
    if (!isNaN(parsed) && parsed >= 0) {
      updateDraft({ budget: parsed });
    } else {
      setBudgetValue(String(draft.budget));
    }
    setIsEditingBudget(false);
  };

  const handleSave = async (notifyClient: boolean = false) => {
    if (!isDirty || isSaving) return;
    if (cancelReasonMissing) {
      reasonInputRef.current?.focus();
      return;
    }
    const updates: Partial<Project> = {};
    if (draft.budget !== originalDraft.budget) updates.budget = draft.budget;
    if (draft.startDate !== originalDraft.startDate) updates.startDate = draft.startDate;
    if ((draft.shootingStyleId || '') !== (originalDraft.shootingStyleId || '')) {
      updates.shootingStyleId = draft.shootingStyleId;
    }
    if ((draft.shooting_time || '') !== (originalDraft.shooting_time || '')) {
      updates.shooting_time = draft.shooting_time;
    }
    if ((draft.shooting_duration || 0) !== (originalDraft.shooting_duration || 0)) {
      updates.shooting_duration = draft.shooting_duration;
    }
    if ((draft.shooting_address || '') !== (originalDraft.shooting_address || '')) {
      updates.shooting_address = draft.shooting_address;
    }
    if ((draft.hourly_rate || 0) !== (originalDraft.hourly_rate || 0)) {
      updates.hourly_rate = draft.hourly_rate;
    }
    if ((draft.studio_hourly_rate || 0) !== (originalDraft.studio_hourly_rate || 0)) {
      updates.studio_hourly_rate = draft.studio_hourly_rate;
    }
    if ((draft.photobook_count || 0) !== (originalDraft.photobook_count || 0)) {
      updates.photobook_count = draft.photobook_count;
    }
    if ((draft.photobook_price || 0) !== (originalDraft.photobook_price || 0)) {
      updates.photobook_price = draft.photobook_price;
    }
    if (JSON.stringify(draft.photo_items || []) !== JSON.stringify(originalDraft.photo_items || [])) {
      updates.photo_items = (draft.photo_items || []).filter(
        (it) => it.format && ((Number(it.qty) || 0) > 0 || (Number(it.price) || 0) > 0)
      );
    }
    if (draft.status !== originalDraft.status) updates.status = draft.status;
    if (draft.status === 'cancelled') {
      updates.status = 'cancelled';
      updates.cancel_reason = (draft.cancel_reason || '').trim();
    } else if ((draft.cancel_reason || '') !== (originalDraft.cancel_reason || '')) {
      updates.cancel_reason = (draft.cancel_reason || '').trim();
    }

    justSavedRateRef.current = draft.hourly_rate ?? null;
    setIsSaving(true);
    try {
      await onSaveChanges(updates, notifyClient);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    justSavedRateRef.current = undefined;
    setDraft(originalDraft);
    setBudgetValue(String(originalDraft.budget));
    setIsEditingBudget(false);
  };

  const recomputedRemaining = draft.budget - projectPaid;

  return (
    <Card
      key={`project-card-${project.id}`}
      className={`animate-in slide-in-from-top-4 fade-in duration-500 ${
        !draft.startDate ? 'border-2 border-orange-500 bg-orange-50/50 dark:bg-orange-950/40' : ''
      } ${isDirty ? 'ring-2 ring-primary/40' : ''}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <CardHeader
        className="cursor-pointer hover:bg-accent/50 active:bg-accent/70 transition-colors px-3 sm:px-6 py-3 sm:py-4"
        onClick={onToggleExpand}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <CardTitle className="flex items-center gap-2 flex-wrap text-base sm:text-lg">
              <Icon name={isExpanded ? 'ChevronDown' : 'ChevronRight'} size={20} className="shrink-0" />
              <span className="truncate">{project.name}</span>
              {statusBadge}
              {!draft.startDate && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500 text-white">
                  <Icon name="CalendarX" size={12} />
                  Без даты
                </span>
              )}
              {isDirty && (
                <span
                  className="unsaved-blink inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] sm:text-xs font-extrabold uppercase tracking-wide text-white bg-gradient-to-r from-red-500 via-orange-500 to-yellow-400 shadow-[0_0_14px_rgba(255,196,0,0.75)] ring-2 ring-yellow-300/80"
                  role="status"
                  aria-live="polite"
                >
                  <Icon name="AlertTriangle" size={12} />
                  Изменения не сохранены
                </span>
              )}
            </CardTitle>
            {isExpanded && (
              <>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm">
                  <span className="text-muted-foreground">Бюджет: {isEditingBudget ? (
                    <input
                      ref={budgetInputRef}
                      type="number"
                      min="0"
                      step="100"
                      value={budgetValue}
                      onChange={(e) => setBudgetValue(e.target.value)}
                      onBlur={handleBudgetSave}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleBudgetSave();
                        if (e.key === 'Escape') {
                          setBudgetValue(String(draft.budget));
                          setIsEditingBudget(false);
                        }
                      }}
                      onClick={(e) => e.stopPropagation()}
                      className="inline-block w-28 h-6 px-1.5 text-xs font-medium border rounded bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  ) : (
                    <span
                      className="font-medium text-foreground cursor-pointer hover:underline decoration-dashed underline-offset-2"
                      onClick={(e) => { e.stopPropagation(); setIsEditingBudget(true); }}
                      title="Нажмите для изменения бюджета"
                    >{draft.budget.toLocaleString('ru-RU')} ₽</span>
                  )}</span>
                  <span className="text-muted-foreground">Оплачено: <span key={`paid-${project.id}-${animateKey}`} className="font-medium text-green-600 dark:text-green-400 inline-block animate-in fade-in zoom-in-50 duration-500">{projectPaid.toLocaleString('ru-RU')} ₽</span></span>
                  <span className="text-muted-foreground">Осталось: <span key={`remaining-${project.id}-${animateKey}`} className="font-medium text-orange-600 dark:text-orange-400 inline-block animate-in fade-in zoom-in-50 duration-500">{recomputedRemaining.toLocaleString('ru-RU')} ₽</span></span>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mt-1">
                  <Label className="text-xs text-muted-foreground shrink-0">Дата съёмки:</Label>
                  <Input
                    type="date"
                    min="2020-01-01"
                    max="2099-12-31"
                    value={draft.startDate}
                    onChange={(e) => {
                      e.stopPropagation();
                      updateDraft({ startDate: e.target.value });
                    }}
                    onClick={(e) => e.stopPropagation()}
                    className="text-xs h-8 w-full sm:w-44 pr-1"
                  />
                </div>
                {draft.shootingStyleId && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    Стиль: <span className="font-medium text-foreground">
                      {getShootingStyles().find(s => s.id === draft.shootingStyleId)?.name}
                    </span>
                  </div>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 justify-end">
            {(isDirty || isSaving) && (
              <Button
                variant="default"
                size="sm"
                disabled={!isDirty || isSaving || cancelReasonMissing}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSave(true);
                }}
                title={cancelReasonMissing ? 'Укажите причину отмены' : 'Сохранить и отправить изменения клиенту'}
                aria-label="Сохранить и отправить изменения клиенту"
                className="h-auto min-h-[44px] py-1 px-2.5 whitespace-normal leading-[1.1] text-[11px] sm:text-xs font-semibold flex items-center gap-1.5 max-w-[150px] sm:max-w-[170px]"
              >
                {isSaving ? (
                  <>
                    <Icon name="Loader2" size={14} className="shrink-0 animate-spin" />
                    <span>Сохраняю…</span>
                  </>
                ) : (
                  <>
                    <Icon name="Save" size={14} className="shrink-0" />
                    <span className="text-left">
                      Сохранить и отправить
                      <br />
                      изменения клиенту
                    </span>
                  </>
                )}
              </Button>
            )}
            {isDirty && !isSaving && (
              <Button
                variant="ghost"
                size="sm"
                onClick={(e) => {
                  e.stopPropagation();
                  handleReset();
                }}
                title="Отменить изменения"
                aria-label="Отменить изменения"
                className="h-11 w-11 sm:h-9 sm:w-9 p-0"
              >
                <Icon name="Undo2" size={18} />
              </Button>
            )}
            {onResendNotifications && draft.startDate && (
              <Button
                variant="ghost"
                size="sm"
                disabled={isResending}
                onClick={async (e) => {
                  e.stopPropagation();
                  if (isResending) return;
                  setIsResending(true);
                  try {
                    await onResendNotifications(project.id);
                  } finally {
                    setIsResending(false);
                  }
                }}
                title="Переотправить уведомления клиенту и фотографу"
                aria-label="Переотправить уведомления"
                className="h-11 w-11 sm:h-9 sm:w-9 p-0 text-purple-600 hover:text-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40"
              >
                <Icon name={isResending ? 'Loader2' : 'Send'} size={18} className={isResending ? 'animate-spin' : ''} />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={(e) => {
                e.stopPropagation();
                if (confirm(`Удалить проект "${project.name || 'Без названия'}"?`)) {
                  onDelete();
                }
              }}
              aria-label="Удалить проект"
              className="h-11 w-11 sm:h-9 sm:w-9 p-0"
            >
              <Icon name="Trash2" size={18} />
            </Button>
          </div>
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="space-y-3 max-h-[45vh] sm:max-h-[60vh] overflow-y-auto">
          {project.description && (
            <p className="text-sm text-muted-foreground">{project.description}</p>
          )}
          <div className="space-y-2">
            <Label className="text-xs">Стиль съёмки</Label>
            <ShootingStyleSelector
              key={`existing-project-${project.id}-${selectorKey}`}
              value={draft.shootingStyleId}
              onChange={(styleId) => updateDraft({ shootingStyleId: styleId })}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">⏰ Время съёмки <span className="text-muted-foreground font-normal">({getUserTimezoneShort()})</span></Label>
              <Input
                type="time"
                value={draft.shooting_time || ''}
                onChange={(e) => updateDraft({ shooting_time: e.target.value })}
                className="text-xs sm:text-sm h-10 sm:h-9"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">⏱️ Длительность (минуты)</Label>
              <DurationSelect
                value={draft.shooting_duration || 120}
                onChange={handleDurationChange}
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">💰 Стоимость часа (₽)</Label>
              <Input
                type="number"
                min="0"
                step="100"
                value={draft.hourly_rate ?? ''}
                onChange={(e) => handleRateChange(e.target.value)}
                className="text-xs sm:text-sm h-10 sm:h-9"
              />
            </div>
          </div>
          {draft.hourly_rate ? (
            <p className="text-[11px] text-muted-foreground -mt-1 flex items-center gap-1">
              <Icon name="Info" size={12} className="text-primary shrink-0" />
              Бюджет пересчитывается автоматически: {((draft.shooting_duration || 0) / 60).toFixed(1)} ч × {draft.hourly_rate} ₽
            </p>
          ) : null}
          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1">
              <Icon name="Building2" size={13} className="text-muted-foreground" />
              Стоимость студии/час (₽)
            </Label>
            <Input
              type="number"
              min="0"
              step="100"
              value={draft.studio_hourly_rate ?? ''}
              onChange={(e) => handleStudioRateChange(e.target.value)}
              placeholder="0"
              className="text-xs sm:text-sm h-10 sm:h-9"
            />
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Icon name="Info" size={12} className="text-primary shrink-0" />
              Входит в бюджет клиента, но не в доход фотографа
              {draft.studio_hourly_rate ? ` · ${((draft.shooting_duration || 0) / 60).toFixed(1)} ч × ${draft.studio_hourly_rate} ₽` : ''}
            </p>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">📍 Адрес съёмки</Label>
            <Input
              value={draft.shooting_address || ''}
              onChange={(e) => updateDraft({ shooting_address: e.target.value })}
              placeholder="Москва, Красная площадь, 1"
              className="text-xs sm:text-sm h-10 sm:h-9"
            />
          </div>

          <div className="rounded-lg border border-border/60 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Icon name="BookOpen" size={14} />
              Фотокнига
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Кол-во книг</Label>
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={draft.photobook_count ?? ''}
                  onChange={(e) => applyAndRecalc({ photobook_count: e.target.value === '' ? undefined : parseInt(e.target.value, 10) || 0 })}
                  placeholder="0"
                  className="text-xs h-10 sm:h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Цена за книгу (₽)</Label>
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={draft.photobook_price ?? ''}
                  onChange={(e) => applyAndRecalc({ photobook_price: e.target.value === '' ? undefined : parseFloat(e.target.value.replace(',', '.')) || 0 })}
                  placeholder="3000"
                  className="text-xs h-10 sm:h-9"
                />
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-border/60 p-3 space-y-2">
            <div className="flex items-center gap-2 text-xs font-medium">
              <Icon name="Image" size={14} />
              Печать фото
            </div>
            {(draft.photo_items || []).length > 0 && (
              <div className="hidden md:grid grid-cols-[1fr_70px_90px_32px] gap-2 px-1">
                <span className="text-[11px] text-muted-foreground">Формат</span>
                <span className="text-[11px] text-muted-foreground">Кол-во</span>
                <span className="text-[11px] text-muted-foreground">Цена/шт</span>
                <span />
              </div>
            )}
            {(draft.photo_items || []).map((item, idx) => (
              <div
                key={idx}
                className="grid grid-cols-[1fr_60px_36px] md:grid-cols-[1fr_70px_90px_32px] gap-2 items-center"
              >
                <Input
                  list="photo-format-presets-edit"
                  value={item.format}
                  onChange={(e) => updatePhotoItem(idx, { format: e.target.value })}
                  placeholder="20×30 (A4)"
                  className="text-xs h-10 sm:h-9"
                />
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={item.qty}
                  onChange={(e) => updatePhotoItem(idx, { qty: parseInt(e.target.value, 10) || 0 })}
                  placeholder="шт"
                  className="text-xs h-10 sm:h-9 px-2"
                />
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={item.price}
                  onChange={(e) => updatePhotoItem(idx, { price: parseFloat(e.target.value.replace(',', '.')) || 0 })}
                  placeholder="₽"
                  className="text-xs h-10 sm:h-9 px-2 hidden md:block"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removePhotoItem(idx)}
                  className="h-10 w-10 sm:h-9 sm:w-9 text-destructive hover:text-destructive shrink-0"
                >
                  <Icon name="Trash2" size={15} />
                </Button>
                <Input
                  type="number"
                  min="0"
                  inputMode="numeric"
                  value={item.price}
                  onChange={(e) => updatePhotoItem(idx, { price: parseFloat(e.target.value.replace(',', '.')) || 0 })}
                  placeholder="Цена за шт (₽)"
                  className="text-xs h-10 px-2 col-span-3 md:hidden"
                />
              </div>
            ))}
            <datalist id="photo-format-presets-edit">
              {PHOTO_FORMAT_PRESETS.map((f) => (
                <option key={f} value={f} />
              ))}
            </datalist>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addPhotoItem}
              className="w-full h-10 sm:h-9 border-dashed text-xs"
            >
              <Icon name="Plus" size={14} className="mr-1" />
              Добавить формат фото
            </Button>
          </div>

          <div className="flex gap-2">
            <Select
              value={draft.status}
              onValueChange={(value) => updateDraft({ status: value as Project['status'] })}
            >
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new" className="text-green-600 dark:text-green-400 font-medium focus:text-green-700 dark:focus:text-green-300 focus:bg-green-50 dark:focus:bg-green-950/30">Новый</SelectItem>
                <SelectItem value="in_progress" className="text-orange-600 dark:text-orange-400 font-medium focus:text-orange-700 dark:focus:text-orange-300 focus:bg-orange-50 dark:focus:bg-orange-950/30">В работе</SelectItem>
                <SelectItem value="completed" className="text-red-600 dark:text-red-400 font-medium focus:text-red-700 dark:focus:text-red-300 focus:bg-red-50 dark:focus:bg-red-950/30">Завершён</SelectItem>
                <SelectItem value="cancelled" className="text-muted-foreground font-medium focus:text-foreground focus:bg-muted">Отменён</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {isCancelled && (
            <div className="rounded-lg border border-red-200 dark:border-red-900/50 bg-red-50/60 dark:bg-red-950/30 p-3 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
              <Label className="text-xs font-medium text-red-700 dark:text-red-300 flex items-center gap-1.5">
                <Icon name="MessageSquareWarning" size={14} />
                Причина отмены съёмки <span className="text-red-500">*</span>
              </Label>
              <textarea
                ref={reasonInputRef}
                value={draft.cancel_reason || ''}
                onChange={(e) => updateDraft({ cancel_reason: e.target.value })}
                placeholder="Например: клиент перенёс на неопределённый срок, форс-мажор по погоде…"
                rows={2}
                className={`w-full text-xs sm:text-sm rounded-md border bg-background text-foreground p-2 resize-y focus:outline-none focus:ring-1 focus:ring-primary ${
                  cancelReasonMissing ? 'border-red-500 ring-1 ring-red-500' : 'border-border'
                }`}
              />
              {cancelReasonMissing && (
                <p className="text-[11px] text-red-600 dark:text-red-400">Укажите причину — без неё нельзя сохранить отмену.</p>
              )}
              <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 leading-snug">
                <Icon name="PiggyBank" size={13} className="text-primary shrink-0 mt-0.5" />
                <span>
                  Оплаченная предоплата по проекту (<b className="text-foreground">{projectPaid.toLocaleString('ru-RU')} ₽</b>) перейдёт в <b className="text-foreground">резерв клиента</b> и сохранится на будущие съёмки.
                </span>
              </p>
            </div>
          )}

          {isDirty && (
            <div className="sticky bottom-0 -mx-3 sm:-mx-6 px-3 sm:px-6 py-2 bg-background/95 backdrop-blur border-t flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <span className="text-[11px] sm:text-xs text-muted-foreground flex items-start gap-1.5 leading-snug">
                <Icon name="Info" size={14} className="text-primary shrink-0 mt-0.5" />
                <span>
                  При нажатии на кнопку «Сохранить изменения» сообщение клиенту <b className="text-foreground">не будет отправлено</b> об изменениях в проекте.
                </span>
              </span>
              <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                <Button variant="outline" size="sm" onClick={handleReset} disabled={isSaving}>
                  Отменить
                </Button>
                <Button size="sm" onClick={() => handleSave(false)} disabled={isSaving || cancelReasonMissing}>
                  {isSaving ? (
                    <>
                      <Icon name="Loader2" size={14} className="mr-1.5 animate-spin" />
                      Сохраняю...
                    </>
                  ) : (
                    <>
                      <Icon name="Save" size={14} className="mr-1.5" />
                      Сохранить изменения
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
};

export default ProjectCard;