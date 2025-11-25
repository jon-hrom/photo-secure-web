import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import Icon from '@/components/ui/icon';
import { Client } from '@/components/clients/ClientsTypes';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

interface ExportColumn {
  id: string;
  label: string;
  enabled: boolean;
  getValue: (client: Client) => string | number;
}

interface ExportTemplate {
  id: string;
  name: string;
  columns: string[];
}

interface ClientsExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clients: Client[];
  filteredClients: Client[];
}

const defaultColumns: ExportColumn[] = [
  { id: 'name', label: 'ФИО', enabled: true, getValue: (c) => c.name },
  { id: 'phone', label: 'Телефон', enabled: true, getValue: (c) => c.phone },
  { id: 'email', label: 'Email', enabled: true, getValue: (c) => c.email || '' },
  { id: 'address', label: 'Адрес', enabled: false, getValue: (c) => c.address || '' },
  { id: 'vkProfile', label: 'ВКонтакте', enabled: false, getValue: (c) => c.vkProfile || '' },
  { 
    id: 'activeProjects', 
    label: 'Активные проекты', 
    enabled: true, 
    getValue: (c) => (c.projects || []).filter(p => p.status === 'in_progress' || p.status === 'new').length 
  },
  { 
    id: 'activeBookings', 
    label: 'Активные записи', 
    enabled: true, 
    getValue: (c) => c.bookings.filter(b => new Date(b.date) >= new Date()).length 
  },
  { 
    id: 'totalPaid', 
    label: 'Оплачено (₽)', 
    enabled: false, 
    getValue: (c) => (c.payments || []).filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0)
  },
  { 
    id: 'documentsCount', 
    label: 'Документы', 
    enabled: false, 
    getValue: (c) => (c.documents || []).length 
  },
  { 
    id: 'createdAt', 
    label: 'Дата создания', 
    enabled: false, 
    getValue: (c) => new Date(c.created_at).toLocaleDateString('ru-RU')
  },
];

const defaultTemplates: ExportTemplate[] = [
  { 
    id: 'basic', 
    name: 'Базовая информация', 
    columns: ['name', 'phone', 'email'] 
  },
  { 
    id: 'full', 
    name: 'Полная информация', 
    columns: ['name', 'phone', 'email', 'address', 'vkProfile', 'activeProjects', 'activeBookings', 'totalPaid', 'documentsCount', 'createdAt'] 
  },
  { 
    id: 'contacts', 
    name: 'Только контакты', 
    columns: ['name', 'phone', 'email', 'vkProfile'] 
  },
  { 
    id: 'stats', 
    name: 'Статистика', 
    columns: ['name', 'activeProjects', 'activeBookings', 'totalPaid', 'documentsCount'] 
  },
];

