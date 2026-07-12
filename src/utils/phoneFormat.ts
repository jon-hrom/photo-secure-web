export const formatPhoneNumber = (value: string): string => {
  const cleaned = value.replace(/\D/g, '');
  
  if (cleaned.length === 0) return '';
  
  let formatted = '+7';
  if (cleaned.length > 1) {
    const digits = cleaned.startsWith('7') || cleaned.startsWith('8') ? cleaned.slice(1) : cleaned;
    
    if (digits.length > 0) formatted += ` (${digits.slice(0, 3)}`;
    if (digits.length >= 4) formatted += `) ${digits.slice(3, 6)}`;
    if (digits.length >= 7) formatted += `-${digits.slice(6, 8)}`;
    if (digits.length >= 9) formatted += `-${digits.slice(8, 10)}`;
  }
  
  return formatted;
};

export const validatePhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  const digits = cleaned.startsWith('7') || cleaned.startsWith('8') ? cleaned.slice(1) : cleaned;
  return digits.length === 10;
};

export const cleanPhoneForDB = (phone: string): string => {
  const cleaned = phone.replace(/\D/g, '');
  const digits = cleaned.startsWith('7') || cleaned.startsWith('8') ? cleaned.slice(1) : cleaned;
  return `+7${digits}`;
};

export const isValidEmail = (email: string): boolean => {
  const value = (email || '').trim();
  if (!value) return false;
  // Базовый строгий формат: есть имя, @, домен и зона
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(value)) return false;
  // Защита от ввода телефона в поле email: если из значения убрать
  // разрешённые для email символы и остаются только цифры/скобки/плюсы — это телефон
  const digitsOnly = value.replace(/[^\d]/g, '');
  if (digitsOnly.length >= 7 && !/[a-zA-Zа-яА-Я]/.test(value)) return false;
  return true;
};