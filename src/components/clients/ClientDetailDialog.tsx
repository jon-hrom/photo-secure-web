import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Tabs } from '@/components/ui/tabs';
import { Client } from '@/components/clients/ClientsTypes';
import ClientDialogHeader from '@/components/clients/dialog/ClientDialogHeader';
import ClientDialogTabs from '@/components/clients/dialog/ClientDialogTabs';
import ClientDialogContent from '@/components/clients/dialog/ClientDialogContent';
import { useClientDetailState } from '@/components/clients/dialog/ClientDetailDialogState';
import { useClientDetailHandlers } from '@/components/clients/dialog/ClientDetailDialogHandlers';

interface ClientDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
  onUpdate: (client: Client) => void;
}

const ClientDetailDialog = ({ open, onOpenChange, client, onUpdate }: ClientDetailDialogProps) => {
  const {
    tabs,
    activeTab,
    setActiveTab,
    showSwipeHint,
    photographerPhone,
    newProject,
    setNewProject,
    newPayment,
    setNewPayment,
    newComment,
    setNewComment,
    newMessage,
    setNewMessage,
    localClient,
    setLocalClient
  } = useClientDetailState(client, open);

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
    onUpdate
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
            showSwipeHint={showSwipeHint}
            tabs={tabs}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default ClientDetailDialog;