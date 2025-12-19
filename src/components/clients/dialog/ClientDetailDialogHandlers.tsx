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
} from './ClientHandlers';

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
  photographerName: string
) => {
  const handleAddProject = createAddProjectHandler(
    localClient,
    projects,
    newProject,
    setNewProject,
    onUpdate,
    photographerName
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
    onUpdate
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
  };
};
