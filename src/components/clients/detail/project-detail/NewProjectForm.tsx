import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Icon from '@/components/ui/icon';
import MeetingFormFields from './MeetingFormFields';
import ShootingFormFields from './ShootingFormFields';
import { NewProjectData, NewMeetingDraft, calcTotalBudget } from './newProjectFormTypes';

export type { NewMeetingDraft } from './newProjectFormTypes';

interface NewProjectFormProps {
  isOpen: boolean;
  onToggle: () => void;
  newProject: NewProjectData;
  setNewProject: (project: NewProjectData) => void;
  handleAddProject: () => Promise<void> | void;
  newMeeting?: NewMeetingDraft;
  setNewMeeting?: (m: NewMeetingDraft) => void;
  handleAddMeeting?: () => Promise<void> | void;
}

const NewProjectForm = ({
  isOpen,
  onToggle,
  newProject,
  setNewProject,
  handleAddProject,
  newMeeting,
  setNewMeeting,
  handleAddMeeting,
}: NewProjectFormProps) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [mode, setMode] = useState<'shooting' | 'meeting'>('shooting');
  const meetingEnabled = !!(newMeeting && setNewMeeting && handleAddMeeting);

  // Обновляем поля и автоматически пересчитываем бюджет
  const update = (patch: Partial<NewProjectData>) => {
    const next = { ...newProject, ...patch };
    setNewProject({ ...next, budget: String(calcTotalBudget(next)) });
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      if (mode === 'meeting' && handleAddMeeting) {
        await handleAddMeeting();
      } else {
        await handleAddProject();
      }
      onToggle();
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateMeeting = (patch: Partial<NewMeetingDraft>) => {
    if (newMeeting && setNewMeeting) setNewMeeting({ ...newMeeting, ...patch });
  };

  if (!isOpen) {
    return (
      <Button
        variant="outline"
        className="w-full h-12 border-dashed border-2 hover:border-primary hover:bg-primary/5 transition-all"
        onClick={onToggle}
      >
        <Icon name="Plus" size={18} className="mr-2" />
        Добавить новую услугу
      </Button>
    );
  }

  return (
    <Card>
      <CardHeader className="py-3 cursor-pointer hover:bg-accent/50 transition-colors" onClick={onToggle}>
        <CardTitle className="text-sm sm:text-base flex items-center gap-2">
          <Icon name="ChevronDown" size={18} />
          Добавить новую услугу
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 py-3 pb-20 max-h-[60vh] md:max-h-none overflow-y-auto md:overflow-visible">
        {meetingEnabled && (
          <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg mb-1">
            <button
              type="button"
              onClick={() => setMode('shooting')}
              className={`flex items-center justify-center gap-1.5 h-9 rounded-md text-xs font-medium transition-all ${
                mode === 'shooting'
                  ? 'bg-sky-500 text-white shadow'
                  : 'text-muted-foreground hover:bg-background'
              }`}
            >
              <Icon name="Camera" size={15} />
              Съёмка
            </button>
            <button
              type="button"
              onClick={() => setMode('meeting')}
              className={`flex items-center justify-center gap-1.5 h-9 rounded-md text-xs font-medium transition-all ${
                mode === 'meeting'
                  ? 'bg-violet-500 text-white shadow'
                  : 'text-muted-foreground hover:bg-background'
              }`}
            >
              <Icon name="Handshake" size={15} />
              Встреча
            </button>
          </div>
        )}

        {mode === 'meeting' && newMeeting ? (
          <MeetingFormFields newMeeting={newMeeting} updateMeeting={updateMeeting} />
        ) : mode === 'shooting' ? (
          <ShootingFormFields
            newProject={newProject}
            setNewProject={setNewProject}
            update={update}
          />
        ) : null}
        <div className="sticky bottom-0 -mx-3 px-3 pt-3 pb-3 bg-background border-t md:border-0 md:static md:mx-0 md:px-0 md:pt-2 md:pb-0 z-10">
          <Button onClick={handleSubmit} disabled={isSubmitting} className="w-full md:w-auto h-11 md:h-9 text-sm md:text-xs shadow-lg md:shadow-none">
            <Icon name={isSubmitting ? "Loader2" : "Save"} size={16} className={`mr-2${isSubmitting ? " animate-spin" : ""}`} />
            {isSubmitting
              ? "Сохраняем и отправляем..."
              : mode === 'meeting'
                ? "Сохранить встречу и отправить уведомления"
                : "Сохранить проект и отправить уведомления"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NewProjectForm;
