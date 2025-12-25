import { TabsList, TabsTrigger } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';

interface ClientDialogTabsProps {
  activeTab: string;
}

const ClientDialogTabs = ({ activeTab }: ClientDialogTabsProps) => {
  return (
    <TabsList className="grid grid-cols-7 w-full h-auto">
      <TabsTrigger value="overview" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm py-2">
        <Icon name="LayoutDashboard" size={16} className="sm:mr-2" />
        <span className="hidden sm:inline">Обзор</span>
      </TabsTrigger>
      <TabsTrigger value="shooting" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm py-2">
        <Icon name="Camera" size={16} className="sm:mr-2" />
        <span className="hidden sm:inline">Съёмка</span>
      </TabsTrigger>
      <TabsTrigger value="projects" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm py-2">
        <Icon name="Briefcase" size={16} className="sm:mr-2" />
        <span className="hidden sm:inline">Проекты</span>
      </TabsTrigger>
      <TabsTrigger value="documents" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm py-2">
        <Icon name="FileText" size={16} className="sm:mr-2" />
        <span className="hidden sm:inline">Документы</span>
      </TabsTrigger>
      <TabsTrigger value="payments" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm py-2">
        <Icon name="DollarSign" size={16} className="sm:mr-2" />
        <span className="hidden sm:inline">Оплаты</span>
      </TabsTrigger>
      <TabsTrigger value="messages" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm py-2">
        <Icon name="MessageSquare" size={16} className="sm:mr-2" />
        <span className="hidden sm:inline">Переписка</span>
      </TabsTrigger>
      <TabsTrigger value="history" className="flex-col sm:flex-row gap-1 text-xs sm:text-sm py-2">
        <Icon name="History" size={16} className="sm:mr-2" />
        <span className="hidden sm:inline">История</span>
      </TabsTrigger>
    </TabsList>
  );
};

export default ClientDialogTabs;