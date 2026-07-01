import { CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Icon from '@/components/ui/icon';
import { Project } from '@/components/clients/ClientsTypes';
import { getShootingStyles } from '@/data/shootingStyles';
import { DraftFields } from './projectCardUtils';

interface ProjectCardHeaderProps {
  project: Project;
  isExpanded: boolean;
  animateKey: number;
  projectPaid: number;
  statusBadge: JSX.Element;
  onToggleExpand: () => void;
  onDelete: () => void;
  onResendNotifications?: (projectId: number) => void | Promise<void>;
  draft: DraftFields;
  isDirty: boolean;
  isSaving: boolean;
  isResending: boolean;
  setIsResending: (v: boolean) => void;
  cancelReasonMissing: boolean;
  isEditingBudget: boolean;
  setIsEditingBudget: (v: boolean) => void;
  budgetValue: string;
  setBudgetValue: (v: string) => void;
  budgetInputRef: React.RefObject<HTMLInputElement>;
  handleBudgetSave: () => void;
  updateDraft: (patch: Partial<DraftFields>) => void;
  handleSave: (notifyClient?: boolean) => void | Promise<void>;
  handleReset: () => void;
  recomputedRemaining: number;
}

const ProjectCardHeader = ({
  project,
  isExpanded,
  animateKey,
  projectPaid,
  statusBadge,
  onToggleExpand,
  onDelete,
  onResendNotifications,
  draft,
  isDirty,
  isSaving,
  isResending,
  setIsResending,
  cancelReasonMissing,
  isEditingBudget,
  setIsEditingBudget,
  budgetValue,
  setBudgetValue,
  budgetInputRef,
  handleBudgetSave,
  updateDraft,
  handleSave,
  handleReset,
  recomputedRemaining,
}: ProjectCardHeaderProps) => {
  return (
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
  );
};

export default ProjectCardHeader;
