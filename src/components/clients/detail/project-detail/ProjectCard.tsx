import { Card } from '@/components/ui/card';
import { Project } from '@/components/clients/ClientsTypes';
import ProjectCardHeader from './ProjectCardHeader';
import ProjectCardBody from './ProjectCardBody';
import { useProjectCardDraft } from './useProjectCardDraft';

interface ProjectCardProps {
  project: Project;
  isExpanded: boolean;
  selectorKey: number;
  animateKey: number;
  projectPaid: number;
  projectRemaining: number;
  statusBadge: JSX.Element;
  onToggleExpand: () => void;
  onDelete: () => void;
  onSaveChanges: (updates: Partial<Project>, notifyClient?: boolean) => void | Promise<void>;
  onDirtyChange?: (dirty: boolean) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
  onResendNotifications?: (projectId: number) => void | Promise<void>;
}

const ProjectCard = ({
  project,
  isExpanded,
  selectorKey,
  animateKey,
  projectPaid,
  projectRemaining,
  statusBadge,
  onToggleExpand,
  onDelete,
  onSaveChanges,
  onDirtyChange,
  onTouchStart,
  onTouchEnd,
  onResendNotifications,
}: ProjectCardProps) => {
  const {
    isResending,
    setIsResending,
    draft,
    isEditingBudget,
    setIsEditingBudget,
    budgetValue,
    setBudgetValue,
    budgetInputRef,
    reasonInputRef,
    isSaving,
    isDirty,
    isCancelled,
    cancelReasonMissing,
    updateDraft,
    applyAndRecalc,
    handleRateChange,
    handleStudioRateChange,
    handleDurationChange,
    updatePhotoItem,
    addPhotoItem,
    removePhotoItem,
    handleBudgetSave,
    handleSave,
    handleReset,
    recomputedRemaining,
  } = useProjectCardDraft({ project, projectPaid, onSaveChanges, onDirtyChange });

  return (
    <Card
      key={`project-card-${project.id}`}
      className={`animate-in slide-in-from-top-4 fade-in duration-500 ${
        !draft.startDate ? 'border-2 border-orange-500 bg-orange-50/50 dark:bg-orange-950/40' : ''
      } ${isDirty ? 'ring-2 ring-primary/40' : ''}`}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <ProjectCardHeader
        project={project}
        isExpanded={isExpanded}
        animateKey={animateKey}
        projectPaid={projectPaid}
        statusBadge={statusBadge}
        onToggleExpand={onToggleExpand}
        onDelete={onDelete}
        onResendNotifications={onResendNotifications}
        draft={draft}
        isDirty={isDirty}
        isSaving={isSaving}
        isResending={isResending}
        setIsResending={setIsResending}
        cancelReasonMissing={cancelReasonMissing}
        isEditingBudget={isEditingBudget}
        setIsEditingBudget={setIsEditingBudget}
        budgetValue={budgetValue}
        setBudgetValue={setBudgetValue}
        budgetInputRef={budgetInputRef}
        handleBudgetSave={handleBudgetSave}
        updateDraft={updateDraft}
        handleSave={handleSave}
        handleReset={handleReset}
        recomputedRemaining={recomputedRemaining}
      />
      {isExpanded && (
        <ProjectCardBody
          project={project}
          selectorKey={selectorKey}
          projectPaid={projectPaid}
          draft={draft}
          isDirty={isDirty}
          isSaving={isSaving}
          isCancelled={isCancelled}
          cancelReasonMissing={cancelReasonMissing}
          reasonInputRef={reasonInputRef}
          updateDraft={updateDraft}
          applyAndRecalc={applyAndRecalc}
          handleRateChange={handleRateChange}
          handleStudioRateChange={handleStudioRateChange}
          handleDurationChange={handleDurationChange}
          updatePhotoItem={updatePhotoItem}
          addPhotoItem={addPhotoItem}
          removePhotoItem={removePhotoItem}
          handleSave={handleSave}
          handleReset={handleReset}
        />
      )}
    </Card>
  );
};

export default ProjectCard;
