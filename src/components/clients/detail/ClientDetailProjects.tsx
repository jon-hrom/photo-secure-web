import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
    
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 50) {
      if (deltaX < 0 && expandedProjects[projectId]) {
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
          {[...projects].reverse().map((project) => (
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
