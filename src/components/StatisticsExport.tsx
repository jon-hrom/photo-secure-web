import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Icon from '@/components/ui/icon';
import { useToast } from '@/hooks/use-toast';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { addRobotoFont } from '@/utils/pdf-font';


interface StatisticsData {
  period: string;
  date_range: {
    start: string | null;
    end: string | null;
  };
  general: {
    clients: {
      total: number;
      new: number;
      growth: number;
    };
    projects: {
      total: number;
      new: number;
      completed: number;
      completion_rate: number;
    };
    bookings: {
      total: number;
      new: number;
    };
  };
  clients: {
    total_clients: number;
    new_clients: number;
    returning_clients: number;
    returning_rate: number;
    one_time_clients: number;
  };
  projects: {
    by_category: Array<{ category: string; count: number; revenue: number }>;
    by_status: Array<{ status: string; count: number }>;
  };
  financial: {
    total_revenue: number;
    prev_revenue: number;
    revenue_growth: number;
    avg_check: number;
    pending: {
      amount: number;
      count: number;
    };
    by_method: Array<{ method: string; count: number; total: number }>;
  };
  charts: {
    projects_timeline: Array<{ period: string; count: number }>;
    revenue_timeline: Array<{ period: string; revenue: number }>;
    clients_timeline: Array<{ period: string; count: number }>;
  };
  tops: {
    top_clients: Array<{
      id: number;
      name: string;
      phone: string;
      total_spent: number;
      projects_count: number;
    }>;
    top_projects: Array<{
      id: number;
      project_name: string;
      client_name: string;
      total_amount: number;
      status: string;
      created_at: string;
    }>;
  };
  alerts: {
    unpaid_orders: {
      count: number;
      amount: number;
    };
    projects_without_date: number;
    overdue_bookings: number;
  };
}

interface StatisticsExportProps {
  data: StatisticsData;
}

