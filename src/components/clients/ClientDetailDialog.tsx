import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs } from '@/components/ui/tabs';
import { Client } from '@/components/clients/ClientsTypes';
import Icon from '@/components/ui/icon';
import ClientDialogHeader from '@/components/clients/dialog/ClientDialogHeader';
import ClientDialogTabs from '@/components/clients/dialog/ClientDialogTabs';
import ClientDialogContent from '@/components/clients/dialog/ClientDialogContent';
import { useClientDetailState } from '@/components/clients/dialog/ClientDetailDialogState';
import { useClientDetailHandlers } from '@/components/clients/dialog/ClientDetailDialogHandlers';
import UnsavedProjectDialog from '@/components/clients/UnsavedProjectDialog';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { todayLocalDate } from '@/utils/dateFormat';
import { toast } from 'sonner';

interface ClientDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onUpdate: (client: Client) => void;
  shouldOpenNewProjectForm?: boolean;
  onNewProjectFormOpened?: () => void;
}

const ClientDetailDialog = ({ open, onOpenChange, client, onUpdate, shouldOpenNewProjectForm, onNewProjectFormOpened }: ClientDetailDialogProps) => {
  const [isUnsavedProjectDialogOpen, setIsUnsavedProjectDialogOpen] = useState(false);
  const [shouldShowProjectWarning, setShouldShowProjectWarning] = useState(false);
  const [dirtyProjects, setDirtyProjects] = useState<Record<number, boolean>>({});
  const [unsavedAlert, setUnsavedAlert] = useState<
    | { kind: 'close' }
    | { kind: 'tab'; target: string }
    | null
  >(null);

  const hasUnsavedProjectChanges = useMemo(
    () => Object.values(dirtyProjects).some(Boolean),
    [dirtyProjects]
  );

  const handleProjectDirtyChange = useCallback((projectId: number, dirty: boolean) => {
    setDirtyProjects((prev) => {
      const wasDirty = !!prev[projectId];
      if (wasDirty === dirty) return prev;
      const next = { ...prev };
      if (dirty) next[projectId] = true;
      else delete next[projectId];
      return next;
    });
  }, []);

  const handleBlockedNavigation = useCallback(() => {
    toast.warning('Сначала сохраните изменения в проекте или отмените их');
  }, []);

  const {
    tabs,
    activeTab,
    setActiveTab,
    showSwipeHint,
    photographerPhone,
    photographerName,
    newProject,
    setNewProject,
    newPayment,
    setNewPayment,
    newRefund,
    setNewRefund,
    newComment,
    setNewComment,
    newMessage,
    setNewMessage,
    isNewProjectOpen,
    setIsNewProjectOpen,
    localClient,
    setLocalClient,
    loadProjectData,
    clearProjectData,
    clearOpenCardData
  } = useClientDetailState(client, open);

  useEffect(() => {
    if (open && client?.id && activeTab === 'projects') {
      const saved = loadProjectData(client.id);
      if (saved && (saved.name || saved.budget || saved.description) && !shouldShowProjectWarning) {
        setIsUnsavedProjectDialogOpen(true);
        setShouldShowProjectWarning(true);
      }
    }
  }, [open, client?.id, activeTab, loadProjectData, shouldShowProjectWarning]);

  useEffect(() => {
    if (!open) {
      setShouldShowProjectWarning(false);
      setDirtyProjects({});
      setUnsavedAlert(null);
    }
  }, [open]);

  useEffect(() => {
    if (!hasUnsavedProjectChanges) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [hasUnsavedProjectChanges]);

  useEffect(() => {
    if (open && shouldOpenNewProjectForm) {
      setActiveTab('projects');
      setIsNewProjectOpen(true);
      onNewProjectFormOpened?.();
    }
  }, [open, shouldOpenNewProjectForm, setActiveTab, setIsNewProjectOpen, onNewProjectFormOpened]);

  if (!localClient) return null;

  const projects = localClient.projects || [];
  const documents = localClient.documents || [];
  const payments = localClient.payments || [];
  const refunds = localClient.refunds || [];
  const messages = localClient.messages || [];
  const comments = localClient.comments || [];

  const {
    handleAddProject,
    handleAddPayment,
    handleAddComment,
    handleAddMessage,
    handleUpdateProject,
    handleDeleteProject,
    handleDeletePayment,
    handleDeleteComment,
    handleDeleteMessage,
    handleDeleteAllMessages,
    handleAddRefund,
    handleDeleteRefund,
    updateProjectStatus,
    updateProjectDate,
    updateProjectShootingStyle,
    handleDocumentUploaded,
    handleDocumentDeleted,
    getStatusBadge,
    getPaymentStatusBadge,
    formatDate,
    formatDateTime,
  } = useClientDetailHandlers(
    localClient,
    projects,
    payments,
    comments,
    messages,
    newProject,
    setNewProject,
    newPayment,
    setNewPayment,
    newComment,
    setNewComment,
    newMessage,
    setNewMessage,
    onUpdate,
    photographerName,
    () => {
      clearProjectData(localClient.id);
      clearOpenCardData(localClient.id);
    },
    refunds,
    newRefund,
    setNewRefund,
  );

  const guardedOnOpenChange = (next: boolean) => {
    if (!next && hasUnsavedProjectChanges) {
      setUnsavedAlert({ kind: 'close' });
      return;
    }
    onOpenChange(next);
  };

  const guardedSetActiveTab = (tab: string) => {
    if (tab === activeTab) return;
    if (hasUnsavedProjectChanges) {
      setUnsavedAlert({ kind: 'tab', target: tab });
      return;
    }
    setActiveTab(tab);
  };

  return (
    <Dialog open={open} onOpenChange={guardedOnOpenChange}>
      <DialogContent className="max-w-4xl w-full h-[100dvh] sm:h-[90vh] max-h-[100dvh] sm:max-h-[90vh] rounded-none sm:rounded-lg p-0 flex flex-col overflow-hidden gap-0">
        <Tabs value={activeTab} onValueChange={guardedSetActiveTab} className="flex flex-col h-full min-h-0">
          <div className="flex-shrink-0 safe-top">
            <ClientDialogHeader 
              localClient={localClient} 
              onUpdate={onUpdate}
              setLocalClient={setLocalClient}
            />
            <ClientDialogTabs activeTab={activeTab} />
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden safe-bottom bg-background scroll-smooth scrollbar-visible overscroll-contain">
            <ClientDialogContent
              localClient={localClient}
              projects={projects}
              documents={documents}
              payments={payments}
              messages={messages}
              comments={comments}
              newProject={newProject}
              setNewProject={setNewProject}
              handleAddProject={handleAddProject}
              handleDeleteProject={handleDeleteProject}
              handleUpdateProject={handleUpdateProject}
              updateProjectStatus={updateProjectStatus}
              updateProjectDate={updateProjectDate}
              updateProjectShootingStyle={updateProjectShootingStyle}
              getStatusBadge={getStatusBadge}
              formatDate={formatDate}
              newPayment={newPayment}
              setNewPayment={setNewPayment}
              handleAddPayment={handleAddPayment}
              handleDeletePayment={handleDeletePayment}
              getPaymentStatusBadge={getPaymentStatusBadge}
              refunds={refunds}
              newRefund={newRefund}
              setNewRefund={setNewRefund}
              handleAddRefund={handleAddRefund}
              handleDeleteRefund={handleDeleteRefund}
              newComment={newComment}
              setNewComment={setNewComment}
              handleAddComment={handleAddComment}
              handleDeleteComment={handleDeleteComment}
              formatDateTime={formatDateTime}
              handleDocumentUploaded={handleDocumentUploaded}
              handleDocumentDeleted={handleDocumentDeleted}
              newMessage={newMessage}
              setNewMessage={setNewMessage}
              handleAddMessage={handleAddMessage}
              handleDeleteMessage={handleDeleteMessage}
              handleDeleteAllMessages={handleDeleteAllMessages}
              photographerName={photographerName}
              showSwipeHint={showSwipeHint}
              tabs={tabs}
              activeTab={activeTab}
              setActiveTab={guardedSetActiveTab}
              isNewProjectOpen={isNewProjectOpen}
              setIsNewProjectOpen={setIsNewProjectOpen}
              onProjectDirtyChange={handleProjectDirtyChange}
              hasUnsavedProjectChanges={hasUnsavedProjectChanges}
              onBlockedNavigation={handleBlockedNavigation}
            />
          </div>
        </Tabs>
      </DialogContent>

      <Dialog
        open={unsavedAlert !== null}
        onOpenChange={(o) => { if (!o) setUnsavedAlert(null); }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] max-w-lg sm:max-w-xl p-5 sm:p-6">
          <DialogHeader>
            <DialogTitle className="flex items-start gap-2 text-base sm:text-lg leading-tight pr-4">
              <Icon name="AlertTriangle" size={20} className="text-orange-500 shrink-0 mt-0.5" />
              <span>У вас остались несохранённые данные</span>
            </DialogTitle>
            <DialogDescription asChild>
              <div className="space-y-2 pt-2 text-sm text-muted-foreground break-words">
                <p>
                  Вы изменили данные проекта, но не нажали кнопку <b className="text-foreground">«Сохранить изменения»</b>.
                </p>
                <p>
                  Если уйти сейчас — изменения не попадут в базу, и клиент не получит уведомление.
                </p>
                <p>
                  Нажмите «Остаться», вернитесь в карточку проекта и нажмите «Сохранить» — все правки уйдут в базу, а клиенту придёт одно общее сообщение об изменениях.
                </p>
              </div>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-2">
            <Button
              variant="outline"
              onClick={() => setUnsavedAlert(null)}
              className="w-full sm:w-auto"
            >
              Остаться и сохранить
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (!unsavedAlert) return;
                if (unsavedAlert.kind === 'close') {
                  setDirtyProjects({});
                  setUnsavedAlert(null);
                  onOpenChange(false);
                } else {
                  setDirtyProjects({});
                  const target = unsavedAlert.target;
                  setUnsavedAlert(null);
                  setActiveTab(target);
                }
              }}
              className="w-full sm:w-auto"
            >
              Отменить изменения и уйти
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <UnsavedProjectDialog
        open={isUnsavedProjectDialogOpen}
        onContinue={() => {
          setIsUnsavedProjectDialogOpen(false);
          setIsNewProjectOpen(true);
        }}
        onClear={() => {
          if (client?.id) {
            clearProjectData(client.id);
            setNewProject({
              name: '',
              budget: '',
              description: '',
              startDate: todayLocalDate(),
              shootingStyleId: '',
              shooting_time: '10:00',
              shooting_duration: 120,
              shooting_address: '',
              add_to_calendar: false
            });
          }
          setIsUnsavedProjectDialogOpen(false);
        }}
        onCancel={() => {
          setIsUnsavedProjectDialogOpen(false);
        }}
        projectData={client?.id ? loadProjectData(client.id) : null}
      />
    </Dialog>
  );
};

export default ClientDetailDialog;