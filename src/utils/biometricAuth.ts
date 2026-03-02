const BIOMETRIC_CREDENTIAL_KEY = 'biometric_credential';
const BIOMETRIC_USER_KEY = 'biometric_user_data';

export interface BiometricUserData {
  userId: number;
  email: string;
  token?: string;
}

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
  return !!localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
};

export const getBiometricUserData = (): BiometricUserData | null => {
  const data = localStorage.getItem(BIOMETRIC_USER_KEY);
  if (!data) return null;
  try {
    return JSON.parse(data);
  } catch {
    return null;
  }
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
      localStorage.setItem(BIOMETRIC_CREDENTIAL_KEY, credentialId);
      localStorage.setItem(BIOMETRIC_USER_KEY, JSON.stringify(userData));
      return true;
    }
    return false;
  } catch (error) {
    console.error('[Biometric] Registration error:', error);
    return false;
  }
};

export const authenticateWithBiometric = async (): Promise<BiometricUserData | null> => {
  if (!isBiometricSupported() || !isBiometricRegistered()) return null;

  const credentialId = localStorage.getItem(BIOMETRIC_CREDENTIAL_KEY);
  if (!credentialId) return null;

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
      return getBiometricUserData();
    }
    return null;
  } catch (error) {
    console.error('[Biometric] Authentication error:', error);
    return null;
  }
};

export const removeBiometric = (): void => {
  localStorage.removeItem(BIOMETRIC_CREDENTIAL_KEY);
  localStorage.removeItem(BIOMETRIC_USER_KEY);
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