const ClientsExportDialog = ({ open, onOpenChange, clients, filteredClients }: ClientsExportDialogProps) => {
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [dataScope, setDataScope] = useState<'all' | 'filtered'>('filtered');
  const [columns, setColumns] = useState<ExportColumn[]>(defaultColumns);
  const [selectedTemplate, setSelectedTemplate] = useState<string>('basic');
  const [customTemplateName, setCustomTemplateName] = useState('');
  const [savedTemplates, setSavedTemplates] = useState<ExportTemplate[]>(() => {
    const saved = localStorage.getItem('exportTemplates');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    const allTemplates = [...defaultTemplates, ...savedTemplates];
    const template = allTemplates.find(t => t.id === selectedTemplate);
    if (template) {
      setColumns(cols => cols.map(col => ({
        ...col,
        enabled: template.columns.includes(col.id)
      })));
    }
  }, [selectedTemplate, savedTemplates]);

  const handleColumnToggle = (columnId: string, checked: boolean) => {
    setColumns(cols => cols.map(col => 
      col.id === columnId ? { ...col, enabled: checked } : col
    ));
    setSelectedTemplate('custom');
  };

  const handleSaveTemplate = () => {
    if (!customTemplateName.trim()) {
      toast.error('Введите название шаблона');
      return;
    }

    const newTemplate: ExportTemplate = {
      id: `custom-${Date.now()}`,
      name: customTemplateName,
      columns: columns.filter(c => c.enabled).map(c => c.id),
    };

    const updated = [...savedTemplates, newTemplate];
    setSavedTemplates(updated);
    localStorage.setItem('exportTemplates', JSON.stringify(updated));
    setSelectedTemplate(newTemplate.id);
    setCustomTemplateName('');
    toast.success('Шаблон сохранён');
  };

  const handleDeleteTemplate = (templateId: string) => {
    const updated = savedTemplates.filter(t => t.id !== templateId);
    setSavedTemplates(updated);
    localStorage.setItem('exportTemplates', JSON.stringify(updated));
    if (selectedTemplate === templateId) {
      setSelectedTemplate('basic');
    }
    toast.success('Шаблон удалён');
  };

  const handleExport = () => {
    const dataToExport = dataScope === 'all' ? clients : filteredClients;
    const enabledColumns = columns.filter(c => c.enabled);

    if (enabledColumns.length === 0) {
      toast.error('Выберите хотя бы одну колонку');
      return;
    }

    if (dataToExport.length === 0) {
      toast.error('Нет данных для экспорта');
      return;
    }

    const data = dataToExport.map(client => {
      const row: Record<string, string | number> = {};
      enabledColumns.forEach(col => {
        row[col.label] = col.getValue(client);
      });
      return row;
    });

    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
    const filename = `clients_${timestamp}`;

    if (format === 'xlsx') {
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Клиенты');
      
      const colWidths = enabledColumns.map(col => ({
        wch: Math.max(col.label.length, 15)
      }));
      ws['!cols'] = colWidths;
      
      XLSX.writeFile(wb, `${filename}.xlsx`);
      toast.success(`Экспортировано ${dataToExport.length} клиентов в Excel`);
    } else {
      const ws = XLSX.utils.json_to_sheet(data);
      const csv = XLSX.utils.sheet_to_csv(ws);
      const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
      saveAs(blob, `${filename}.csv`);
      toast.success(`Экспортировано ${dataToExport.length} клиентов в CSV`);
    }

    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon name="Download" size={20} />
            Экспорт клиентов
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label className="text-base font-semibold">Формат файла</Label>
              <RadioGroup value={format} onValueChange={(v) => setFormat(v as 'xlsx' | 'csv')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="xlsx" id="xlsx" />
                  <Label htmlFor="xlsx" className="font-normal cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Icon name="FileSpreadsheet" size={16} className="text-green-600" />
                      <span>Excel (XLSX)</span>
                      <span className="text-xs text-muted-foreground">— рекомендуется</span>
                    </div>
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="csv" id="csv" />
                  <Label htmlFor="csv" className="font-normal cursor-pointer">
                    <div className="flex items-center gap-2">
                      <Icon name="FileText" size={16} className="text-blue-600" />
                      <span>CSV (UTF-8)</span>
                      <span className="text-xs text-muted-foreground">— для импорта в другие системы</span>
                    </div>
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-base font-semibold">Данные для экспорта</Label>
              <RadioGroup value={dataScope} onValueChange={(v) => setDataScope(v as 'all' | 'filtered')}>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="filtered" id="filtered" />
                  <Label htmlFor="filtered" className="font-normal cursor-pointer">
                    Текущая выборка ({filteredClients.length} клиентов)
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="all" id="all" />
                  <Label htmlFor="all" className="font-normal cursor-pointer">
                    Все клиенты ({clients.length} клиентов)
                  </Label>
                </div>
              </RadioGroup>
            </div>

            <Separator />

            <div className="space-y-3">
              <Label className="text-base font-semibold">Шаблон экспорта</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Пользовательский</SelectItem>
                  {defaultTemplates.map(template => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                  {savedTemplates.length > 0 && (
                    <>
                      <Separator className="my-2" />
                      {savedTemplates.map(template => (
                        <div key={template.id} className="flex items-center justify-between px-2 py-1.5 hover:bg-accent">
                          <SelectItem value={template.id} className="flex-1">
                            {template.name}
                          </SelectItem>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTemplate(template.id);
                            }}
                          >
                            <Icon name="Trash2" size={14} />
                          </Button>
                        </div>
                      ))}
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Колонки для экспорта</Label>
              <div className="space-y-2 border rounded-lg p-3">
                {columns.map(column => (
                  <div key={column.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={column.id}
                      checked={column.enabled}
                      onCheckedChange={(checked) => handleColumnToggle(column.id, checked as boolean)}
                    />
                    <Label htmlFor={column.id} className="font-normal cursor-pointer flex-1">
                      {column.label}
                    </Label>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Label className="text-base font-semibold">Сохранить как шаблон</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Название шаблона..."
                  value={customTemplateName}
                  onChange={(e) => setCustomTemplateName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveTemplate()}
                />
                <Button variant="outline" onClick={handleSaveTemplate}>
                  <Icon name="Save" size={16} className="mr-2" />
                  Сохранить
                </Button>
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Отмена
          </Button>
          <Button onClick={handleExport} className="gap-2">
            <Icon name="Download" size={16} />
            Экспортировать ({dataScope === 'all' ? clients.length : filteredClients.length})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ClientsExportDialog;
