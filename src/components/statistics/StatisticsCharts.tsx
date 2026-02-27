import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatisticsData } from './statisticsShared';
import OverviewTab from './OverviewTab';
import { ClientsTab, ProjectsTab } from './ClientsProjectsTabs';
import FinancialTab from './FinancialTab';
import TopsTab from './TopsTab';

interface StatisticsChartsProps {
  data: StatisticsData;
  formatCurrency: (value: number) => string;
  formatDate: (dateStr: string) => string;
}

const StatisticsCharts = ({ data, formatCurrency, formatDate }: StatisticsChartsProps) => {
  return (
    <Tabs defaultValue="overview" className="space-y-6">
      <TabsList className="grid w-full grid-cols-3 sm:grid-cols-5 h-auto">
        <TabsTrigger value="overview" className="text-xs sm:text-sm py-2">Обзор</TabsTrigger>
        <TabsTrigger value="clients" className="text-xs sm:text-sm py-2">Клиенты</TabsTrigger>
        <TabsTrigger value="projects" className="text-xs sm:text-sm py-2">Проекты</TabsTrigger>
        <TabsTrigger value="financial" className="text-xs sm:text-sm py-2">Финансы</TabsTrigger>
        <TabsTrigger value="tops" className="text-xs sm:text-sm py-2">Топы</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <OverviewTab data={data} formatCurrency={formatCurrency} formatDate={formatDate} />
      </TabsContent>

      <TabsContent value="clients">
        <ClientsTab data={data} formatCurrency={formatCurrency} formatDate={formatDate} />
      </TabsContent>

      <TabsContent value="projects">
        <ProjectsTab data={data} formatCurrency={formatCurrency} formatDate={formatDate} />
      </TabsContent>

      <TabsContent value="financial">
        <FinancialTab data={data} formatCurrency={formatCurrency} formatDate={formatDate} />
      </TabsContent>

      <TabsContent value="tops">
        <TopsTab data={data} formatCurrency={formatCurrency} formatDate={formatDate} />
      </TabsContent>
    </Tabs>
  );
};

export default StatisticsCharts;
