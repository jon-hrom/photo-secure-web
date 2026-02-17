import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import Icon from '@/components/ui/icon';
import { Project, Payment } from '@/components/clients/ClientsTypes';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ShootingStyleSelector } from '@/components/clients/dialog/ShootingStyleSelector';
import { getShootingStyles } from '@/data/shootingStyles';
import { getUserTimezoneShort } from '@/utils/regionTimezone';

interface ClientDetailProjectsProps {
  projects: Project[];
  payments: Payment[];
  newProject: { 
    name: string; 
    budget: string; 
    description: string; 
    startDate: string; 
    shootingStyleId?: string;
    shooting_time?: string;
    shooting_duration?: number;
    shooting_address?: string;
    add_to_calendar?: boolean;
  };
  setNewProject: (project: any) => void;
  handleAddProject: () => void;
  handleDeleteProject: (projectId: number) => void;
  handleUpdateProject: (projectId: number, updates: Partial<Project>) => void;
  updateProjectStatus: (projectId: number, status: Project['status']) => void;
  updateProjectDate: (projectId: number, newDate: string) => void;
  updateProjectShootingStyle: (projectId: number, styleId: string) => void;
  getStatusBadge: (status: Project['status']) => JSX.Element;
  formatDate: (dateString: string) => string;
}

