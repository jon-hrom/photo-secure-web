// SMS Service for phone verification via backend
// Note: SMS sending happens through backend to keep API keys secure

interface SendSMSResponse {
  ok: boolean;
  error?: string;
  id?: string;
  err_code?: number;
}

/**
 * Send SMS code via backend settings function
 * Backend will use SMSRU_API_KEY from environment
 */
export async function sendSMSCode(phone: string, code: string): Promise<SendSMSResponse> {
  try {
    const text = `Foto-Mix: Ваш код подтверждения ${code}. Никому не сообщайте этот код.`;
    
    // Note: For now, we'll use a placeholder
    // You need to add SMS sending to backend/settings or create a new function
    console.log('[SMS] Would send SMS:', { phone, code });
    
    // TODO: Implement actual backend call when backend function is ready
    // For now, simulate success for testing
    return {
      ok: true,
      id: 'test-' + Date.now()
    };
    
    /* Uncomment when backend is ready:
    const response = await fetch('YOUR_BACKEND_SMS_ENDPOINT', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone, text })
    });
    
    if (!response.ok) {
      return {
        ok: false,
        error: 'Ошибка отправки SMS'
      };
    }
    
    return await response.json();
    */
  } catch (error) {
    console.error('[SMS] Error:', error);
    return {
      ok: false,
      error: 'Не удалось отправить SMS'
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
