import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { ShootingStyleSelector } from '@/components/clients/dialog/ShootingStyleSelector';
import { getUserTimezoneShort } from '@/utils/regionTimezone';
import DurationSelect from './DurationSelect';
import { NewProjectData, PhotoItemDraft, PHOTO_FORMAT_PRESETS, num } from './newProjectFormTypes';

interface ShootingFormFieldsProps {
  newProject: NewProjectData;
  setNewProject: (project: NewProjectData) => void;
  update: (patch: Partial<NewProjectData>) => void;
}

const ShootingFormFields = ({ newProject, setNewProject, update }: ShootingFormFieldsProps) => {
  const photoItems = newProject.photo_items ?? [];

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

  return (
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
  );
};

export default ShootingFormFields;
