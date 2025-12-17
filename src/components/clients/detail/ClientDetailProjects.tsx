import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import Icon from '@/components/ui/icon';
import { Project, Payment } from '@/components/clients/ClientsTypes';
import { useEffect, useState, useRef, useCallback } from 'react';
import { ShootingStyleSelector } from '@/components/clients/dialog/ShootingStyleSelector';
import { getShootingStyles } from '@/data/shootingStyles';

interface ClientDetailProjectsProps {
  projects: Project[];
  payments: Payment[];
  newProject: { name: string; budget: string; description: string; startDate: string; shootingStyleId?: string };
  setNewProject: (project: any) => void;
  handleAddProject: () => void;
  handleDeleteProject: (projectId: number) => void;
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
              className="animate-in slide-in-from-top-4 fade-in duration-500"
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
                    </CardTitle>
                    {isExpanded && (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 mt-2 text-xs sm:text-sm">
                          <span className="text-muted-foreground">Бюджет: <span className="font-medium text-foreground">{project.budget.toLocaleString('ru-RU')} ₽</span></span>
                          <span className="text-muted-foreground">Оплачено: <span key={`paid-${project.id}-${animateKeys[project.id] || 0}`} className="font-medium text-green-600 inline-block animate-in fade-in zoom-in-50 duration-500">{getProjectPaid(project.id).toLocaleString('ru-RU')} ₽</span></span>
                          <span className="text-muted-foreground">Осталось: <span key={`remaining-${project.id}-${animateKeys[project.id] || 0}`} className="font-medium text-orange-600 inline-block animate-in fade-in zoom-in-50 duration-500">{getProjectRemaining(project.id, project.budget).toLocaleString('ru-RU')} ₽</span></span>
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Label className="text-xs text-muted-foreground">Дата бронирования:</Label>
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
                      handleDeleteProject(project.id);
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
                  <div className="flex gap-2">
                    <Select
                      value={project.status}
                      onValueChange={(value) => updateProjectStatus(project.id, value as Project['status'])}
                    >
                      <SelectTrigger className="w-full sm:w-48">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Новый</SelectItem>
                        <SelectItem value="in_progress">В работе</SelectItem>
                        <SelectItem value="completed">Завершён</SelectItem>
                        <SelectItem value="cancelled">Отменён</SelectItem>
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

      <Card className="mt-4">
        <CardHeader className="py-3">
          <CardTitle className="text-sm sm:text-base">Добавить новую услугу</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 py-3">
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
              <Label className="text-xs">Дата бронирования</Label>
              <Input
                type="date"
                value={newProject.startDate}
                onChange={(e) => setNewProject({ ...newProject, startDate: e.target.value })}
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
          <Button onClick={handleAddProject} className="w-full sm:w-auto h-9 text-xs">
            <Icon name="Plus" size={16} className="mr-2" />
            Создать услугу
          </Button>
        </CardContent>
      </Card>
    </>
  );
};

export default ClientDetailProjects;