const ClientDetailProjects = ({
  projects,
  payments,
  newProject,
  setNewProject,
  handleAddProject,
  handleDeleteProject,
  handleUpdateProject,
  updateProjectStatus,
  updateProjectDate,
  updateProjectShootingStyle,
  getStatusBadge,
  formatDate,
}: ClientDetailProjectsProps) => {
  const [animateKeys, setAnimateKeys] = useState<Record<number, number>>({});
  const [selectorKeys, setSelectorKeys] = useState<Record<number, number>>({});
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>({});
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; projectId: number } | null>(null);
  const [isNewProjectOpen, setIsNewProjectOpen] = useState(false);
  
  // Используем ref чтобы всегда иметь актуальную функцию
  const updateProjectShootingStyleRef = useRef(updateProjectShootingStyle);
  useEffect(() => {
    updateProjectShootingStyleRef.current = updateProjectShootingStyle;
  }, [updateProjectShootingStyle]);
  
  // Стабильная функция-обёртка которая не меняется между рендерами
  const handleShootingStyleChange = useCallback((projectId: number, styleId: string) => {
    console.log('[ClientDetailProjects] handleShootingStyleChange called:', { projectId, styleId });
    updateProjectShootingStyleRef.current(projectId, styleId);
    // Принудительно перемонтируем ShootingStyleSelector для этого проекта
    setSelectorKeys(prev => ({ ...prev, [projectId]: (prev[projectId] || 0) + 1 }));
  }, []);

  const getProjectPayments = (projectId: number) => {
    const projectPayments = payments.filter(p => p.projectId === projectId && p.status === 'completed');
    console.log(`[Project ${projectId}] Payments:`, projectPayments);
    return projectPayments;
  };

  const getProjectPaid = (projectId: number) => {
    const paid = getProjectPayments(projectId).reduce((sum, p) => sum + p.amount, 0);
    console.log(`[Project ${projectId}] Total Paid:`, paid);
    return paid;
  };

  const getProjectRemaining = (projectId: number, budget: number) => {
    const paid = getProjectPaid(projectId);
    const remaining = budget - paid;
    console.log(`[Project ${projectId}] Budget: ${budget}, Paid: ${paid}, Remaining: ${remaining}`);
    return remaining;
  };

  useEffect(() => {
    const newKeys: Record<number, number> = {};
    projects.forEach(project => {
      newKeys[project.id] = (animateKeys[project.id] || 0) + 1;
    });
    setAnimateKeys(newKeys);
  }, [payments]);

  // Автоматически разворачиваем проекты без даты при первом рендере
  useEffect(() => {
    const projectsWithoutDate = projects.filter(p => !p.startDate);
    if (projectsWithoutDate.length > 0) {
      const newExpanded: Record<number, boolean> = {};
      projectsWithoutDate.forEach(p => {
        newExpanded[p.id] = true;
      });
      setExpandedProjects(prev => ({ ...prev, ...newExpanded }));
    }
  }, [projects]);

  useEffect(() => {
    const handleFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        setTimeout(() => {
          target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }, 300);
      }
    };

    document.addEventListener('focusin', handleFocus);
    return () => document.removeEventListener('focusin', handleFocus);
  }, []);

  const toggleAllProjects = () => {
    const allExpanded = projects.every(p => expandedProjects[p.id]);
    const newState: Record<number, boolean> = {};
    projects.forEach(p => {
      newState[p.id] = !allExpanded;
    });
    setExpandedProjects(newState);
  };

  const handleTouchStart = (e: React.TouchEvent, projectId: number) => {
    setTouchStart({
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      projectId
    });
  };

  const handleTouchEnd = (e: React.TouchEvent, projectId: number) => {
    if (!touchStart || touchStart.projectId !== projectId) return;
    
    const deltaX = e.changedTouches[0].clientX - touchStart.x;
    const deltaY = e.changedTouches[0].clientY - touchStart.y;
    
    // Свайп должен быть горизонтальным (больше по X чем по Y)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX < 0 && expandedProjects[projectId]) {
        // Свайп влево - сворачиваем
        setExpandedProjects(prev => ({ ...prev, [projectId]: false }));
      }
    }
    
    setTouchStart(null);
  };
  return (
    <>
      {projects.length > 0 && (
        <div className="flex justify-end mb-3">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAllProjects}
            className="text-xs"
          >
            <Icon 
              name={projects.every(p => expandedProjects[p.id]) ? "ChevronsUp" : "ChevronsDown"} 
              size={16} 
              className="mr-2" 
            />
            {projects.every(p => expandedProjects[p.id]) ? "Свернуть все" : "Развернуть все"}
          </Button>
        </div>
      )}
      
      <div className="max-h-[calc(100vh-420px)] overflow-y-auto pr-2 scrollbar-thin">
      {projects.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Список слуг пока нет</CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {[...projects].reverse().map((project) => {
            const isExpanded = expandedProjects[project.id] || false;
            return (
            <Card 
              key={`project-card-${project.id}-${project.shootingStyleId || 'none'}`}
              className={`animate-in slide-in-from-top-4 fade-in duration-500 ${
                !project.startDate ? 'border-2 border-orange-500 bg-orange-50/50 dark:bg-orange-950/40' : ''
              }`}
              onTouchStart={(e) => handleTouchStart(e, project.id)}
              onTouchEnd={(e) => handleTouchEnd(e, project.id)}
            >
              <CardHeader 
                className="cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => setExpandedProjects(prev => ({ ...prev, [project.id]: !prev[project.id] }))}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="flex items-center gap-2 flex-wrap text-base sm:text-lg">
                      <Icon name={isExpanded ? "ChevronDown" : "ChevronRight"} size={20} className="shrink-0" />
                      <span className="truncate">{project.name}</span>
                      {getStatusBadge(project.status)}
                      {!project.startDate && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-orange-500 text-white">
                          <Icon name="CalendarX" size={12} />
                          Без даты
                        </span>
                      )}
                    </CardTitle>
                    {isExpanded && (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm">
                          <span className="text-muted-foreground">Бюджет: <span className="font-medium text-foreground">{project.budget.toLocaleString('ru-RU')} ₽</span></span>
                          <span className="text-muted-foreground">Оплачено: <span key={`paid-${project.id}-${animateKeys[project.id] || 0}`} className="font-medium text-green-600 dark:text-green-400 inline-block animate-in fade-in zoom-in-50 duration-500">{getProjectPaid(project.id).toLocaleString('ru-RU')} ₽</span></span>
                          <span className="text-muted-foreground">Осталось: <span key={`remaining-${project.id}-${animateKeys[project.id] || 0}`} className="font-medium text-orange-600 dark:text-orange-400 inline-block animate-in fade-in zoom-in-50 duration-500">{getProjectRemaining(project.id, project.budget).toLocaleString('ru-RU')} ₽</span></span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Label className="text-xs text-muted-foreground">Дата съёмки:</Label>
                          <Input
                            type="date"
                            value={(() => {
                              if (!project.startDate) return '';
                              if (typeof project.startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(project.startDate)) {
                                return project.startDate;
                              }
                              try {
                                const date = new Date(project.startDate);
                                return isNaN(date.getTime()) ? '' : date.toISOString().split('T')[0];
                              } catch {
                                return '';
                              }
                            })()}
                            onChange={(e) => {
                              e.stopPropagation();
                              updateProjectDate(project.id, e.target.value);
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="text-xs h-7 w-40"
                          />
                        </div>
                        {project.shootingStyleId && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            Стиль: <span className="font-medium text-foreground">
                              {getShootingStyles().find(s => s.id === project.shootingStyleId)?.name}
                            </span>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (confirm(`Удалить проект "${project.name || 'Без названия'}"?`)) {
                        handleDeleteProject(project.id);
                      }
                    }}
                    className="shrink-0"
                  >
                    <Icon name="Trash2" size={16} />
                  </Button>
                </div>
              </CardHeader>
              {isExpanded && (
                <CardContent className="space-y-3 max-h-[60vh] overflow-y-auto">
                  {project.description && (
                    <p className="text-sm text-muted-foreground">{project.description}</p>
                  )}
                  <div className="space-y-2">
                    <Label className="text-xs">Стиль съёмки</Label>
                    <ShootingStyleSelector
                      key={`existing-project-${project.id}-${selectorKeys[project.id] || 0}`}
                      value={project.shootingStyleId}
                      onChange={(styleId) => handleShootingStyleChange(project.id, styleId)}
                    />
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">⏰ Время съёмки <span className="text-muted-foreground font-normal">({getUserTimezoneShort()})</span></Label>
                      <Input
                        type="time"
                        value={project.shooting_time || ''}
                        onChange={(e) => handleUpdateProject(project.id, { shooting_time: e.target.value })}
                        className="text-xs h-9"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-xs">⏱️ Длительность (минуты)</Label>
                      <Select
                        value={String(project.shooting_duration || 120)}
                        onValueChange={(value) => handleUpdateProject(project.id, { shooting_duration: parseInt(value) })}
                      >
                        <SelectTrigger className="text-xs h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="5">5 минут</SelectItem>
                          <SelectItem value="10">10 минут</SelectItem>
                          <SelectItem value="15">15 минут</SelectItem>
                          <SelectItem value="20">20 минут</SelectItem>
                          <SelectItem value="25">25 минут</SelectItem>
                          <SelectItem value="30">30 минут</SelectItem>
                          <SelectItem value="35">35 минут</SelectItem>
                          <SelectItem value="40">40 минут</SelectItem>
                          <SelectItem value="45">45 минут</SelectItem>
                          <SelectItem value="50">50 минут</SelectItem>
                          <SelectItem value="55">55 минут</SelectItem>
                          <SelectItem value="60">1 час</SelectItem>
                          <SelectItem value="90">1.5 часа</SelectItem>
                          <SelectItem value="120">2 часа</SelectItem>
                          <SelectItem value="150">2.5 часа</SelectItem>
                          <SelectItem value="180">3 часа</SelectItem>
                          <SelectItem value="240">4 часа</SelectItem>
                          <SelectItem value="300">5 часов</SelectItem>
                          <SelectItem value="360">6 часов</SelectItem>
                          <SelectItem value="420">7 часов</SelectItem>
                          <SelectItem value="480">8 часов</SelectItem>
                          <SelectItem value="540">9 часов</SelectItem>
                          <SelectItem value="600">10 часов</SelectItem>
                          <SelectItem value="660">11 часов</SelectItem>
                          <SelectItem value="720">12 часов</SelectItem>
                          <SelectItem value="780">13 часов</SelectItem>
                          <SelectItem value="840">14 часов</SelectItem>
                          <SelectItem value="900">15 часов</SelectItem>
                          <SelectItem value="960">16 часов</SelectItem>
                          <SelectItem value="1020">17 часов</SelectItem>
                          <SelectItem value="1080">18 часов</SelectItem>
                          <SelectItem value="1140">19 часов</SelectItem>
                          <SelectItem value="1200">20 часов</SelectItem>
                          <SelectItem value="1260">21 час</SelectItem>
                          <SelectItem value="1320">22 часа</SelectItem>
                          <SelectItem value="1380">23 часа</SelectItem>
                          <SelectItem value="1440">24 часа</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">📍 Адрес съёмки</Label>
                    <Input
                      value={project.shooting_address || ''}
                      onChange={(e) => handleUpdateProject(project.id, { shooting_address: e.target.value })}
                      placeholder="Москва, Красная площадь, 1"
                      className="text-xs h-9"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Select
                      value={project.status}
                      onValueChange={(value) => updateProjectStatus(project.id, value as Project['status'])}
                    >
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new" className="text-green-600 dark:text-green-400 font-medium focus:text-green-700 dark:focus:text-green-300 focus:bg-green-50 dark:focus:bg-green-950/30">Новый</SelectItem>
                        <SelectItem value="in_progress" className="text-orange-600 dark:text-orange-400 font-medium focus:text-orange-700 dark:focus:text-orange-300 focus:bg-orange-50 dark:focus:bg-orange-950/30">В работе</SelectItem>
                        <SelectItem value="completed" className="text-red-600 dark:text-red-400 font-medium focus:text-red-700 dark:focus:text-red-300 focus:bg-red-50 dark:focus:bg-red-950/30">Завершён</SelectItem>
                        <SelectItem value="cancelled" className="text-muted-foreground font-medium focus:text-foreground focus:bg-muted">Отменён</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              )}
            </Card>
            );
          })}
        </div>
      )}
      </div>

      <div className="mt-4">
        {!isNewProjectOpen ? (
          <Button
            variant="outline"
            className="w-full h-12 border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all"
            onClick={() => setIsNewProjectOpen(true)}
          >
            <Icon name="Plus" size={18} className="mr-2" />
            Добавить новую услугу
          </Button>
        ) : (
        <Card>
        <CardHeader className="py-3 cursor-pointer hover:bg-accent/50 transition-colors" onClick={() => setIsNewProjectOpen(false)}>
          <CardTitle className="text-sm sm:text-base flex items-center gap-2">
            <Icon name="ChevronDown" size={18} />
            Добавить новую услугу
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 py-3 pb-20 max-h-[60vh] md:max-h-none overflow-y-auto md:overflow-visible">
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
              <Select
                value={String(newProject.shooting_duration || 120)}
                onValueChange={(value) => setNewProject({ ...newProject, shooting_duration: parseInt(value) })}
              >
                <SelectTrigger className="text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 минут</SelectItem>
                  <SelectItem value="10">10 минут</SelectItem>
                  <SelectItem value="15">15 минут</SelectItem>
                  <SelectItem value="20">20 минут</SelectItem>
                  <SelectItem value="25">25 минут</SelectItem>
                  <SelectItem value="30">30 минут</SelectItem>
                  <SelectItem value="35">35 минут</SelectItem>
                  <SelectItem value="40">40 минут</SelectItem>
                  <SelectItem value="45">45 минут</SelectItem>
                  <SelectItem value="50">50 минут</SelectItem>
                  <SelectItem value="55">55 минут</SelectItem>
                  <SelectItem value="60">1 час</SelectItem>
                  <SelectItem value="90">1.5 часа</SelectItem>
                  <SelectItem value="120">2 часа</SelectItem>
                  <SelectItem value="150">2.5 часа</SelectItem>
                  <SelectItem value="180">3 часа</SelectItem>
                  <SelectItem value="240">4 часа</SelectItem>
                  <SelectItem value="300">5 часов</SelectItem>
                  <SelectItem value="360">6 часов</SelectItem>
                  <SelectItem value="420">7 часов</SelectItem>
                  <SelectItem value="480">8 часов</SelectItem>
                  <SelectItem value="540">9 часов</SelectItem>
                  <SelectItem value="600">10 часов</SelectItem>
                  <SelectItem value="660">11 часов</SelectItem>
                  <SelectItem value="720">12 часов</SelectItem>
                  <SelectItem value="780">13 часов</SelectItem>
                  <SelectItem value="840">14 часов</SelectItem>
                  <SelectItem value="900">15 часов</SelectItem>
                  <SelectItem value="960">16 часов</SelectItem>
                  <SelectItem value="1020">17 часов</SelectItem>
                  <SelectItem value="1080">18 часов</SelectItem>
                  <SelectItem value="1140">19 часов</SelectItem>
                  <SelectItem value="1200">20 часов</SelectItem>
                  <SelectItem value="1260">21 час</SelectItem>
                  <SelectItem value="1320">22 часа</SelectItem>
                  <SelectItem value="1380">23 часа</SelectItem>
                  <SelectItem value="1440">24 часа</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
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
          <div className="h-16"></div>
          <div className="fixed bottom-0 left-0 right-0 p-4 bg-background border-t md:static md:border-0 md:p-0">
            <Button onClick={() => { handleAddProject(); setIsNewProjectOpen(false); }} className="w-full md:w-auto h-11 md:h-9 text-sm md:text-xs shadow-lg md:shadow-none">
              <Icon name="Plus" size={16} className="mr-2" />
              Создать услугу
            </Button>
          </div>
        </CardContent>
      </Card>
        )}
      </div>
    </>
  );
};

export default ClientDetailProjects;