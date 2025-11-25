import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import Icon from '@/components/ui/icon';
import { ViewPreset } from '@/hooks/useViewPresets';
import { toast } from 'sonner';

interface ViewPresetsDropdownProps {
  allPresets: ViewPreset[];
  defaultPresets: ViewPreset[];
  customPresets: ViewPreset[];
  activePresetId: string | null;
  onApplyPreset: (presetId: string) => void;
  onSavePreset: (preset: Omit<ViewPreset, 'id' | 'isDefault'>) => void;
  onDeletePreset: (presetId: string) => void;
  currentState: {
    searchQuery: string;
    statusFilter: 'all' | 'active' | 'inactive';
    sortConfigs: any[];
  };
}

const ViewPresetsDropdown = ({
  allPresets,
  defaultPresets,
  customPresets,
  activePresetId,
  onApplyPreset,
  onSavePreset,
  onDeletePreset,
  currentState,
}: ViewPresetsDropdownProps) => {
  const [isSaveDialogOpen, setIsSaveDialogOpen] = useState(false);
  const [newPresetName, setNewPresetName] = useState('');
  const [newPresetDescription, setNewPresetDescription] = useState('');
  const [newPresetIcon, setNewPresetIcon] = useState('Star');

  const handleSaveCurrentView = () => {
    if (!newPresetName.trim()) {
      toast.error('Введите название пресета');
      return;
    }

    const preset = {
      name: newPresetName,
      icon: newPresetIcon,
      description: newPresetDescription,
      searchQuery: currentState.searchQuery,
      statusFilter: currentState.statusFilter,
      sortConfigs: currentState.sortConfigs,
    };

    onSavePreset(preset);
    setIsSaveDialogOpen(false);
    setNewPresetName('');
    setNewPresetDescription('');
    setNewPresetIcon('Star');
    toast.success('Пресет сохранён');
  };

  const handleDeletePreset = (presetId: string, presetName: string) => {
    if (confirm(`Удалить пресет "${presetName}"?`)) {
      onDeletePreset(presetId);
      toast.success('Пресет удалён');
    }
  };

  const activePreset = allPresets.find(p => p.id === activePresetId);

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant={activePresetId ? 'default' : 'outline'}
            className="gap-2 transition-all hover:scale-105"
          >
            <Icon name={activePreset?.icon || 'Filter'} size={16} />
            {activePreset?.name || 'Представления'}
            <Icon name="ChevronDown" size={14} />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-80">
          <DropdownMenuLabel className="flex items-center justify-between">
            <span>Быстрые представления</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 gap-1 text-xs"
              onClick={() => setIsSaveDialogOpen(true)}
            >
              <Icon name="Plus" size={12} />
              Сохранить
            </Button>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Стандартные
            </DropdownMenuLabel>
            {defaultPresets.map(preset => (
              <DropdownMenuItem
                key={preset.id}
                onClick={() => onApplyPreset(preset.id)}
                className={`cursor-pointer ${
                  activePresetId === preset.id ? 'bg-accent' : ''
                }`}
              >
                <div className="flex items-start gap-3 w-full">
                  <Icon
                    name={preset.icon as any}
                    size={18}
                    className="mt-0.5 flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{preset.name}</span>
                      {activePresetId === preset.id && (
                        <Icon name="Check" size={14} className="text-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {preset.description}
                    </p>
                  </div>
                </div>
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>

          {customPresets.length > 0 && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuGroup>
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  Мои представления
                </DropdownMenuLabel>
                {customPresets.map(preset => (
                  <DropdownMenuItem
                    key={preset.id}
                    className={`cursor-pointer group ${
                      activePresetId === preset.id ? 'bg-accent' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3 w-full">
                      <Icon
                        name={preset.icon as any}
                        size={18}
                        className="mt-0.5 flex-shrink-0"
                      />
                      <div
                        className="flex-1 min-w-0"
                        onClick={() => onApplyPreset(preset.id)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{preset.name}</span>
                          {activePresetId === preset.id && (
                            <Icon name="Check" size={14} className="text-primary" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">
                          {preset.description}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePreset(preset.id, preset.name);
                        }}
                      >
                        <Icon name="Trash2" size={12} />
                      </Button>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuGroup>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={isSaveDialogOpen} onOpenChange={setIsSaveDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Icon name="Save" size={20} />
              Сохранить текущее представление
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="preset-name">Название *</Label>
              <Input
                id="preset-name"
                placeholder="Например: Активные клиенты за месяц"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preset-description">Описание</Label>
              <Textarea
                id="preset-description"
                placeholder="Краткое описание представления..."
                value={newPresetDescription}
                onChange={(e) => setNewPresetDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="preset-icon">Иконка</Label>
              <div className="grid grid-cols-6 gap-2">
                {['Star', 'Heart', 'Zap', 'Flag', 'Target', 'Trophy', 'Award', 'Crown', 'Sparkles', 'Flame', 'ThumbsUp', 'Bookmark'].map(icon => (
                  <Button
                    key={icon}
                    variant={newPresetIcon === icon ? 'default' : 'outline'}
                    size="sm"
                    className="h-10 w-10 p-0"
                    onClick={() => setNewPresetIcon(icon)}
                  >
                    <Icon name={icon as any} size={18} />
                  </Button>
                ))}
              </div>
            </div>
            <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
              <p className="text-muted-foreground">
                <strong>Будет сохранено:</strong>
              </p>
              <ul className="text-xs space-y-1 ml-4">
                {currentState.searchQuery && (
                  <li>• Поиск: "{currentState.searchQuery}"</li>
                )}
                {currentState.statusFilter !== 'all' && (
                  <li>• Фильтр: {currentState.statusFilter === 'active' ? 'Активные' : 'Неактивные'}</li>
                )}
                {currentState.sortConfigs.length > 0 && (
                  <li>• Сортировка: {currentState.sortConfigs.length} {currentState.sortConfigs.length === 1 ? 'поле' : 'полей'}</li>
                )}
              </ul>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSaveDialogOpen(false)}>
              Отмена
            </Button>
            <Button onClick={handleSaveCurrentView}>
              <Icon name="Save" size={16} className="mr-2" />
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ViewPresetsDropdown;