const StatisticsExport = ({ data }: StatisticsExportProps) => {
  const { toast } = useToast();

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB',
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'Не указано';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU');
  };

  const getPeriodLabel = (period: string) => {
    const labels: Record<string, string> = {
      today: 'Сегодня',
      week: 'Неделя',
      month: 'Месяц',
      quarter: 'Квартал',
      year: 'Год',
      all: 'Всё время',
      custom: 'Произвольный период',
    };
    return labels[period] || period;
  };

  const transliterateFileName = (text: string): string => {
    const map: Record<string, string> = {
      'Сегодня': 'segodnya',
      'Неделя': 'nedelya',
      'Месяц': 'mesyac',
      'Квартал': 'kvartal',
      'Год': 'god',
      'Всё время': 'vse-vremya',
      'Произвольный период': 'custom',
    };
    return map[text] || text.toLowerCase().replace(/\s+/g, '-');
  };



  const exportToPDF = async () => {
    try {
      const doc = new jsPDF();

      // Добавляем Roboto шрифт с поддержкой русского языка
      await addRobotoFont(doc);

      doc.setFontSize(18);
      doc.text('Статистика фотостудии', 14, 15);

      doc.setFont('Roboto', 'normal');
      doc.setFontSize(10);
      doc.text(`Период: ${getPeriodLabel(data.period)}`, 14, 22);
      doc.text(
        `Дата: ${formatDate(data.date_range.start)} - ${formatDate(data.date_range.end)}`,
        14,
        27
      );

      let yPos = 35;

      doc.setFont('Roboto', 'normal');
      doc.setFontSize(14);
      doc.text('Общая статистика', 14, yPos);
      yPos += 7;

      autoTable(doc, {
        startY: yPos,
        head: [['Показатель', 'Значение']],
        body: [
          ['Всего клиентов', data.general.clients.total.toString()],
          ['Новых клиентов', data.general.clients.new.toString()],
          ['Всего проектов', data.general.projects.total.toString()],
          ['Завершено проектов', data.general.projects.completed.toString()],
          ['Процент завершения', `${data.general.projects.completion_rate.toFixed(1)}%`],
          ['Всего бронирований', data.general.bookings.total.toString()],
        ],
        theme: 'grid',
        headStyles: { fillColor: [139, 92, 246], font: 'Roboto' },
        styles: { font: 'Roboto' },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;

      doc.setFont('Roboto', 'normal');
      doc.setFontSize(14);
      doc.text('Финансовая статистика', 14, yPos);
      yPos += 7;

      autoTable(doc, {
        startY: yPos,
        head: [['Показатель', 'Значение']],
        body: [
          ['Общий доход', formatCurrency(data.financial.total_revenue)],
          ['Средний чек', formatCurrency(data.financial.avg_check)],
          ['Рост дохода', `${data.financial.revenue_growth.toFixed(1)}%`],
          ['Неоплаченные заказы', `${data.financial.pending?.count ?? 0} (${formatCurrency(data.financial.pending?.amount ?? 0)})`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [139, 92, 246], font: 'Roboto' },
        styles: { font: 'Roboto' },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;

      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFont('Roboto', 'normal');
      doc.setFontSize(14);
      doc.text('Клиенты', 14, yPos);
      yPos += 7;

      autoTable(doc, {
        startY: yPos,
        head: [['Показатель', 'Значение']],
        body: [
          ['Всего клиентов', data.clients.total_clients.toString()],
          ['Новые клиенты', data.clients.new_clients.toString()],
          ['Постоянные клиенты', data.clients.returning_clients.toString()],
          ['Разовые клиенты', data.clients.one_time_clients.toString()],
          ['Процент возвращаемости', `${data.clients.returning_rate.toFixed(1)}%`],
        ],
        theme: 'grid',
        headStyles: { fillColor: [139, 92, 246], font: 'Roboto' },
        styles: { font: 'Roboto' },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;

      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFont('Roboto', 'normal');
      doc.setFontSize(14);
      doc.text('ТОП-5 клиентов', 14, yPos);
      yPos += 7;

      autoTable(doc, {
        startY: yPos,
        head: [['Имя', 'Телефон', 'Потрачено', 'Проектов']],
        body: data.tops.top_clients.map((client) => [
          client.name,
          client.phone,
          formatCurrency(client.total_spent),
          client.projects_count.toString(),
        ]),
        theme: 'grid',
        headStyles: { fillColor: [139, 92, 246], font: 'Roboto' },
        styles: { font: 'Roboto' },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;

      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFont('Roboto', 'normal');
      doc.setFontSize(14);
      doc.text('ТОП-5 проектов', 14, yPos);
      yPos += 7;

      autoTable(doc, {
        startY: yPos,
        head: [['Проект', 'Клиент', 'Сумма', 'Статус']],
        body: data.tops.top_projects.map((project) => [
          project.project_name,
          project.client_name,
          formatCurrency(project.total_amount),
          project.status,
        ]),
        theme: 'grid',
        headStyles: { fillColor: [139, 92, 246], font: 'Roboto' },
        styles: { font: 'Roboto' },
      });

      const fileName = `statistika_${transliterateFileName(getPeriodLabel(data.period))}_${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.pdf`;
      doc.save(fileName);

      toast({
        title: 'Экспорт завершен',
        description: 'Статистика экспортирована в PDF',
      });
    } catch (error) {
      console.error('Export to PDF error:', error);
      toast({
        title: 'Ошибка экспорта',
        description: 'Не удалось экспортировать в PDF',
        variant: 'destructive',
      });
    }
  };

  const exportToExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      const generalData = [
        ['Статистика фотостудии'],
        ['Период:', getPeriodLabel(data.period)],
        ['Дата:', `${formatDate(data.date_range.start)} - ${formatDate(data.date_range.end)}`],
        [],
        ['Общая статистика'],
        ['Показатель', 'Значение'],
        ['Всего клиентов', data.general.clients.total],
        ['Новых клиентов', data.general.clients.new],
        ['Всего проектов', data.general.projects.total],
        ['Завершено проектов', data.general.projects.completed],
        ['Процент завершения', `${data.general.projects.completion_rate.toFixed(1)}%`],
        ['Всего бронирований', data.general.bookings.total],
        [],
        ['Финансы'],
        ['Показатель', 'Значение'],
        ['Общий доход', data.financial.total_revenue],
        ['Средний чек', data.financial.avg_check],
        ['Рост дохода', `${data.financial.revenue_growth.toFixed(1)}%`],
        ['Неоплаченных заказов', data.financial.pending?.count ?? 0],
        ['Сумма неоплаченных', data.financial.pending?.amount ?? 0],
      ];

      const ws1 = XLSX.utils.aoa_to_sheet(generalData);
      XLSX.utils.book_append_sheet(wb, ws1, 'Общая статистика');

      const clientsData = [
        ['Клиенты'],
        ['Показатель', 'Значение'],
        ['Всего клиентов', data.clients.total_clients],
        ['Новые клиенты', data.clients.new_clients],
        ['Постоянные клиенты', data.clients.returning_clients],
        ['Разовые клиенты', data.clients.one_time_clients],
        ['Процент возвращаемости', `${data.clients.returning_rate.toFixed(1)}%`],
      ];

      const ws2 = XLSX.utils.aoa_to_sheet(clientsData);
      XLSX.utils.book_append_sheet(wb, ws2, 'Клиенты');

      const projectsData = [
        ['Проекты по категориям'],
        ['Категория', 'Количество', 'Доход'],
        ...data.projects.by_category.map((cat) => [cat.category, cat.count, cat.revenue]),
        [],
        ['Проекты по статусам'],
        ['Статус', 'Количество'],
        ...data.projects.by_status.map((st) => [st.status, st.count]),
      ];

      const ws3 = XLSX.utils.aoa_to_sheet(projectsData);
      XLSX.utils.book_append_sheet(wb, ws3, 'Проекты');

      const topClientsData = [
        ['ТОП-5 клиентов'],
        ['Имя', 'Телефон', 'Потрачено', 'Проектов'],
        ...data.tops.top_clients.map((client) => [
          client.name,
          client.phone,
          client.total_spent,
          client.projects_count,
        ]),
      ];

      const ws4 = XLSX.utils.aoa_to_sheet(topClientsData);
      XLSX.utils.book_append_sheet(wb, ws4, 'ТОП клиенты');

      const topProjectsData = [
        ['ТОП-5 проектов'],
        ['Проект', 'Клиент', 'Сумма', 'Статус'],
        ...data.tops.top_projects.map((project) => [
          project.project_name,
          project.client_name,
          project.total_amount,
          project.status,
        ]),
      ];

      const ws5 = XLSX.utils.aoa_to_sheet(topProjectsData);
      XLSX.utils.book_append_sheet(wb, ws5, 'ТОП проекты');

      const fileName = `statistika_${transliterateFileName(getPeriodLabel(data.period))}_${new Date().toLocaleDateString('ru-RU').replace(/\./g, '-')}.xlsx`;
      XLSX.writeFile(wb, fileName);

      toast({
        title: 'Экспорт завершен',
        description: 'Статистика экспортирована в Excel',
      });
    } catch (error) {
      console.error('Export to Excel error:', error);
      toast({
        title: 'Ошибка экспорта',
        description: 'Не удалось экспортировать в Excel',
        variant: 'destructive',
      });
    }
  };

  const handlePrint = () => {
    window.print();
    toast({
      title: 'Печать',
      description: 'Открыто окно печати',
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Icon name="Download" size={16} />
          Экспорт
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={exportToPDF} className="gap-2">
          <Icon name="FileText" size={16} />
          Экспорт в PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={exportToExcel} className="gap-2">
          <Icon name="Table" size={16} />
          Экспорт в Excel
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handlePrint} className="gap-2">
          <Icon name="Printer" size={16} />
          Печать
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default StatisticsExport;