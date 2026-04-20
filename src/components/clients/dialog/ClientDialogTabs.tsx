import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';

interface ClientDialogTabsProps {
  activeTab: string;
}

const ClientDialogTabs = ({ activeTab }: ClientDialogTabsProps) => {
  return (
    <TabsList className="grid grid-cols-6 w-full h-auto min-h-[48px] sm:min-h-0 gap-0.5 sm:gap-1 px-1 sm:px-1.5">
      <TabsTrigger value="overview" className="flex-col sm:flex-row gap-0.5 sm:gap-1 text-[10px] sm:text-sm py-1.5 sm:py-2 px-1 sm:px-3 min-h-[44px]">
        <Icon name="LayoutDashboard" size={16} className="sm:mr-2" />
        <span className="sm:hidden">Обзор</span>
        <span className="hidden sm:inline">Обзор</span>
      </TabsTrigger>
      <TabsTrigger value="projects" className="flex-col sm:flex-row gap-0.5 sm:gap-1 text-[10px] sm:text-sm py-1.5 sm:py-2 px-1 sm:px-3 min-h-[44px]">
        <Icon name="Briefcase" size={16} className="sm:mr-2" />
        <span className="sm:hidden">Проекты</span>
        <span className="hidden sm:inline">Проекты</span>
      </TabsTrigger>
      <TabsTrigger value="documents" className="flex-col sm:flex-row gap-0.5 sm:gap-1 text-[10px] sm:text-sm py-1.5 sm:py-2 px-1 sm:px-3 min-h-[44px]">
        <Icon name="FileText" size={16} className="sm:mr-2" />
        <span className="sm:hidden">Доки</span>
        <span className="hidden sm:inline">Документы</span>
      </TabsTrigger>
      <TabsTrigger value="payments" className="flex-col sm:flex-row gap-0.5 sm:gap-1 text-[10px] sm:text-sm py-1.5 sm:py-2 px-1 sm:px-3 min-h-[44px]">
        <Icon name="DollarSign" size={16} className="sm:mr-2" />
        <span className="sm:hidden">Оплаты</span>
        <span className="hidden sm:inline">Оплаты</span>
      </TabsTrigger>
      <TabsTrigger value="messages" className="flex-col sm:flex-row gap-0.5 sm:gap-1 text-[10px] sm:text-sm py-1.5 sm:py-2 px-1 sm:px-3 min-h-[44px]">
        <Icon name="MessageSquare" size={16} className="sm:mr-2" />
        <span className="sm:hidden">Чат</span>
        <span className="hidden sm:inline">Переписка</span>
      </TabsTrigger>
      <TabsTrigger value="history" className="flex-col sm:flex-row gap-0.5 sm:gap-1 text-[10px] sm:text-sm py-1.5 sm:py-2 px-1 sm:px-3 min-h-[44px]">
        <Icon name="History" size={16} className="sm:mr-2" />
        <span className="sm:hidden">История</span>
        <span className="hidden sm:inline">История</span>
      </TabsTrigger>
    </TabsList>
  );
};

export default ClientDialogTabs;