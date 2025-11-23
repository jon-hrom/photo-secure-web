// SMS Service for phone verification via backend
const SETTINGS_API = 'https://functions.poehali.dev/7426d212-23bb-4a8c-941e-12952b14a7c0';

interface SendSMSResponse {
  ok: boolean;
  error?: string;
  id?: string;
  err_code?: number;
  credits?: number;
}

/**
 * Send verification code to phone via backend
 * Code is generated on server side for security
 */
export async function sendVerificationCode(phone: string): Promise<SendSMSResponse> {
  try {
    console.log('[SMS] Requesting verification code for:', phone);
    
    const response = await fetch(SETTINGS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        action: 'send-verification-code',
        phone
      })
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      console.error('[SMS] Error:', result.error);
      return {
        ok: false,
        error: result.error || 'Ошибка отправки SMS',
        err_code: result.err_code
      };
    }
    
    console.log('[SMS] Verification code sent');
    return result;
  } catch (error) {
    console.error('[SMS] Exception:', error);
    return {
      ok: false,
      error: 'Не удалось отправить SMS'
    };
  }
}

/**
 * Verify phone code on server side
 */
export async function verifyPhoneCode(phone: string, code: string): Promise<SendSMSResponse> {
  try {
    console.log('[SMS] Verifying code for:', phone);
    
    const response = await fetch(SETTINGS_API, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        action: 'verify-phone-code',
        phone,
        code
      })
    });
    
    const result = await response.json();
    
    if (!result.ok) {
      console.error('[SMS] Verification failed:', result.error);
      return {
        ok: false,
        error: result.error || 'Неверный код'
      };
    }
    
    console.log('[SMS] Code verified successfully');
    return result;
  } catch (error) {
    console.error('[SMS] Exception:', error);
    return {
      ok: false,
      error: 'Ошибка проверки кода'
    };
  }
}

/**
 * Generate 6-digit verification code
 */
export function generateVerificationCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Normalize phone number to format 7XXXXXXXXXX
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 11 && (digits[0] === '8' || digits[0] === '7')) {
    return '7' + digits.slice(1);
  } else if (digits.length === 10) {
    return '7' + digits;
  }
  
  return digits;
}

/**
 * Validate Russian phone number
 */
export function isValidPhone(phone: string): boolean {
  const normalized = normalizePhone(phone);
  return /^7\d{10}$/.test(normalized);
}