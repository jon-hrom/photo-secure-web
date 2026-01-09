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
      const res = await fetch(`${ADMIN_API}?action=delete-promo-code&id=${id}&admin_key=${adminKey}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: 'Успешно', description: 'Промокод удален' });
      refetchPromoCodes();
    } catch (error: any) {
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
