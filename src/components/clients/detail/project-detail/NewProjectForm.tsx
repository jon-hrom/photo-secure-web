import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { ShootingStyleSelector } from '@/components/clients/dialog/ShootingStyleSelector';
import { getUserTimezoneShort } from '@/utils/regionTimezone';
import DurationSelect from './DurationSelect';

interface PhotoItemDraft {
  format: string;
  qty: string;
  price: string;
}

interface NewProjectData {
  name: string;
  budget: string;
  description: string;
  startDate: string;
  shootingStyleId?: string;
  shooting_time?: string;
  shooting_duration?: number;
  shooting_address?: string;
  add_to_calendar?: boolean;
  hourly_rate?: string;
  studio_hourly_rate?: string;
  photobook_count?: string;
  photobook_price?: string;
  photo_items?: PhotoItemDraft[];
}

const PHOTO_FORMAT_PRESETS = ['20×30 (A4)', '15×20', '10×15', '21×30 (A4)', '30×40', '13×18'];

const num = (v?: string) => {
  const n = parseFloat((v ?? '').toString().replace(',', '.'));
  return isNaN(n) ? 0 : n;
};

export interface NewMeetingDraft {
  name: string;
  meeting_date: string;
  meeting_time: string;
  duration: number;
  address: string;
  description: string;
  custom_reminder_at: string;
}

interface NewProjectFormProps {
  isOpen: boolean;
  onToggle: () => void;
  newProject: NewProjectData;
  setNewProject: (project: NewProjectData) => void;
  handleAddProject: () => Promise<void> | void;
  newMeeting?: NewMeetingDraft;
  setNewMeeting?: (m: NewMeetingDraft) => void;
  handleAddMeeting?: () => Promise<void> | void;
}

