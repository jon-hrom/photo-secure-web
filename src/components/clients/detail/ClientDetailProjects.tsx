import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import { Client, Project, Payment } from '@/components/clients/ClientsTypes';
import { useState } from 'react';
import ProjectCard from './project-detail/ProjectCard';
import NewProjectForm from './project-detail/NewProjectForm';
import MeetingsSection from './project-detail/MeetingsSection';
import ArchivedProjectsSection from './project-detail/ArchivedProjectsSection';
import { useProjectMeetings } from './project-detail/useProjectMeetings';
import { useProjectsLogic } from './project-detail/useProjectsLogic';

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
    hourly_rate?: string;
    add_to_calendar?: boolean;
  };
  setNewProject: (project: Record<string, unknown>) => void;
  handleAddProject: () => Promise<void> | void;
  handleDeleteProject: (projectId: number) => void;
  handleUpdateProject: (projectId: number, updates: Partial<Project>, notifyClient?: boolean) => void;
  updateProjectStatus: (projectId: number, status: Project['status']) => void;
  updateProjectDate: (projectId: number, newDate: string) => void;
  updateProjectShootingStyle: (projectId: number, styleId: string) => void;
  getStatusBadge: (status: Project['status']) => JSX.Element;
  formatDate: (dateString: string) => string;
  isNewProjectOpen?: boolean;
  setIsNewProjectOpen?: (open: boolean) => void;
  onProjectDirtyChange?: (projectId: number, dirty: boolean) => void;
  client?: Client;
  photographerName?: string;
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
  isNewProjectOpen: externalIsNewProjectOpen,
  setIsNewProjectOpen: externalSetIsNewProjectOpen,
  onProjectDirtyChange,
  client,
  photographerName,
}: ClientDetailProjectsProps) => {
  const [localIsNewProjectOpen, setLocalIsNewProjectOpen] = useState(false);

  const isNewProjectOpen = externalIsNewProjectOpen !== undefined ? externalIsNewProjectOpen : localIsNewProjectOpen;
  const setIsNewProjectOpen = externalSetIsNewProjectOpen || setLocalIsNewProjectOpen;

  const {
    newMeeting,
    setNewMeeting,
    activeMeetings,
    cancelledMeetings,
    handleAddMeeting,
    handleMeetingSave,
    handleMeetingCancel,
    handleMeetingDelete,
  } = useProjectMeetings(client);

  const {
    animateKeys,
    selectorKeys,
    expandedProjects,
    setExpandedProjects,
    activeProjects,
    archivedProjects,
    handleSaveProjectChanges,
    handleDirtyChange,
    handleResendNotifications,
    getProjectPaid,
    getProjectRemaining,
    toggleAllProjects,
    handleTouchStart,
    handleTouchEnd,
  } = useProjectsLogic({
    projects,
    payments,
    handleUpdateProject,
    updateProjectShootingStyle,
    onProjectDirtyChange,
    client,
    photographerName,
  });

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
          onSaveChanges={(updates, notifyClient) => handleSaveProjectChanges(project.id, updates, notifyClient)}
          onDirtyChange={(dirty) => handleDirtyChange(project.id, dirty)}
          onTouchStart={(e) => handleTouchStart(e, project.id)}
          onTouchEnd={(e) => handleTouchEnd(e, project.id)}
          onResendNotifications={handleResendNotifications}
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
      
      <div className="max-h-[calc(100vh-350px)] sm:max-h-[calc(100vh-420px)] overflow-y-auto pr-1 sm:pr-2 scrollbar-thin -webkit-overflow-scrolling-touch">
      {activeProjects.length === 0 && archivedProjects.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">Проектов пока нет</CardContent>
        </Card>
      ) : activeProjects.length === 0 ? (
        <Card>
          <CardContent className="py-4 sm:py-6 text-center text-muted-foreground text-sm">Нет активных проектов</CardContent>
        </Card>
      ) : (
        renderProjectList(activeProjects)
      )}

      <ArchivedProjectsSection
        archivedProjects={archivedProjects}
        expandedProjects={expandedProjects}
        selectorKeys={selectorKeys}
        animateKeys={animateKeys}
        getProjectPaid={getProjectPaid}
        getProjectRemaining={getProjectRemaining}
        getStatusBadge={getStatusBadge}
        setExpandedProjects={setExpandedProjects}
        handleDeleteProject={handleDeleteProject}
        handleSaveProjectChanges={handleSaveProjectChanges}
        handleDirtyChange={handleDirtyChange}
        handleTouchStart={handleTouchStart}
        handleTouchEnd={handleTouchEnd}
        handleResendNotifications={handleResendNotifications}
        updateProjectStatus={updateProjectStatus}
      />

      <MeetingsSection
        activeMeetings={activeMeetings}
        cancelledMeetings={cancelledMeetings}
        onSave={handleMeetingSave}
        onCancel={handleMeetingCancel}
        onDelete={handleMeetingDelete}
      />
      </div>

      <div className="mt-4">
        <NewProjectForm
          isOpen={isNewProjectOpen}
          onToggle={() => setIsNewProjectOpen(!isNewProjectOpen)}
          newProject={newProject}
          setNewProject={setNewProject}
          handleAddProject={handleAddProject}
          newMeeting={newMeeting}
          setNewMeeting={setNewMeeting}
          handleAddMeeting={handleAddMeeting}
        />
      </div>
    </>
  );
};

export default ClientDetailProjects;
