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
import OverpaymentDialog from '@/components/clients/dialog/OverpaymentDialog';
import UseReserveDialog from '@/components/clients/dialog/UseReserveDialog';
import { OverpaymentRequest } from '@/components/clients/dialog/PaymentHandlers';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { todayLocalDate } from '@/utils/dateFormat';
import { toast } from 'sonner';

const PAYMENTS_API = 'https://functions.poehali.dev/dfa7acb6-e4ef-43d5-a1be-47ffcb09760f';

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
  const [overpayment, setOverpayment] = useState<OverpaymentRequest | null>(null);
  const [reservePrompt, setReservePrompt] = useState<{ projectId: number; projectName: string; budget: number } | null>(null);

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

  // Держим актуальную ссылку на loadProjectData без включения её в зависимости,
  // чтобы проверка черновика НЕ срабатывала при каждом наборе символа в форме.
  const loadProjectDataRef = useRef(loadProjectData);
  useEffect(() => {
    loadProjectDataRef.current = loadProjectData;
  }, [loadProjectData]);

  useEffect(() => {
    if (open && client?.id && activeTab === 'projects') {
      const saved = loadProjectDataRef.current(client.id);
      if (saved && (saved.name || saved.budget || saved.description) && !shouldShowProjectWarning) {
        setIsUnsavedProjectDialogOpen(true);
        setShouldShowProjectWarning(true);
      }
    }
  }, [open, client?.id, activeTab, shouldShowProjectWarning]);

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
    (created) => {
      clearProjectData(localClient.id);
      clearOpenCardData(localClient.id);
      const balance = localClient.reserveBalance ?? 0;
      if (created && balance > 0) {
        setReservePrompt({ projectId: created.id, projectName: created.name, budget: created.budget });
      }
    },
    refunds,
    newRefund,
    setNewRefund,
    (req: OverpaymentRequest) => setOverpayment(req),
  );

  const handleUseReserve = async (amount: number) => {
    if (!reservePrompt) return;
    const userId = localStorage.getItem('userId') || '';
    try {
      const res = await fetch(PAYMENTS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({
          action: 'use_reserve',
          userId,
          clientId: localClient.id,
          projectId: reservePrompt.projectId,
          amount,
          date: new Date().toISOString(),
        }),
      });
      if (res.ok) {
        toast.success(`${amount.toLocaleString('ru-RU')} ₽ списано из резерва на проект «${reservePrompt.projectName}»`);
        window.dispatchEvent(new Event('clients:refresh'));
      } else {
        toast.error('Не удалось списать резерв');
      }
    } catch (e) {
      console.error('[Reserve] use error', e);
      toast.error('Ошибка списания резерва');
    }
    setReservePrompt(null);
  };

  const persistPaymentToBackend = async (
    projectId: number,
    amount: number,
    method: string,
    date: string,
    reserveAmount: number,
  ) => {
    const userId = localStorage.getItem('userId') || '';
    try {
      const res = await fetch(PAYMENTS_API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-User-Id': userId },
        body: JSON.stringify({
          userId,
          projectId,
          amount,
          method,
          date,
          reserveAmount,
        }),
      });
      if (!res.ok) {
        toast.error('Не удалось сохранить платёж');
        return false;
      }
      window.dispatchEvent(new Event('clients:refresh'));
      return true;
    } catch (e) {
      console.error('[Payment] save error', e);
      toast.error('Ошибка сохранения платежа');
      return false;
    }
  };

  const handleReturnChange = async () => {
    if (!overpayment) return;
    const ok = await persistPaymentToBackend(
      overpayment.projectId,
      overpayment.projectRemaining,
      overpayment.method,
      overpayment.paymentDate,
      0,
    );
    if (ok) {
      toast.success(`Зачтено ${overpayment.projectRemaining.toLocaleString('ru-RU')} ₽ · сдача ${overpayment.overpayAmount.toLocaleString('ru-RU')} ₽ возвращена клиенту`);
      setNewPayment({ projectId: '', amount: '', method: 'cash', date: todayLocalDate(), splitAcrossProjects: false });
    }
    setOverpayment(null);
  };

  const handleAddToReserve = async () => {
    if (!overpayment) return;
    const ok = await persistPaymentToBackend(
      overpayment.projectId,
      overpayment.paymentAmount,
      overpayment.method,
      overpayment.paymentDate,
      overpayment.overpayAmount,
    );
    if (ok) {
      toast.success(`${overpayment.overpayAmount.toLocaleString('ru-RU')} ₽ зачислено в финансовый резерв клиента`);
      setNewPayment({ projectId: '', amount: '', method: 'cash', date: todayLocalDate(), splitAcrossProjects: false });
    }
    setOverpayment(null);
  };

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
              projects={projects}
              onTransferred={() => {
                onOpenChange(false);
                window.dispatchEvent(new Event('clients:refresh'));
              }}
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
            <Button
              variant="default"
              onClick={() => setUnsavedAlert(null)}
              className="w-full sm:w-auto"
              autoFocus
            >
              Остаться и сохранить
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

      <OverpaymentDialog
        open={overpayment !== null}
        onOpenChange={(o) => { if (!o) setOverpayment(null); }}
        paymentAmount={overpayment?.paymentAmount ?? 0}
        projectRemaining={overpayment?.projectRemaining ?? 0}
        overpayAmount={overpayment?.overpayAmount ?? 0}
        onReturnChange={handleReturnChange}
        onAddToReserve={handleAddToReserve}
      />

      <UseReserveDialog
        open={reservePrompt !== null}
        onOpenChange={(o) => { if (!o) setReservePrompt(null); }}
        reserveBalance={localClient.reserveBalance ?? 0}
        projectBudget={reservePrompt?.budget ?? 0}
        projectName={reservePrompt?.projectName ?? ''}
        onSkip={() => setReservePrompt(null)}
        onUse={handleUseReserve}
      />
    </Dialog>
  );
};

export default ClientDetailDialog;