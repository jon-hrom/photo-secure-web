import { useToast } from '@/hooks/use-toast';
import { createPlanHandlers } from './planHandlers';
import { createStorageHandlers } from './storageHandlers';
import { createPromoHandlers } from './promoHandlers';

export * from './types';

export const useAdminStorageAPI = (adminKey: string) => {
  const { toast } = useToast();

  const planHandlers = createPlanHandlers(adminKey, toast);
  const storageHandlers = createStorageHandlers(toast);
  const promoHandlers = createPromoHandlers(adminKey, toast);

  return {
    ...planHandlers,
    ...storageHandlers,
    ...promoHandlers,
  };
};
