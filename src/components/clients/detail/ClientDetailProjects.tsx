import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Icon from '@/components/ui/icon';
import { Client, Project, Payment } from '@/components/clients/ClientsTypes';
import { useEffect, useState, useRef, useCallback } from 'react';
import ProjectCard from './project-detail/ProjectCard';
import MeetingCard from './project-detail/MeetingCard';
import NewProjectForm, { NewMeetingDraft } from './project-detail/NewProjectForm';
import { toast } from 'sonner';
import { sendProjectNotification } from '@/components/clients/dialog/NotificationService';
import { createMeeting, fetchMeetings, updateMeeting, deleteMeeting, Meeting } from '@/components/clients/dialog/MeetingService';
import { todayLocalDate } from '@/utils/dateFormat';

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
  const [animateKeys, setAnimateKeys] = useState<Record<number, number>>({});
  const [selectorKeys, setSelectorKeys] = useState<Record<number, number>>({});
  const [expandedProjects, setExpandedProjects] = useState<Record<number, boolean>>({});
  const [touchStart, setTouchStart] = useState<{ x: number; y: number; projectId: number } | null>(null);
  const [localIsNewProjectOpen, setLocalIsNewProjectOpen] = useState(false);
  
  const isNewProjectOpen = externalIsNewProjectOpen !== undefined ? externalIsNewProjectOpen : localIsNewProjectOpen;
  const setIsNewProjectOpen = externalSetIsNewProjectOpen || setLocalIsNewProjectOpen;
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [highlightArchive, setHighlightArchive] = useState(false);
  const archiveRef = useRef<HTMLDivElement>(null);

  const emptyMeeting: NewMeetingDraft = {
    name: 'Встреча',
    meeting_date: todayLocalDate(),
    meeting_time: '12:00',
    duration: 60,
    address: '',
    description: '',
    custom_reminder_at: '',
  };
  const [newMeeting, setNewMeeting] = useState<NewMeetingDraft>(emptyMeeting);
  const [meetings, setMeetings] = useState<Meeting[]>([]);

  const reloadMeetings = useCallback(async () => {
    if (!client) return;
    const list = await fetchMeetings(client.id);
    setMeetings(list);
  }, [client]);

  useEffect(() => {
    reloadMeetings();
  }, [reloadMeetings]);

  const handleAddMeeting = useCallback(async () => {
    if (!client) {
      toast.error('Не удалось определить клиента');
      return;
    }
    if (!newMeeting.meeting_date) {
      toast.error('Укажите дату встречи');
      return;
    }
    const notifyToast = toast.loading('Создаём встречу и отправляем уведомления...');
    const result = await createMeeting(client.id, newMeeting, !!client.phone || !!client.telegram_chat_id, true);
    toast.dismiss(notifyToast);
    if (result.ok) {
      toast.success('Встреча создана', {
        description: 'Уведомления отправлены клиенту и вам',
        duration: 6000,
      });
      setNewMeeting(emptyMeeting);
      reloadMeetings();
    } else {
      toast.error('Не удалось создать встречу', { description: result.error });
    }
  }, [client, newMeeting, reloadMeetings]);

  const handleMeetingSave = useCallback(async (id: number, updates: Partial<Meeting>) => {
    const notifyToast = toast.loading('Сохраняем и уведомляем клиента...');
    const ok = await updateMeeting(id, {
      ...updates,
      notification_type: 'reschedule',
      notify_client: !!(client?.phone || client?.telegram_chat_id),
    });
    toast.dismiss(notifyToast);
    if (ok) {
      toast.success('Встреча обновлена');
      reloadMeetings();
    } else {
      toast.error('Не удалось обновить встречу');
    }
  }, [client, reloadMeetings]);

  const handleMeetingCancel = useCallback(async (id: number, reason: string) => {
    const notifyToast = toast.loading('Отменяем встречу...');
    const ok = await updateMeeting(id, {
      status: 'cancelled',
      cancel_reason: reason,
      notification_type: 'cancellation',
      notify_client: !!(client?.phone || client?.telegram_chat_id),
    });
    toast.dismiss(notifyToast);
    if (ok) {
      toast.success('Встреча отменена, клиент уведомлён');
      reloadMeetings();
    } else {
      toast.error('Не удалось отменить встречу');
    }
  }, [client, reloadMeetings]);

  const handleMeetingDelete = useCallback(async (id: number) => {
    const ok = await deleteMeeting(id);
    if (ok) {
      toast.success('Встреча удалена');
      reloadMeetings();
    } else {
      toast.error('Не удалось удалить встречу');
    }
  }, [reloadMeetings]);

  const activeMeetings = meetings.filter((m) => m.status !== 'cancelled');
  const cancelledMeetings = meetings.filter((m) => m.status === 'cancelled');

  const activeProjects = projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled');
  const archivedProjects = projects.filter(p => p.status === 'completed' || p.status === 'cancelled');

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
  
  const updateProjectShootingStyleRef = useRef(updateProjectShootingStyle);
  useEffect(() => {
    updateProjectShootingStyleRef.current = updateProjectShootingStyle;
  }, [updateProjectShootingStyle]);
  
  const handleShootingStyleChange = useCallback((projectId: number, styleId: string) => {
    console.log('[ClientDetailProjects] handleShootingStyleChange called:', { projectId, styleId });
    updateProjectShootingStyleRef.current(projectId, styleId);
    setSelectorKeys(prev => ({ ...prev, [projectId]: (prev[projectId] || 0) + 1 }));
  }, []);

  const handleSaveProjectChanges = useCallback(
    async (projectId: number, updates: Partial<Project>, notifyClient: boolean = false) => {
      if (!updates || Object.keys(updates).length === 0) return;

      const hasStatusChange = 'status' in updates;
      const hasStyleChange = 'shootingStyleId' in updates;
      const hasDateChange = 'startDate' in updates;
      const newStatus = updates.status;

      // Стиль обрабатываем отдельным локальным обновлением (для пересборки селектора).
      const updatesForMain: Partial<Project> = { ...updates };
      if (hasStyleChange) delete updatesForMain.shootingStyleId;
      if (hasStyleChange && updates.shootingStyleId !== undefined) {
        handleShootingStyleChange(projectId, updates.shootingStyleId as string);
      }

      // При смене даты дописываем историю переносов, не теряя её.
      if (hasDateChange && updates.startDate !== undefined) {
        const current = projects.find((p) => p.id === projectId);
        if (current && current.startDate !== updates.startDate) {
          updatesForMain.dateHistory = [
            ...(current.dateHistory || []),
            { oldDate: current.startDate, newDate: updates.startDate as string, changedAt: new Date().toISOString() },
          ];
        }
      }

      // При завершении/отмене проставляем дату завершения и чистим событие календаря.
      if (hasStatusChange && (newStatus === 'completed' || newStatus === 'cancelled')) {
        if (!('endDate' in updatesForMain)) {
          updatesForMain.endDate = new Date().toISOString();
        }
        try {
          const CALENDAR_API = 'https://functions.poehali.dev/fc049737-8d51-4e98-95e4-c1dd7f6e6c2c';
          const uid = localStorage.getItem('userId');
          await fetch(CALENDAR_API, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json', 'X-User-Id': uid || '' },
            body: JSON.stringify({ project_id: projectId }),
          });
        } catch (e) {
          console.error('[Project] calendar cleanup error', e);
        }
      }

      // Единый вызов сохранения со ВСЕМИ полями (status, cancel_reason, endDate и пр.),
      // чтобы ничего не перетиралось повторным sync.
      await handleUpdateProject(projectId, updatesForMain, notifyClient);
    },
    [handleUpdateProject, handleShootingStyleChange, projects]
  );

  const handleDirtyChange = useCallback(
    (projectId: number, dirty: boolean) => {
      onProjectDirtyChange?.(projectId, dirty);
    },
    [onProjectDirtyChange]
  );

  const handleResendNotifications = useCallback(async (projectId: number) => {
    if (!client) {
      toast.error('Не удалось определить клиента');
      return;
    }
    const project = projects.find(p => p.id === projectId);
    if (!project) {
      toast.error('Проект не найден');
      return;
    }
    if (!project.startDate) {
      toast.error('У проекта не указана дата съёмки');
      return;
    }
    const notifyToast = toast.loading('Переотправляем уведомления...');
    try {
      const projectForNotify = {
        ...project,
        shooting_time: project.shooting_time || '10:00',
      };
      const report = await sendProjectNotification(client, projectForNotify, photographerName || 'Фотограф');

      const icon = (s: 'sent' | 'failed' | 'skipped') =>
        s === 'sent' ? '✅' : s === 'failed' ? '❌' : '⚪️';
      const label = (s: 'sent' | 'failed' | 'skipped', reason?: string) =>
        s === 'sent' ? 'отправлено'
        : s === 'failed' ? `ошибка${reason ? ` (${reason})` : ''}`
        : reason ? `пропущено (${reason})` : 'пропущено';

      const lines = [
        `${icon(report.whatsappClient)} Клиенту в MAX: ${label(report.whatsappClient, report.reasons.whatsappClient)}`,
        `${icon(report.whatsappPhotographer)} Фотографу в MAX/Telegram: ${label(report.whatsappPhotographer, report.reasons.whatsappPhotographer)}`,
        `${icon(report.email)} Клиенту на email: ${label(report.email, report.reasons.email)}`,
      ];
      const summary = lines.join('\n');

      const anySent = [report.whatsappClient, report.whatsappPhotographer, report.email].includes('sent');
      const anyFailed = [report.whatsappClient, report.whatsappPhotographer, report.email].includes('failed');

      toast.dismiss(notifyToast);
      if (anySent && !anyFailed) {
        toast.success('Уведомления переотправлены', { description: summary, duration: 8000 });
      } else if (anySent && anyFailed) {
        toast.warning('Уведомления отправлены частично', { description: summary, duration: 10000 });
      } else if (anyFailed) {
        toast.error('Не удалось отправить уведомления', { description: summary, duration: 10000 });
      } else {
        toast.info('Уведомления не отправлялись', { description: summary, duration: 8000 });
      }
    } catch (error) {
      toast.dismiss(notifyToast);
      toast.error('Ошибка отправки уведомлений');
      console.error('[Resend Notifications] Error:', error);
    }
  }, [client, projects, photographerName]);

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

      {archivedProjects.length > 0 && (
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
      )}

      {(activeMeetings.length > 0 || cancelledMeetings.length > 0) && (
        <div className="mt-6 space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-violet-600 dark:text-violet-400">
            <Icon name="Handshake" size={16} />
            Встречи
            <Badge variant="secondary" className="text-xs">{activeMeetings.length}</Badge>
          </div>
          {activeMeetings.map((m) => (
            <MeetingCard
              key={`meeting-${m.id}`}
              meeting={m}
              onSave={handleMeetingSave}
              onCancel={handleMeetingCancel}
              onDelete={handleMeetingDelete}
            />
          ))}
          {cancelledMeetings.length > 0 && (
            <div className="pt-1 space-y-2">
              <div className="text-xs text-muted-foreground">Отменённые встречи</div>
              {cancelledMeetings.map((m) => (
                <MeetingCard
                  key={`meeting-${m.id}`}
                  meeting={m}
                  onSave={handleMeetingSave}
                  onCancel={handleMeetingCancel}
                  onDelete={handleMeetingDelete}
                />
              ))}
            </div>
          )}
        </div>
      )}
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