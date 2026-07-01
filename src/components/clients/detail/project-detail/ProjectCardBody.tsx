import { CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { Project, PhotoItem } from '@/components/clients/ClientsTypes';
import { ShootingStyleSelector } from '@/components/clients/dialog/ShootingStyleSelector';
import { getUserTimezoneShort } from '@/utils/regionTimezone';
import DurationSelect from './DurationSelect';
import { DraftFields, PHOTO_FORMAT_PRESETS } from './projectCardUtils';

interface ProjectCardBodyProps {
  project: Project;
  selectorKey: number;
  projectPaid: number;
  draft: DraftFields;
  isDirty: boolean;
  isSaving: boolean;
  isCancelled: boolean;
  cancelReasonMissing: boolean;
  reasonInputRef: React.RefObject<HTMLTextAreaElement>;
  updateDraft: (patch: Partial<DraftFields>) => void;
  applyAndRecalc: (patch: Partial<DraftFields>) => void;
  handleRateChange: (rateStr: string) => void;
  handleStudioRateChange: (rateStr: string) => void;
  handleDurationChange: (durationMin: number) => void;
  updatePhotoItem: (index: number, patch: Partial<PhotoItem>) => void;
  addPhotoItem: () => void;
  removePhotoItem: (index: number) => void;
  handleSave: (notifyClient?: boolean) => void | Promise<void>;
  handleReset: () => void;
}

const ProjectCardBody = ({
  project,
  selectorKey,
  projectPaid,
  draft,
  isDirty,
  isSaving,
  isCancelled,
  cancelReasonMissing,
  reasonInputRef,
  updateDraft,
  applyAndRecalc,
  handleRateChange,
  handleStudioRateChange,
  handleDurationChange,
  updatePhotoItem,
  addPhotoItem,
  removePhotoItem,
  handleSave,
  handleReset,
}: ProjectCardBodyProps) => {
  return (
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
  );
};

export default ProjectCardBody;
