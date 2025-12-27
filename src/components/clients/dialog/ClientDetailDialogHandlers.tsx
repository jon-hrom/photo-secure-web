import { Client, Project, Payment, Comment, Message } from '@/components/clients/ClientsTypes';
import {
  createAddProjectHandler,
  createAddPaymentHandler,
  createAddCommentHandler,
  createAddMessageHandler,
  createUpdateProjectHandler,
  createDeleteProjectHandler,
  createDeletePaymentHandler,
  createDeleteCommentHandler,
  createDeleteMessageHandler,
  createStatusBadgeGetter,
  createPaymentStatusBadgeGetter,
  createUpdateProjectStatusHandler,
  createUpdateProjectDateHandler,
  createUpdateProjectShootingStyleHandler,
  createDocumentUploadedHandler,
  createDocumentDeletedHandler,
  createFormatDate,
  createFormatDateTime,
} from './ClientHandlers.tsx';

export const useClientDetailHandlers = (
  localClient: Client,
  projects: Project[],
  payments: Payment[],
  comments: Comment[],
  messages: Message[],
  newProject: any,
  setNewProject: (project: any) => void,
  newPayment: any,
  setNewPayment: (payment: any) => void,
  newComment: string,
  setNewComment: (comment: string) => void,
  newMessage: any,
  setNewMessage: (message: any) => void,
  onUpdate: (client: Client) => void,
  photographerName: string,
  onProjectCreated?: () => void
) => {
  const handleAddProject = createAddProjectHandler(
    localClient,
    projects,
    newProject,
    setNewProject,
    onUpdate,
    photographerName,
    onProjectCreated
  );

  const handleAddPayment = createAddPaymentHandler(
    localClient,
    projects,
    payments,
    newPayment,
    setNewPayment,
    onUpdate
  );

  const handleAddComment = createAddCommentHandler(
    localClient,
    comments,
    newComment,
    setNewComment,
    onUpdate
  );

  const handleAddMessage = createAddMessageHandler(
    localClient,
    messages,
    newMessage,
    setNewMessage,
    onUpdate
  );

  const handleUpdateProject = createUpdateProjectHandler(
    localClient,
    projects,
    onUpdate,
    photographerName
  );

  const handleDeleteProject = createDeleteProjectHandler(
    localClient,
    projects,
    payments,
    onUpdate
  );

  const handleDeletePayment = createDeletePaymentHandler(
    localClient,
    payments,
    onUpdate
  );

  const handleDeleteComment = createDeleteCommentHandler(
    localClient,
    comments,
    onUpdate
  );

  const handleDeleteMessage = createDeleteMessageHandler(
    localClient,
    messages,
    onUpdate
  );

  const getStatusBadge = createStatusBadgeGetter();
  const getPaymentStatusBadge = createPaymentStatusBadgeGetter();
  const updateProjectStatus = createUpdateProjectStatusHandler(localClient, projects, onUpdate);
  const updateProjectDate = createUpdateProjectDateHandler(localClient, projects, onUpdate);
  const updateProjectShootingStyle = createUpdateProjectShootingStyleHandler(localClient, projects, onUpdate);
  const handleDocumentUploaded = createDocumentUploadedHandler(localClient, onUpdate);
  const handleDocumentDeleted = createDocumentDeletedHandler(localClient, onUpdate);
  const formatDate = createFormatDate();
  const formatDateTime = createFormatDateTime();

  return {
    handleAddProject,
    handleAddPayment,
    handleAddComment,
    handleAddMessage,
    handleUpdateProject,
    handleDeleteProject,
    handleDeletePayment,
    handleDeleteComment,
    handleDeleteMessage,
    getStatusBadge,
    getPaymentStatusBadge,
    updateProjectStatus,
    updateProjectDate,
    updateProjectShootingStyle,
    handleDocumentUploaded,
    handleDocumentDeleted,
    formatDate,
    formatDateTime,
  };
};