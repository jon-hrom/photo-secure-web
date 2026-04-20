import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { Project } from '@/components/clients/ClientsTypes';
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
  onSaveChanges: (updates: Partial<Project>) => void | Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
}

type DraftFields = {
  budget: number;
  startDate: string;
  shootingStyleId?: string;
  shooting_time?: string;
  shooting_duration?: number;
  shooting_address?: string;
  status: Project['status'];
};

const toDateInputValue = (value?: string) => {
  if (!value) return '';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
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
  status: project.status,
});

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
}: ProjectCardProps) => {
  const [draft, setDraft] = useState<DraftFields>(() => buildDraftFromProject(project));
  const [isEditingBudget, setIsEditingBudget] = useState(false);
  const [budgetValue, setBudgetValue] = useState(String(project.budget));
  const budgetInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  const originalDraft = useMemo(() => buildDraftFromProject(project), [project]);

  useEffect(() => {
    setDraft(buildDraftFromProject(project));
    setBudgetValue(String(project.budget));
  }, [
    project.id,
    project.budget,
    project.startDate,
    project.shootingStyleId,
    project.shooting_time,
    project.shooting_duration,
    project.shooting_address,
    project.status,
  ]);

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
      draft.status !== originalDraft.status
    );
  }, [draft, originalDraft]);

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  const updateDraft = (patch: Partial<DraftFields>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
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

  const handleSave = async () => {
    if (!isDirty || isSaving) return;
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
    if (draft.status !== originalDraft.status) updates.status = draft.status;

    setIsSaving(true);
    try {
      await onSaveChanges(updates);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
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
                disabled={!isDirty || isSaving}
                onClick={(e) => {
                  e.stopPropagation();
                  handleSave();
                }}
                title="Сохранить и отправить изменения клиенту"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
                onChange={(value) => updateDraft({ shooting_duration: value })}
              />
            </div>
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
                <Button size="sm" onClick={handleSave} disabled={isSaving}>
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