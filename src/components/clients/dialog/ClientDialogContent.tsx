import { TabsContent } from '@/components/ui/tabs';
import Icon from '@/components/ui/icon';
import SwipeContainer from '@/components/layout/SwipeContainer';
import ClientDetailOverview from '@/components/clients/detail/ClientDetailOverview';
import ClientDetailProjects from '@/components/clients/detail/ClientDetailProjects';
import ClientDetailPayments from '@/components/clients/detail/ClientDetailPayments';
import ClientDetailDocumentsHistory from '@/components/clients/detail/ClientDetailDocumentsHistory';
import ClientDetailMessages from '@/components/clients/detail/ClientDetailMessages';
import { Client, Project, Payment, Comment, Message } from '@/components/clients/ClientsTypes';
import { Badge } from '@/components/ui/badge';

interface ClientDialogContentProps {
  localClient: Client;
  projects: Project[];
  documents: any[];
  payments: Payment[];
  messages: Message[];
  comments: Comment[];
  newProject: any;
  setNewProject: (project: any) => void;
  handleAddProject: () => void;
  handleDeleteProject: (projectId: number) => void;
  handleUpdateProject: (projectId: number, updates: Partial<Project>) => void;
  updateProjectStatus: (projectId: number, status: Project['status']) => void;
  updateProjectDate: (projectId: number, newDate: string) => void;
  updateProjectShootingStyle: (projectId: number, styleId: string) => void;
  getStatusBadge: (status: Project['status']) => JSX.Element;
  formatDate: (dateString: string) => string;
  newPayment: any;
  setNewPayment: (payment: any) => void;
  handleAddPayment: () => void;
  handleDeletePayment: (paymentId: number) => void;
  getPaymentStatusBadge: (status: Payment['status']) => JSX.Element;
  newComment: string;
  setNewComment: (comment: string) => void;
  handleAddComment: () => void;
  handleDeleteComment: (commentId: number) => void;
  formatDateTime: (dateString: string) => string;
  handleDocumentUploaded: (document: any) => void;
  handleDocumentDeleted: (documentId: number) => void;
  newMessage: any;
  setNewMessage: (message: any) => void;
  handleAddMessage: () => void;
  handleDeleteMessage: (messageId: number) => void;
  handleDeleteAllMessages?: () => void;
  photographerName: string;
  showSwipeHint: boolean;
  tabs: readonly string[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const ClientDialogContent = ({
  localClient,
  projects,
  documents,
  payments,
  messages,
  comments,
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
  newPayment,
  setNewPayment,
  handleAddPayment,
  handleDeletePayment,
  getPaymentStatusBadge,
  newComment,
  setNewComment,
  handleAddComment,
  handleDeleteComment,
  formatDateTime,
  handleDocumentUploaded,
  handleDocumentDeleted,
  newMessage,
  setNewMessage,
  handleAddMessage,
  handleDeleteMessage,
  handleDeleteAllMessages,
  photographerName,
  showSwipeHint,
  tabs,
  activeTab,
  setActiveTab,
}: ClientDialogContentProps) => {
  return (
    <div className="relative h-full">
      {showSwipeHint && (
        <>
          <div className="absolute left-4 top-1/2 -translate-y-1/2 z-50 animate-in slide-in-from-left-4 fade-in duration-700 lg:hidden pointer-events-none">
            <div className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-4 py-2 rounded-full shadow-lg">
              <Icon name="ChevronLeft" size={20} />
              <span className="text-sm font-medium">Свайпните</span>
            </div>
          </div>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 z-50 animate-in slide-in-from-right-4 fade-in duration-700 lg:hidden pointer-events-none">
            <div className="flex items-center gap-2 bg-gradient-to-r from-pink-500 to-purple-500 text-white px-4 py-2 rounded-full shadow-lg">
              <span className="text-sm font-medium">для навигации</span>
              <Icon name="ChevronRight" size={20} />
            </div>
          </div>
        </>
      )}
      <SwipeContainer
        onSwipeLeft={() => {
          const currentIndex = tabs.indexOf(activeTab as any);
          if (currentIndex > 0) {
            setActiveTab(tabs[currentIndex - 1]);
          }
        }}
        onSwipeRight={() => {
          const currentIndex = tabs.indexOf(activeTab as any);
          if (currentIndex < tabs.length - 1) {
            setActiveTab(tabs[currentIndex + 1]);
          }
        }}
      >
        <TabsContent value="overview" className="space-y-4 mt-4 px-4 pb-20 data-[state=active]:animate-in data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0 data-[state=active]:fade-in-0 data-[state=inactive]:zoom-out-95 data-[state=active]:zoom-in-95 data-[state=inactive]:slide-out-to-right-2 data-[state=active]:slide-in-from-left-2">
          <ClientDetailOverview
            projects={projects}
            payments={payments}
            comments={comments}
            newComment={newComment}
            setNewComment={setNewComment}
            handleAddComment={handleAddComment}
            handleDeleteComment={handleDeleteComment}
            formatDateTime={formatDateTime}
          />
        </TabsContent>

        <TabsContent value="projects" className="space-y-4 mt-4 px-4 pb-20 data-[state=active]:animate-in data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0 data-[state=active]:fade-in-0 data-[state=inactive]:zoom-out-95 data-[state=active]:zoom-in-95 data-[state=inactive]:slide-out-to-right-2 data-[state=active]:slide-in-from-left-2">
          <ClientDetailProjects
            key={`projects-${localClient.id}-${JSON.stringify(projects.map(p => p.shootingStyleId))}`}
            projects={projects}
            payments={payments}
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
          />
        </TabsContent>

        <TabsContent value="documents" className="space-y-4 mt-4 px-4 pb-20 data-[state=active]:animate-in data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0 data-[state=active]:fade-in-0 data-[state=inactive]:zoom-out-95 data-[state=active]:zoom-in-95 data-[state=inactive]:slide-out-to-right-2 data-[state=active]:slide-in-from-left-2">
          <ClientDetailDocumentsHistory
            documents={documents}
            messages={messages}
            payments={payments}
            client={localClient}
            formatDate={formatDate}
            formatDateTime={formatDateTime}
            tab="documents"
            clientId={localClient.id}
            onDocumentUploaded={handleDocumentUploaded}
            onDocumentDeleted={handleDocumentDeleted}
          />
        </TabsContent>

        <TabsContent value="payments" className="space-y-4 mt-4 px-4 pb-20 data-[state=active]:animate-in data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0 data-[state=active]:fade-in-0 data-[state=inactive]:zoom-out-95 data-[state=active]:zoom-in-95 data-[state=inactive]:slide-out-to-right-2 data-[state=active]:slide-in-from-left-2">
          <ClientDetailPayments
            payments={payments}
            projects={projects}
            newPayment={newPayment}
            setNewPayment={setNewPayment}
            handleAddPayment={handleAddPayment}
            handleDeletePayment={handleDeletePayment}
            getPaymentStatusBadge={getPaymentStatusBadge}
            formatDate={formatDate}
          />
        </TabsContent>

        <TabsContent value="messages" className="space-y-4 mt-4 px-4 pb-20 data-[state=active]:animate-in data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0 data-[state=active]:fade-in-0 data-[state=inactive]:zoom-out-95 data-[state=active]:zoom-in-95 data-[state=inactive]:slide-out-to-right-2 data-[state=active]:slide-in-from-left-2">
          <ClientDetailMessages
            messages={messages}
            newMessage={newMessage}
            onMessageChange={(field, value) => setNewMessage(prev => ({ ...prev, [field]: value }))}
            onAddMessage={handleAddMessage}
            onDeleteMessage={handleDeleteMessage}
            onDeleteAllMessages={handleDeleteAllMessages}
            clientName={localClient.name}
            clientId={localClient.id}
            photographerName={photographerName || 'Фотограф'}
          />
        </TabsContent>

        <TabsContent value="history" className="space-y-4 mt-4 px-4 pb-4 data-[state=active]:animate-in data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0 data-[state=active]:fade-in-0 data-[state=inactive]:zoom-out-95 data-[state=active]:zoom-in-95 data-[state=inactive]:slide-out-to-right-2 data-[state=active]:slide-in-from-left-2">
          <ClientDetailDocumentsHistory
            documents={documents}
            messages={messages}
            bookings={localClient.bookings}
            projects={projects}
            payments={payments}
            client={localClient}
            formatDate={formatDate}
            formatDateTime={formatDateTime}
            tab="history"
            clientId={localClient.id}
            onDocumentUploaded={handleDocumentUploaded}
            onDocumentDeleted={handleDocumentDeleted}
          />
        </TabsContent>
      </SwipeContainer>
    </div>
  );
};

export default ClientDialogContent;