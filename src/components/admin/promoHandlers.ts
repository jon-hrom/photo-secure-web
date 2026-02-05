import { ADMIN_API, PromoCode } from './types';

export const createPromoHandlers = (adminKey: string, toast: any) => {
  const fetchPromoCodes = async (setPromoCodes: (codes: PromoCode[]) => void) => {
    if (!adminKey) return;
    try {
      const res = await fetch(`${ADMIN_API}?action=list-promo-codes&admin_key=${adminKey}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setPromoCodes(data.promo_codes || []);
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    }
  };

  const handleCreatePromoCode = async (
    promoCode: Omit<PromoCode, 'id' | 'used_count' | 'created_at' | 'valid_from'>,
    refetchPromoCodes: () => void
  ) => {
    try {
      const res = await fetch(`${ADMIN_API}?action=create-promo-code&admin_key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(promoCode)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: 'Успешно', description: 'Промокод создан' });
      refetchPromoCodes();
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    }
  };

  const handleTogglePromoCode = async (id: number, isActive: boolean, refetchPromoCodes: () => void) => {
    try {
      const res = await fetch(`${ADMIN_API}?action=update-promo-code&admin_key=${adminKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: isActive })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: 'Успешно', description: isActive ? 'Промокод активирован' : 'Промокод деактивирован' });
      refetchPromoCodes();
    } catch (error: any) {
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    }
  };

  const handleDeletePromoCode = async (id: number, refetchPromoCodes: () => void) => {
    if (!confirm('Удалить промокод?')) return;
    try {
      console.log(`[DELETE_PROMO] Deleting promo code id=${id}`);
      const res = await fetch(`${ADMIN_API}?action=delete-promo-code&id=${id}&admin_key=${adminKey}`);
      const data = await res.json();
      console.log('[DELETE_PROMO] Response:', { status: res.status, data });
      if (!res.ok) throw new Error(data.error);
      toast({ title: 'Успешно', description: 'Промокод удален' });
      // Небольшая задержка перед обновлением списка
      setTimeout(() => {
        console.log('[DELETE_PROMO] Refetching promo codes...');
        refetchPromoCodes();
      }, 300);
    } catch (error: any) {
      console.error('[DELETE_PROMO] Error:', error);
      toast({ title: 'Ошибка', description: error.message, variant: 'destructive' });
    }
  };

  return {
    fetchPromoCodes,
    handleCreatePromoCode,
    handleTogglePromoCode,
    handleDeletePromoCode,
  };
};