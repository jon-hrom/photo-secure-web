const BIOMETRIC_CREDENTIAL_KEY = 'biometric_credential';
const BIOMETRIC_USER_KEY = 'biometric_user_data';
const BIOMETRIC_FAIL_KEY = 'biometric_fail_count';
const MAX_FAIL_ATTEMPTS = 5;
const FAIL_LOCKOUT_MS = 300000;

export interface BiometricUserData {
  userId: number;
  email: string;
  token?: string;
}

const isLockedOut = (): boolean => {
  const failData = localStorage.getItem(BIOMETRIC_FAIL_KEY);
  if (!failData) return false;
  try {
    const { count, lockedUntil } = JSON.parse(failData);
    if (lockedUntil && Date.now() < lockedUntil) return true;
    if (count >= MAX_FAIL_ATTEMPTS) {
      localStorage.setItem(BIOMETRIC_FAIL_KEY, JSON.stringify({
        count,
        lockedUntil: Date.now() + FAIL_LOCKOUT_MS
      }));
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

const recordFailure = (): void => {
  const failData = localStorage.getItem(BIOMETRIC_FAIL_KEY);
  let count = 0;
  if (failData) {
    try {
      const parsed = JSON.parse(failData);
      count = parsed.count || 0;
    } catch { /* ignore */ }
  }
  count++;
  const data: Record<string, number> = { count };
  if (count >= MAX_FAIL_ATTEMPTS) {
    data.lockedUntil = Date.now() + FAIL_LOCKOUT_MS;
  }
  localStorage.setItem(BIOMETRIC_FAIL_KEY, JSON.stringify(data));
};

const resetFailures = (): void => {
  localStorage.removeItem(BIOMETRIC_FAIL_KEY);
};

export const isBiometricSupported = (): boolean => {
  return !!(window.PublicKeyCredential && navigator.credentials);
};

export const checkBiometricAvailability = async (): Promise<boolean> => {
  if (!isBiometricSupported()) return false;
  try {
    const available = await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    return available;
  } catch {
    return false;
  }
};

export const isBiometricRegistered = (): boolean => {
  const cred = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
  const userData = localStorage.getItem(BIOMETRIC_USER_KEY);
  console.log('[Biometric] isRegistered check:', { hasCred: !!cred, hasUserData: !!userData });
  if (!cred || !userData) return false;
  return true;
};

export const getBiometricUserData = (): BiometricUserData | null => {
  const data = localStorage.getItem(BIOMETRIC_USER_KEY);
  if (!data) return null;
  try {
    const parsed = JSON.parse(data);
    if (!parsed.userId || !parsed.email) return null;
    return parsed;
  } catch {
    return null;
  }
};

export const updateBiometricToken = (token: string): void => {
  const data = localStorage.getItem(BIOMETRIC_USER_KEY);
  if (!data) return;
  try {
    const parsed = JSON.parse(data);
    parsed.token = token;
    localStorage.setItem(BIOMETRIC_USER_KEY, JSON.stringify(parsed));
  } catch { /* ignore */ }
};

const generateChallenge = (): Uint8Array => {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return array;
};

const bufferToBase64 = (buffer: ArrayBuffer): string => {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
};

const base64ToBuffer = (base64: string): Uint8Array => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
};

export const registerBiometric = async (userData: BiometricUserData): Promise<boolean> => {
  if (!isBiometricSupported()) return false;

  if (!userData.userId || !userData.email) return false;

  try {
    const challenge = generateChallenge();
    const userId = new TextEncoder().encode(String(userData.userId));

    const credential = await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: {
          name: document.title || 'App',
          id: window.location.hostname,
        },
        user: {
          id: userId,
          name: userData.email,
          displayName: userData.email,
        },
        pubKeyCredParams: [
          { alg: -7, type: 'public-key' },
          { alg: -257, type: 'public-key' },
        ],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
          residentKey: 'preferred',
        },
        timeout: 60000,
        attestation: 'none',
      },
    }) as PublicKeyCredential;

    if (credential) {
      const credentialId = bufferToBase64(credential.rawId);

      const safeUserData: BiometricUserData = {
        userId: userData.userId,
        email: userData.email,
        token: userData.token,
      };
      const dataStr = JSON.stringify(safeUserData);

      localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, credentialId);
      localStorage.setItem(BIOMETRIC_USER_KEY, dataStr);

      resetFailures();
      console.log('[Biometric] Registration OK. Credential saved. Email:', userData.email);
      return true;
    }
    console.warn('[Biometric] Registration: no credential returned');
    return false;
  } catch (error) {
    console.error('[Biometric] Registration error:', error);
    return false;
  }
};

export const authenticateWithBiometric = async (): Promise<BiometricUserData | null> => {
  if (!isBiometricSupported() || !isBiometricRegistered()) return null;

  if (isLockedOut()) {
    console.warn('[Biometric] Too many failed attempts, locked out');
    return null;
  }

  const credentialId = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
  if (!credentialId) return null;

  const storedData = localStorage.getItem(BIOMETRIC_USER_KEY);
  if (!storedData) return null;

  try {
    const challenge = generateChallenge();

    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: [{
          id: base64ToBuffer(credentialId),
          type: 'public-key',
          transports: ['internal'],
        }],
        userVerification: 'required',
        timeout: 60000,
      },
    });

    if (assertion) {
      resetFailures();
      return getBiometricUserData();
    }

    recordFailure();
    return null;
  } catch (error) {
    console.error('[Biometric] Authentication error:', error);
    recordFailure();
    return null;
  }
};

export const verifyTokenWithServer = async (token: string): Promise<boolean> => {
  try {
    const response = await fetch('https://functions.poehali.dev/0a1390c4-0522-4759-94b3-0bab009437a9', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({ action: 'verify_token' }),
    });
    if (response.ok) {
      const data = await response.json();
      return data.valid === true;
    }
    return false;
  } catch {
    return false;
  }
};

export const removeBiometric = (): void => {
  localStorage.removeItem(BIOMETRIC_CREDENTIAL_KEY);
  localStorage.removeItem(BIOMETRIC_USER_KEY);
  localStorage.removeItem(BIOMETRIC_FAIL_KEY);
  localStorage.removeItem('biometric_prompt_dismissed');
  localStorage.removeItem('biometric_integrity');
  localStorage.removeItem('biometric_created_at');
};

export const isBiometricEnabledSetting = (): boolean => {
  const cache = localStorage.getItem('settings_cache');
  if (cache) {
    try {
      const data = JSON.parse(cache);
      return data.biometric_enabled === true;
    } catch {
      return false;
    }
  }
  return false;
};
