import { Client, Project, Payment, Comment, Message, Refund } from '@/components/clients/ClientsTypes';
import { createAddRefundHandler, createDeleteRefundHandler } from './RefundHandlers';
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
  createDeleteAllMessagesHandler,
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
  onProjectCreated?: () => void,
  refunds?: Refund[],
  newRefund?: { paymentId: string; projectId: string; amount: string; reason: string; type: string; method: string; date: string },
  setNewRefund?: (refund: { paymentId: string; projectId: string; amount: string; reason: string; type: string; method: string; date: string }) => void,
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

  const handleDeleteAllMessages = createDeleteAllMessagesHandler(
    localClient,
    onUpdate
  );

  const getStatusBadge = createStatusBadgeGetter();
  const getPaymentStatusBadge = createPaymentStatusBadgeGetter();
  const updateProjectStatus = createUpdateProjectStatusHandler(localClient, projects, onUpdate);
  const updateProjectDate = createUpdateProjectDateHandler(localClient, projects, onUpdate);
  const updateProjectShootingStyle = createUpdateProjectShootingStyleHandler(localClient, projects, onUpdate);
  const handleDocumentUploaded = createDocumentUploadedHandler(localClient, onUpdate);
  const handleDocumentDeleted = createDocumentDeletedHandler(localClient, onUpdate);
  const actualRefunds = refunds || [];
  const handleAddRefund = newRefund && setNewRefund
    ? createAddRefundHandler(localClient, payments, actualRefunds, newRefund, setNewRefund, onUpdate)
    : () => {};
  const handleDeleteRefund = createDeleteRefundHandler(localClient, actualRefunds, onUpdate);

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
    handleDeleteAllMessages,
    handleAddRefund,
    handleDeleteRefund,
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