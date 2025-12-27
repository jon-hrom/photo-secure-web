import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs } from '@/components/ui/tabs';
import { Client } from '@/components/clients/ClientsTypes';
import ClientDialogHeader from '@/components/clients/dialog/ClientDialogHeader';
import ClientDialogTabs from '@/components/clients/dialog/ClientDialogTabs';
import ClientDialogContent from '@/components/clients/dialog/ClientDialogContent';
import { useClientDetailState } from '@/components/clients/dialog/ClientDetailDialogState';
import { useClientDetailHandlers } from '@/components/clients/dialog/ClientDetailDialogHandlers';
import UnsavedProjectDialog from '@/components/clients/UnsavedProjectDialog';
import { useState, useEffect } from 'react';

interface ClientDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onUpdate: (client: Client) => void;
}

const ClientDetailDialog = ({ open, onOpenChange, client, onUpdate }: ClientDetailDialogProps) => {
  const [isUnsavedProjectDialogOpen, setIsUnsavedProjectDialogOpen] = useState(false);
  const [shouldShowProjectWarning, setShouldShowProjectWarning] = useState(false);

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
    newComment,
    setNewComment,
    newMessage,
    setNewMessage,
    localClient,
    setLocalClient,
    loadProjectData,
    clearProjectData
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
    }
  }, [open]);

  if (!localClient) return null;

  const projects = localClient.projects || [];
  const documents = localClient.documents || [];
  const payments = localClient.payments || [];
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
    () => clearProjectData(localClient.id)
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex flex-col h-full">
          <ClientDialogHeader 
            localClient={localClient} 
            onUpdate={onUpdate}
            setLocalClient={setLocalClient}
          />
          <ClientDialogTabs activeTab={activeTab} />
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
            photographerName={photographerName}
            showSwipeHint={showSwipeHint}
            tabs={tabs}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </Tabs>
      </DialogContent>

      <UnsavedProjectDialog
        open={isUnsavedProjectDialogOpen}
        onContinue={() => {
          setIsUnsavedProjectDialogOpen(false);
        }}
        onClear={() => {
          if (client?.id) {
            clearProjectData(client.id);
            setNewProject({
              name: '',
              budget: '',
              description: '',
              startDate: new Date().toISOString().split('T')[0],
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