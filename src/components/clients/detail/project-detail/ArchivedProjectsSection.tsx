import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Project } from '@/components/clients/ClientsTypes';
import ProjectCard from './ProjectCard';

interface ArchivedProjectsSectionProps {
  archivedProjects: Project[];
  expandedProjects: Record<number, boolean>;
  selectorKeys: Record<number, number>;
  animateKeys: Record<number, number>;
  getProjectPaid: (projectId: number) => number;
  getProjectRemaining: (projectId: number, budget: number) => number;
  getStatusBadge: (status: Project['status']) => JSX.Element;
  setExpandedProjects: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  handleDeleteProject: (projectId: number) => void;
  handleSaveProjectChanges: (projectId: number, updates: Partial<Project>, notifyClient?: boolean) => void;
  handleDirtyChange: (projectId: number, dirty: boolean) => void;
  handleTouchStart: (e: React.TouchEvent, projectId: number) => void;
  handleTouchEnd: (e: React.TouchEvent, projectId: number) => void;
  handleResendNotifications: (projectId: number) => void;
  updateProjectStatus: (projectId: number, status: Project['status']) => void;
}

const ArchivedProjectsSection = ({
  archivedProjects,
  expandedProjects,
  selectorKeys,
  animateKeys,
  getProjectPaid,
  getProjectRemaining,
  getStatusBadge,
  setExpandedProjects,
  handleDeleteProject,
  handleSaveProjectChanges,
  handleDirtyChange,
  handleTouchStart,
  handleTouchEnd,
  handleResendNotifications,
  updateProjectStatus,
}: ArchivedProjectsSectionProps) => {
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [highlightArchive, setHighlightArchive] = useState(false);
  const archiveRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const flag = sessionStorage.getItem('highlightArchive');
    if (flag && archivedProjects.length > 0) {
      sessionStorage.removeItem('highlightArchive');
      setIsArchiveOpen(true);
      setHighlightArchive(true);
      setTimeout(() => {
        archiveRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 200);
      setTimeout(() => setHighlightArchive(false), 5000);
    }
  }, [archivedProjects.length]);

  if (archivedProjects.length === 0) return null;

  return (
    <div className="mt-6" ref={archiveRef}>
      <button
        onClick={() => setIsArchiveOpen(prev => !prev)}
        className={`flex items-center gap-2 w-full text-left min-h-[44px] py-2.5 px-3 text-sm rounded-md transition-all ${
          highlightArchive
            ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 font-medium'
            : 'text-muted-foreground hover:text-foreground active:bg-accent/50'
        }`}
      >
        <Icon name={isArchiveOpen ? "ChevronDown" : "ChevronRight"} size={18} className="shrink-0" />
        <Icon name="Archive" size={18} className="shrink-0" />
        <span className="truncate">Архив проектов</span>
        <Badge variant="secondary" className="ml-1 text-xs shrink-0">{archivedProjects.length}</Badge>
      </button>
      {isArchiveOpen && (
        <div className="mt-2 space-y-3">
          {[...archivedProjects].reverse().map((project) => (
            <div
              key={`archive-${project.id}`}
              className={`transition-all duration-700 ${
                highlightArchive
                  ? 'ring-2 ring-amber-400 dark:ring-amber-500 rounded-lg shadow-md shadow-amber-200/50 dark:shadow-amber-800/30'
                  : 'opacity-75 hover:opacity-100'
              }`}
            >
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
                onSaveChanges={(updates, notifyClient) => handleSaveProjectChanges(project.id, updates, notifyClient)}
                onDirtyChange={(dirty) => handleDirtyChange(project.id, dirty)}
                onTouchStart={(e) => handleTouchStart(e, project.id)}
                onTouchEnd={(e) => handleTouchEnd(e, project.id)}
                onResendNotifications={handleResendNotifications}
              />
              {!expandedProjects[project.id] && (
                <div className="flex justify-end px-3 pb-2 -mt-1">
                  <Button
                    variant={highlightArchive ? "default" : "outline"}
                    size="sm"
                    className={`text-xs gap-1.5 ${
                      highlightArchive
                        ? 'bg-amber-500 hover:bg-amber-600 text-white animate-pulse'
                        : 'bg-background'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      updateProjectStatus(project.id, 'in_progress');
                    }}
                  >
                    <Icon name="RotateCcw" size={14} />
                    Восстановить
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArchivedProjectsSection;
