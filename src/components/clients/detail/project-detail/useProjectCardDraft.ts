import { useState, useRef, useEffect, useMemo } from 'react';
import { Project, PhotoItem } from '@/components/clients/ClientsTypes';
import { DraftFields, buildDraftFromProject, calcFullBudget } from './projectCardUtils';

interface UseProjectCardDraftParams {
  project: Project;
  projectPaid: number;
  onSaveChanges: (updates: Partial<Project>, notifyClient?: boolean) => void | Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
}

export const useProjectCardDraft = ({
  project,
  projectPaid,
  onSaveChanges,
  onDirtyChange,
}: UseProjectCardDraftParams) => {
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

  return {
    isResending,
    setIsResending,
    draft,
    isEditingBudget,
    setIsEditingBudget,
    budgetValue,
    setBudgetValue,
    budgetInputRef,
    reasonInputRef,
    isSaving,
    isDirty,
    isCancelled,
    cancelReasonMissing,
    updateDraft,
    applyAndRecalc,
    handleRateChange,
    handleStudioRateChange,
    handleDurationChange,
    updatePhotoItem,
    addPhotoItem,
    removePhotoItem,
    handleBudgetSave,
    handleSave,
    handleReset,
    recomputedRemaining,
  };
};
