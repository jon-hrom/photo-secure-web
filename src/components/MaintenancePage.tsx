import Icon from '@/components/ui/icon';

const MaintenancePage = () => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/10 via-background to-secondary/10 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full text-center space-y-8">
        <div className="relative">
          <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-secondary/20 blur-3xl rounded-full"></div>
          <img 
            src="https://cdn.poehali.dev/projects/07a45ae1-582a-4829-83a6-3f379eb489ff/files/1db35968-d888-4e7d-b0a9-b4a3492c68f8.jpg"
            alt="Maintenance"
            className="relative mx-auto w-full max-w-md h-auto rounded-2xl shadow-2xl"
          />
        </div>
        
        <div className="space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Icon name="Wrench" size={40} className="text-primary animate-pulse" />
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
              Сайт на реконструкции
            </h1>
          </div>
          
          <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto">
            Мы проводим технические работы для улучшения сервиса
          </p>
          
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground pt-4">
            <Icon name="Clock" size={18} />
            <span>Скоро вернёмся!</span>
          </div>
        </div>
        
        <div className="flex flex-wrap justify-center gap-6 pt-8">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon name="CheckCircle" size={20} className="text-green-500" />
            <span className="text-sm">Обновление базы данных</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon name="CheckCircle" size={20} className="text-green-500" />
            <span className="text-sm">Оптимизация производительности</span>
          </div>
          <div className="flex items-center gap-2 text-muted-foreground">
            <Icon name="Loader" size={20} className="text-primary animate-spin" />
            <span className="text-sm">Добавление новых функций</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MaintenancePage;
