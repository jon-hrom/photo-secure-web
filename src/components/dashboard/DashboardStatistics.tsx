import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import Icon from '@/components/ui/icon';

interface DashboardStatisticsProps {
  trialDaysLeft: number;
  subscriptionDaysLeft: number;
  isTrialPeriod: boolean;
}

const DashboardStatistics = ({ trialDaysLeft, subscriptionDaysLeft, isTrialPeriod }: DashboardStatisticsProps) => {
  const [isStatsExpanded, setIsStatsExpanded] = useState(false);

  return (
    <Card className="shadow-lg border-2">
      <CardHeader 
        className="cursor-pointer hover:bg-muted/50 transition-colors select-none"
        onClick={() => setIsStatsExpanded(!isStatsExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 md:gap-3">
            <Icon name="BarChart3" className="text-primary" size={20} />
            <CardTitle className="text-base md:text-xl font-semibold text-gray-900 dark:text-white">Статистика</CardTitle>
          </div>
          <Icon 
            name={isStatsExpanded ? "ChevronUp" : "ChevronDown"} 
            size={20} 
            className="text-muted-foreground transition-transform flex-shrink-0"
          />
        </div>
      </CardHeader>
      
      {isStatsExpanded && (
        <CardContent className="pt-0">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 pt-4">
            {/* Тарифный план */}
            <div className="p-3 md:p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <Icon name="CreditCard" className="text-blue-600" size={18} />
                  <h3 className="font-semibold text-xs md:text-sm text-gray-900 dark:text-white">Тарифный план</h3>
                </div>
              </div>
              {isTrialPeriod ? (
                <div className="space-y-1.5 md:space-y-2">
                  <Badge className="bg-yellow-500 text-white text-[10px] md:text-xs">Пробный период</Badge>
                  <div className="flex justify-between text-[10px] md:text-xs text-muted-foreground dark:text-gray-300">
                    <span>Осталось:</span>
                    <span className="font-bold text-yellow-700">{trialDaysLeft} дней</span>
                  </div>
                  <Progress value={(trialDaysLeft / 30) * 100} className="h-1 md:h-1.5" />
                </div>
              ) : (
                <div className="space-y-1.5 md:space-y-2">
                  <Badge className="bg-green-500 text-white text-[10px] md:text-xs">Активная</Badge>
                  <div className="flex justify-between text-[10px] md:text-xs text-muted-foreground dark:text-gray-300">
                    <span>Осталось:</span>
                    <span className="font-bold text-green-700">{subscriptionDaysLeft} дней</span>
                  </div>
                  <Progress value={(subscriptionDaysLeft / 30) * 100} className="h-1 md:h-1.5" />
                </div>
              )}
            </div>

            {/* Клиенты */}
            <div className="p-3 md:p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200">
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <Icon name="Users" className="text-purple-600" size={18} />
                  <h3 className="font-semibold text-xs md:text-sm text-gray-900 dark:text-white">Клиенты</h3>
                </div>
                <div className="text-xl md:text-2xl font-bold text-purple-700">0</div>
              </div>
              <div className="space-y-1 md:space-y-1.5 text-[10px] md:text-xs">
                <div className="flex justify-between text-muted-foreground dark:text-gray-300">
                  <span>На этой неделе:</span>
                  <span className="font-semibold text-purple-700">0</span>
                </div>
                <div className="flex justify-between text-muted-foreground dark:text-gray-300">
                  <span>В этом месяце:</span>
                  <span className="font-semibold text-purple-700">0</span>
                </div>
              </div>
            </div>

            {/* Фотокниги */}
            <div className="p-3 md:p-4 bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg border border-orange-200">
              <div className="flex items-center justify-between mb-2 md:mb-3">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <Icon name="Book" className="text-orange-600" size={18} />
                  <h3 className="font-semibold text-xs md:text-sm text-gray-900 dark:text-white">Фотокниги</h3>
                </div>
                <div className="text-xl md:text-2xl font-bold text-orange-700">0</div>
              </div>
              <div className="space-y-1 md:space-y-1.5 text-[10px] md:text-xs">
                <div className="flex justify-between text-muted-foreground dark:text-gray-300">
                  <span>В работе:</span>
                  <span className="font-semibold text-orange-700">0</span>
                </div>
                <div className="flex justify-between text-muted-foreground dark:text-gray-300">
                  <span>Завершено:</span>
                  <span className="font-semibold text-orange-700">0</span>
                </div>
              </div>
            </div>

            {/* Завершенные проекты */}
            <div className="p-3 md:p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
              <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                <Icon name="CheckCircle2" className="text-green-600" size={16} />
                <h3 className="font-semibold text-[10px] md:text-xs text-gray-900 dark:text-white">Завершённые проекты</h3>
              </div>
              <div className="space-y-1">
                <Progress value={0} className="h-1 md:h-1.5" />
                <div className="text-[10px] md:text-xs text-muted-foreground dark:text-gray-300 text-right">
                  <span className="font-bold text-green-700">0%</span>
                </div>
              </div>
            </div>

            {/* Загрузка календаря */}
            <div className="p-3 md:p-4 bg-gradient-to-br from-cyan-50 to-blue-50 rounded-lg border border-cyan-200">
              <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                <Icon name="Calendar" className="text-cyan-600" size={16} />
                <h3 className="font-semibold text-[10px] md:text-xs text-gray-900 dark:text-white">Загрузка календаря</h3>
              </div>
              <div className="space-y-1">
                <Progress value={0} className="h-1 md:h-1.5" />
                <div className="text-[10px] md:text-xs text-muted-foreground dark:text-gray-300 text-right">
                  <span className="font-bold text-cyan-700">0%</span>
                </div>
              </div>
            </div>

            {/* Довольные клиенты */}
            <div className="p-3 md:p-4 bg-gradient-to-br from-rose-50 to-pink-50 rounded-lg border border-rose-200">
              <div className="flex items-center gap-1.5 md:gap-2 mb-1.5 md:mb-2">
                <Icon name="Heart" className="text-rose-600" size={16} />
                <h3 className="font-semibold text-[10px] md:text-xs text-gray-900 dark:text-white">Довольные клиенты</h3>
              </div>
              <div className="space-y-1">
                <Progress value={0} className="h-1 md:h-1.5" />
                <div className="text-[10px] md:text-xs text-muted-foreground dark:text-gray-300 text-right">
                  <span className="font-bold text-rose-700">0%</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      )}
    </Card>
  );
};

export default DashboardStatistics;