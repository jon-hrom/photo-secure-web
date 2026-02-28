import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Project, Payment } from '@/components/clients/ClientsTypes';
import { useEffect, useState, useRef, useCallback } from 'react';
import ProjectCard from './project-detail/ProjectCard';
import NewProjectForm from './project-detail/NewProjectForm';

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
  handleAddProject: () => Promise<void> | void;
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
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);

  const activeProjects = projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled');
  const archivedProjects = projects.filter(p => p.status === 'completed' || p.status === 'cancelled');
  
  const updateProjectShootingStyleRef = useRef(updateProjectShootingStyle);
  useEffect(() => {
    updateProjectShootingStyleRef.current = updateProjectShootingStyle;
  }, [updateProjectShootingStyle]);
  
  const handleShootingStyleChange = useCallback((projectId: number, styleId: string) => {
    console.log('[ClientDetailProjects] handleShootingStyleChange called:', { projectId, styleId });
    updateProjectShootingStyleRef.current(projectId, styleId);
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
    const allExpanded = activeProjects.every(p => expandedProjects[p.id]);
    const newState: Record<number, boolean> = {};
    activeProjects.forEach(p => {
      newState[p.id] = !allExpanded;
    });
    setExpandedProjects(prev => ({ ...prev, ...newState }));
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
    
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX < 0 && expandedProjects[projectId]) {
        setExpandedProjects(prev => ({ ...prev, [projectId]: false }));
      }
    }
    
    setTouchStart(null);
  };
  const renderProjectList = (projectList: Project[]) => (
    <div className="space-y-3">
      {[...projectList].reverse().map((project) => (
        <ProjectCard
          key={`project-card-${project.id}-${project.shootingStyleId || 'none'}`}
          project={project}
          isExpanded={expandedProjects[project.id] || false}
          selectorKey={selectorKeys[project.id] || 0}
          animateKey={animateKeys[project.id] || 0}
          projectPaid={getProjectPaid(project.id)}
          projectRemaining={getProjectRemaining(project.id, project.budget)}
          statusBadge={getStatusBadge(project.status)}
          onToggleExpand={() => setExpandedProjects(prev => ({ ...prev, [project.id]: !prev[project.id] }))}
          onDelete={() => handleDeleteProject(project.id)}
          onUpdateProject={(updates) => handleUpdateProject(project.id, updates)}
          onUpdateStatus={(status) => updateProjectStatus(project.id, status)}
          onUpdateDate={(date) => updateProjectDate(project.id, date)}
          onShootingStyleChange={(styleId) => handleShootingStyleChange(project.id, styleId)}
          onTouchStart={(e) => handleTouchStart(e, project.id)}
          onTouchEnd={(e) => handleTouchEnd(e, project.id)}
        />
      ))}
    </div>
  );

  return (
    <>
      {activeProjects.length > 0 && (
        <div className="flex justify-end mb-3">
          <Button
            variant="outline"
            size="sm"
            onClick={toggleAllProjects}
            className="text-xs"
          >
            <Icon 
              name={activeProjects.every(p => expandedProjects[p.id]) ? "ChevronsUp" : "ChevronsDown"} 
              size={16} 
              className="mr-2" 
            />
            {activeProjects.every(p => expandedProjects[p.id]) ? "Свернуть все" : "Развернуть все"}
          </Button>
        </div>
      )}
      
      <div className="max-h-[calc(100vh-420px)] overflow-y-auto pr-2 scrollbar-thin">
      {activeProjects.length === 0 && archivedProjects.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Проектов пока нет</CardContent>
        </Card>
      ) : activeProjects.length === 0 ? (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground text-sm">Нет активных проектов</CardContent>
        </Card>
      ) : (
        renderProjectList(activeProjects)
      )}

      {archivedProjects.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setIsArchiveOpen(prev => !prev)}
            className="flex items-center gap-2 w-full text-left py-2 px-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Icon name={isArchiveOpen ? "ChevronDown" : "ChevronRight"} size={16} />
            <Icon name="Archive" size={16} />
            <span>Архив проектов</span>
            <Badge variant="secondary" className="ml-1 text-xs">{archivedProjects.length}</Badge>
          </button>
          {isArchiveOpen && (
            <div className="mt-2 space-y-3">
              {[...archivedProjects].reverse().map((project) => (
                <div key={`archive-${project.id}`} className="relative opacity-75 hover:opacity-100 transition-opacity">
                  <ProjectCard
                    project={project}
                    isExpanded={expandedProjects[project.id] || false}
                    selectorKey={selectorKeys[project.id] || 0}
                    animateKey={animateKeys[project.id] || 0}
                    projectPaid={getProjectPaid(project.id)}
                    projectRemaining={getProjectRemaining(project.id, project.budget)}
                    statusBadge={getStatusBadge(project.status)}
                    onToggleExpand={() => setExpandedProjects(prev => ({ ...prev, [project.id]: !prev[project.id] }))}
                    onDelete={() => handleDeleteProject(project.id)}
                    onUpdateProject={(updates) => handleUpdateProject(project.id, updates)}
                    onUpdateStatus={(status) => updateProjectStatus(project.id, status)}
                    onUpdateDate={(date) => updateProjectDate(project.id, date)}
                    onShootingStyleChange={(styleId) => handleShootingStyleChange(project.id, styleId)}
                    onTouchStart={(e) => handleTouchStart(e, project.id)}
                    onTouchEnd={(e) => handleTouchEnd(e, project.id)}
                  />
                  {!expandedProjects[project.id] && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="absolute top-3 right-12 text-xs gap-1 bg-background"
                      onClick={(e) => {
                        e.stopPropagation();
                        updateProjectStatus(project.id, 'in_progress');
                      }}
                    >
                      <Icon name="RotateCcw" size={14} />
                      Восстановить
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      </div>

      <div className="mt-4">
        <NewProjectForm
          isOpen={isNewProjectOpen}
          onToggle={() => setIsNewProjectOpen(prev => !prev)}
          newProject={newProject}
          setNewProject={setNewProject}
          handleAddProject={handleAddProject}
        />
      </div>
    </>
  );
};

export default ClientDetailProjects;