const NewProjectForm = ({
  isOpen,
  onToggle,
  newProject,
  setNewProject,
  handleAddProject,
  newMeeting,
  setNewMeeting,
  handleAddMeeting,
}: NewProjectFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<'shooting' | 'meeting'>('shooting');
  const meetingEnabled = !!(newMeeting && setNewMeeting && handleAddMeeting);

  const photoItems = newProject.photo_items ?? [];

  // Полный пересчёт бюджета: съёмка + фотокниги + все строки фото
  const calcTotalBudget = (p: NewProjectData): number => {
    const durationMin = p.shooting_duration || 120;
    const rate = num(p.hourly_rate);
    const shooting = rate > 0 ? (durationMin / 60) * rate : 0;
    const studioRate = num(p.studio_hourly_rate);
    const studio = studioRate > 0 ? (durationMin / 60) * studioRate : 0;
    const books = num(p.photobook_count) * num(p.photobook_price);
    const photos = (p.photo_items ?? []).reduce(
      (sum, it) => sum + num(it.qty) * num(it.price),
      0
    );
    return Math.round(shooting + studio + books + photos);
  };

  // Обновляем поля и автоматически пересчитываем бюджет
  const update = (patch: Partial<NewProjectData>) => {
    const next = { ...newProject, ...patch };
    setNewProject({ ...next, budget: String(calcTotalBudget(next)) });
  };

  const handleRateChange = (rate: string) => update({ hourly_rate: rate });
  const handleStudioRateChange = (rate: string) => update({ studio_hourly_rate: rate });
  const handleDurationChange = (durationMin: number) => update({ shooting_duration: durationMin });

  const updatePhotoItem = (index: number, patch: Partial<PhotoItemDraft>) => {
    const items = photoItems.map((it, i) => (i === index ? { ...it, ...patch } : it));
    update({ photo_items: items });
  };

  const addPhotoItem = () => {
    update({ photo_items: [...photoItems, { format: '', qty: '1', price: '' }] });
  };

  const removePhotoItem = (index: number) => {
    update({ photo_items: photoItems.filter((_, i) => i !== index) });
  };

  const booksTotal = num(newProject.photobook_count) * num(newProject.photobook_price);
  const photosTotal = photoItems.reduce((s, it) => s + num(it.qty) * num(it.price), 0);

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (mode === 'meeting' && handleAddMeeting) {
        await handleAddMeeting();
      } else {
        await handleAddProject();
      }
      onToggle();
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateMeeting = (patch: Partial<NewMeetingDraft>) => {
    if (newMeeting && setNewMeeting) setNewMeeting({ ...newMeeting, ...patch });
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        className="w-full h-12 border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all"
        onClick={onToggle}
      >
        <Icon name="Plus" size={18} className="mr-2" />
        Добавить новую услугу
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3 cursor-pointer hover:bg-accent/50 transition-colors" onClick={onToggle}>
        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
          <Icon name="ChevronDown" size={18} />
          Добавить новую услугу
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 py-3 pb-20 max-h-[60vh] md:max-h-none overflow-y-auto md:overflow-visible">
        {meetingEnabled && (
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg mb-1">
            <button
              type="button"
              onClick={() => setMode('shooting')}
              className={`flex items-center justify-center gap-1.5 h-9 rounded-md text-xs font-medium transition-all ${
                mode === 'shooting'
                  ? 'bg-sky-500 text-white shadow'
                  : 'text-muted-foreground hover:bg-background'
              }`}
            >
              <Icon name="Camera" size={15} />
              Съёмка
            </button>
            <button
              type="button"
              onClick={() => setMode('meeting')}
              className={`flex items-center justify-center gap-1.5 h-9 rounded-md text-xs font-medium transition-all ${
                mode === 'meeting'
                  ? 'bg-violet-500 text-white shadow'
                  : 'text-muted-foreground hover:bg-background'
              }`}
            >
              <Icon name="Handshake" size={15} />
              Встреча
            </button>
          </div>
        )}

        {mode === 'meeting' && newMeeting ? (
          <div className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <div className="space-y-1 md:col-span-3">
                <Label className="text-xs">Название встречи</Label>
                <Input
                  value={newMeeting.name}
                  onChange={(e) => updateMeeting({ name: e.target.value })}
                  placeholder="Обсуждение съёмки"
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Дата встречи *</Label>
                <Input
                  type="date"
                  min="2020-01-01"
                  max="2099-12-31"
                  value={newMeeting.meeting_date}
                  onChange={(e) => updateMeeting({ meeting_date: e.target.value })}
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Время <span className="text-muted-foreground font-normal">({getUserTimezoneShort()})</span></Label>
                <Input
                  type="time"
                  value={newMeeting.meeting_time}
                  onChange={(e) => updateMeeting({ meeting_time: e.target.value })}
                  className="text-xs h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Длительность (минуты)</Label>
                <DurationSelect
                  value={newMeeting.duration || 60}
                  onChange={(d) => updateMeeting({ duration: d })}
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Адрес встречи</Label>
              <Input
                type="text"
                value={newMeeting.address}
                onChange={(e) => updateMeeting({ address: e.target.value })}
                placeholder="Кафе на Тверской, Москва"
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Описание</Label>
              <Textarea
                value={newMeeting.description}
                onChange={(e) => updateMeeting({ description: e.target.value })}
                placeholder="О чём встреча..."
                rows={2}
                className="text-xs"
              />
            </div>
            <div className="rounded-lg border border-border/60 p-3 space-y-1">
              <Label className="text-xs flex items-center gap-1.5">
                <Icon name="BellRing" size={13} className="text-violet-500" />
                Доп. напоминание фотографу
              </Label>
              <Input
                type="datetime-local"
                value={newMeeting.custom_reminder_at}
                onChange={(e) => updateMeeting({ custom_reminder_at: e.target.value })}
                className="text-xs h-9"
              />
              <p className="text-[10px] text-muted-foreground">
                Кроме стандартных (за сутки и за 5 часов) — придёт вам в указанное время
              </p>
            </div>
          </div>
        ) : mode === 'shooting' ? (
        <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Название проекта *</Label>
            <Input
              value={newProject.name}
              onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
              placeholder="Свадебная фотосессия"
              className="text-xs h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Бюджет (₽) *</Label>
            <Input
              type="number"
              value={newProject.budget}
              onChange={(e) => setNewProject({ ...newProject, budget: e.target.value })}
              placeholder="50000"
              className="text-xs h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Дата съёмки</Label>
            <Input
              type="date"
              min="2020-01-01"
              max="2099-12-31"
              value={newProject.startDate}
              onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
              className="text-xs h-9"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs">Время съёмки <span className="text-muted-foreground font-normal">({getUserTimezoneShort()})</span></Label>
            <Input
              type="time"
              value={newProject.shooting_time || ''}
              onChange={(e) => setNewProject({ ...newProject, shooting_time: e.target.value })}
              className="text-xs h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Длительность (минуты)</Label>
            <DurationSelect
              value={newProject.shooting_duration || 120}
              onChange={handleDurationChange}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Стоимость часа (₽)</Label>
            <Input
              type="number"
              value={newProject.hourly_rate || ''}
              onChange={(e) => handleRateChange(e.target.value)}
              placeholder="3000"
              className="text-xs h-9"
            />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-xs flex items-center gap-1">
              <Icon name="Building2" size={12} className="text-muted-foreground" />
              Стоимость студии/час (₽)
            </Label>
            <Input
              type="number"
              value={newProject.studio_hourly_rate || ''}
              onChange={(e) => handleStudioRateChange(e.target.value)}
              placeholder="1000"
              className="text-xs h-9"
            />
            <p className="text-[10px] text-muted-foreground">Входит в бюджет, но не в доход фотографа</p>
          </div>
          <div className="space-y-1 md:col-span-2">
            <Label className="text-xs">Адрес съёмки</Label>
            <Input
              type="text"
              value={newProject.shooting_address || ''}
              onChange={(e) => setNewProject({ ...newProject, shooting_address: e.target.value })}
              placeholder="Парк Горького, Москва"
              className="text-xs h-9"
            />
          </div>
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
                value={newProject.photobook_count || ''}
                onChange={(e) => update({ photobook_count: e.target.value })}
                placeholder="0"
                className="text-xs h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Цена за книгу (₽)</Label>
              <Input
                type="number"
                min="0"
                inputMode="numeric"
                value={newProject.photobook_price || ''}
                onChange={(e) => update({ photobook_price: e.target.value })}
                placeholder="3000"
                className="text-xs h-9"
              />
            </div>
          </div>
          {booksTotal > 0 && (
            <div className="text-xs text-muted-foreground text-right">
              Фотокниги: {booksTotal.toLocaleString('ru-RU')} ₽
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border/60 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Icon name="Image" size={14} />
            Печать фото
          </div>
          {photoItems.length > 0 && (
            <div className="hidden md:grid grid-cols-[1fr_70px_90px_32px] gap-2 px-1">
              <span className="text-[11px] text-muted-foreground">Формат</span>
              <span className="text-[11px] text-muted-foreground">Кол-во</span>
              <span className="text-[11px] text-muted-foreground">Цена/шт</span>
              <span />
            </div>
          )}
          {photoItems.map((item, idx) => (
            <div
              key={idx}
              className="grid grid-cols-[1fr_60px_36px] md:grid-cols-[1fr_70px_90px_32px] gap-2 items-center"
            >
              <Input
                list="photo-format-presets"
                value={item.format}
                onChange={(e) => updatePhotoItem(idx, { format: e.target.value })}
                placeholder="20×30 (A4)"
                className="text-xs h-9"
              />
              <Input
                type="number"
                min="0"
                inputMode="numeric"
                value={item.qty}
                onChange={(e) => updatePhotoItem(idx, { qty: e.target.value })}
                placeholder="шт"
                className="text-xs h-9 px-2"
              />
              <Input
                type="number"
                min="0"
                inputMode="numeric"
                value={item.price}
                onChange={(e) => updatePhotoItem(idx, { price: e.target.value })}
                placeholder="₽"
                className="text-xs h-9 px-2 hidden md:block"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removePhotoItem(idx)}
                className="h-9 w-9 text-destructive hover:text-destructive shrink-0"
              >
                <Icon name="Trash2" size={15} />
              </Button>
              <Input
                type="number"
                min="0"
                inputMode="numeric"
                value={item.price}
                onChange={(e) => updatePhotoItem(idx, { price: e.target.value })}
                placeholder="Цена за шт (₽)"
                className="text-xs h-9 px-2 col-span-3 md:hidden"
              />
            </div>
          ))}
          <datalist id="photo-format-presets">
            {PHOTO_FORMAT_PRESETS.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addPhotoItem}
            className="w-full h-9 border-dashed text-xs"
          >
            <Icon name="Plus" size={14} className="mr-1" />
            Добавить формат фото
          </Button>
          {photosTotal > 0 && (
            <div className="text-xs text-muted-foreground text-right">
              Печать фото: {photosTotal.toLocaleString('ru-RU')} ₽
            </div>
          )}
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Стиль съёмки</Label>
          <ShootingStyleSelector
            key="new-project-style"
            value={newProject.shootingStyleId}
            onChange={(styleId) => setNewProject({ ...newProject, shootingStyleId: styleId })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Описание</Label>
          <Textarea
            value={newProject.description}
            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
            placeholder="Детали проекта..."
            rows={2}
            className="text-xs"
          />
        </div>
        <div className="flex items-center space-x-2">
          <Checkbox
            id="add_to_calendar"
            checked={newProject.add_to_calendar || false}
            onCheckedChange={(checked) => setNewProject({ ...newProject, add_to_calendar: checked as boolean })}
          />
          <Label
            htmlFor="add_to_calendar"
            className="text-xs cursor-pointer flex items-center gap-2"
          >
            <Icon name="Calendar" size={14} />
            Добавить в Google Calendar
          </Label>
        </div>
        </>
        ) : null}
        <div className="sticky bottom-0 -mx-3 px-3 pt-3 pb-3 bg-background border-t md:border-0 md:static md:mx-0 md:px-0 md:pt-2 md:pb-0 z-10">
          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full md:w-auto h-11 md:h-9 text-sm md:text-xs shadow-lg md:shadow-none">
            <Icon name={isSubmitting ? "Loader2" : "Save"} size={16} className={`mr-2${isSubmitting ? " animate-spin" : ""}`} />
            {isSubmitting
              ? "Сохраняем и отправляем..."
              : mode === 'meeting'
                ? "Сохранить встречу и отправить уведомления"
                : "Сохранить проект и отправить уведомления"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NewProjectForm;