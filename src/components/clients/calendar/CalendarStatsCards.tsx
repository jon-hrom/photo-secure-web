import Icon from '@/components/ui/icon';

interface CalendarStatsCardsProps {
  thisWeek: number;
  total: number;
}

const CalendarStatsCards = ({ thisWeek, total }: CalendarStatsCardsProps) => {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-100 via-pink-50 to-rose-100 p-6 shadow-md hover:shadow-xl transition-all duration-500 hover:scale-105 cursor-pointer border border-purple-200/50 animate-in fade-in slide-in-from-left-8 duration-700">
        <div className="absolute inset-0 bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-purple-200/40 backdrop-blur-sm rounded-xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
              <Icon name="Calendar" size={24} className="text-purple-500" />
            </div>
            <div className="text-purple-600/70 text-sm font-medium">На неделе</div>
          </div>
          <div className="text-purple-700">
            <div className="text-4xl font-bold mb-1 animate-in fade-in slide-in-from-bottom-4 duration-700">
              {thisWeek}
            </div>
            <div className="text-purple-600/70 text-sm px-[1px] mx-1">     встреч 
запланировано</div>
          </div>
        </div>
        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-purple-200/20 rounded-full blur-2xl group-hover:scale-150 group-hover:bg-purple-300/30 transition-all duration-700" />
      </div>

      <div className="group relative overflow-hidden rounded-2xl bg-gradient-to-br from-blue-100 via-cyan-50 to-teal-100 p-6 shadow-md hover:shadow-xl transition-all duration-500 hover:scale-105 cursor-pointer border border-blue-200/50 animate-in fade-in slide-in-from-right-8 duration-700 delay-150">
        <div className="absolute inset-0 bg-white/30 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-3">
            <div className="p-3 bg-blue-200/40 backdrop-blur-sm rounded-xl group-hover:scale-110 group-hover:rotate-6 transition-all duration-500">
              <Icon name="Users" size={24} className="text-blue-500" />
            </div>
            <div className="text-blue-600/70 text-sm font-medium mx-5 my-0 px-5 py-0 rounded-0">Всего
в этом месяце</div>
          </div>
          <div className="text-blue-700">
            <div className="text-4xl font-bold mb-1 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
              {total}
            </div>
            <div className="text-blue-600/70 text-sm">активных записей</div>
          </div>
        </div>
        <div className="absolute -right-8 -bottom-8 w-32 h-32 bg-blue-200/20 rounded-full blur-2xl group-hover:scale-150 group-hover:bg-blue-300/30 transition-all duration-700" />
      </div>
    </div>
  );
};

export default CalendarStatsCards;
