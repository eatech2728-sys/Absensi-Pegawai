import { Employee, WebAuthnCredentialRecord } from '../types';

/**
 * Web Authentication API (WebAuthn) Module
 * 
 * Provides device biometric authentication (Fingerprint, Face ID / Windows Hello, Touch ID)
 * via navigator.credentials using FIDO2 / WebAuthn standards.
 */

const STORAGE_PREFIX = 'presensi_webauthn_cred_';

/**
 * Convert an ArrayBuffer to a Base64URL string
 */
export function bufferToBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Convert a Base64URL string to a Uint8Array buffer
 */
export function base64UrlToBuffer(base64url: string): Uint8Array {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Check if the browser supports the Web Authentication API
 */
export function isWebAuthnSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    !!window.PublicKeyCredential &&
    typeof navigator?.credentials?.create === 'function' &&
    typeof navigator?.credentials?.get === 'function'
  );
}

/**
 * Check if the current environment is running inside an iframe
 */
export function isRunningInIframe(): boolean {
  try {
    return typeof window !== 'undefined' && window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Check if the device has a platform authenticator available
 * (Touch ID, Face ID, Windows Hello, Android Biometrics)
 */
export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isWebAuthnSupported()) {
    return false;
  }

  try {
    if (typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
      const available = await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
      return available;
    }
  } catch (err) {
    console.warn('[WebAuthn] Platform authenticator check failed:', err);
  }

  return false;
}

/**
 * Retrieve a stored WebAuthn credential record for an employee
 */
export function getStoredCredential(employeeId: string): WebAuthnCredentialRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${employeeId}`);
    if (!raw) return null;
    return JSON.parse(raw) as WebAuthnCredentialRecord;
  } catch (err) {
    console.error('[WebAuthn] Failed to read stored credential:', err);
    return null;
  }
}

/**
 * Store a WebAuthn credential record for an employee
 */
export function saveStoredCredential(record: WebAuthnCredentialRecord): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${record.employeeId}`, JSON.stringify(record));
  } catch (err) {
    console.error('[WebAuthn] Failed to save credential:', err);
  }
}

/**
 * Remove a stored WebAuthn credential
 */
export function removeStoredCredential(employeeId: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(`${STORAGE_PREFIX}${employeeId}`);
  } catch (err) {
    console.error('[WebAuthn] Failed to remove credential:', err);
  }
}

/**
 * Detect platform device label for informative UI badges
 */
export function getPlatformDeviceLabel(): string {
  if (typeof navigator === 'undefined') return 'Sensor Biometrik Perangkat';
  const ua = navigator.userAgent;
  if (/Macintosh|iPhone|iPad/i.test(ua)) {
    return /iPhone|iPad/i.test(ua) ? 'Face ID / Touch ID (iOS)' : 'Touch ID (Apple Mac)';
  }
  if (/Windows/i.test(ua)) {
    return 'Windows Hello (Wajah / Sidik Jari)';
  }
  if (/Android/i.test(ua)) {
    return 'Sensor Biometrik Android (Fingerprint / Face)';
  }
  return 'Sensor Biometrik Perangkat (FIDO2/WebAuthn)';
}

export interface WebAuthnAuthResult {
  success: boolean;
  method: 'WEBAUTHN_BIOMETRIC' | 'BIOMETRIC_SIMULATION';
  credentialId?: string;
  authenticatorLabel?: string;
  message: string;
  error?: string;
  isIframeIssue?: boolean;
}

/**
 * Register a new WebAuthn credential on the employee's device
 * (Biometric Enrollment)
 */
export async function registerWebAuthnCredential(employee: Employee): Promise<WebAuthnAuthResult> {
  if (!isWebAuthnSupported()) {
    return {
      success: false,
      method: 'WEBAUTHN_BIOMETRIC',
      message: 'Browser Anda tidak mendukung Web Authentication API (WebAuthn).',
      error: 'NOT_SUPPORTED',
    };
  }

  // Create a 32-byte cryptographic random challenge
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  // Encode user identifier
  const userId = new TextEncoder().encode(employee.id);

  // Relying Party configuration
  const hostname = window.location.hostname || 'localhost';
  const rpName = 'Sistem Presensi Pegawai GPS';

  const creationOptions: PublicKeyCredentialCreationOptions = {
    challenge,
    rp: {
      name: rpName,
      id: hostname === 'localhost' ? undefined : hostname,
    },
    user: {
      id: userId,
      name: employee.nip,
      displayName: employee.name,
    },
    pubKeyCredParams: [
      { alg: -7, type: 'public-key' },   // ES256 (ECDSA w/ SHA-256)
      { alg: -257, type: 'public-key' }, // RS256 (RSASSA-PKCS1-v1_5 w/ SHA-256)
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform', // Hardware device biometric (Touch ID, Face ID, Windows Hello)
      userVerification: 'required',        // Biometric / Device PIN required
      residentKey: 'preferred',
    },
    timeout: 60000,
    attestation: 'none',
  };

  try {
    const credential = (await navigator.credentials.create({
      publicKey: creationOptions,
    })) as PublicKeyCredential | null;

    if (!credential) {
      return {
        success: false,
        method: 'WEBAUTHN_BIOMETRIC',
        message: 'Otentikasi dibatalkan atau tidak menghasilkan kredensial.',
        error: 'NO_CREDENTIAL_RETURNED',
      };
    }

    const rawIdBase64 = bufferToBase64Url(credential.rawId);
    const deviceLabel = getPlatformDeviceLabel();

    const record: WebAuthnCredentialRecord = {
      credentialId: credential.id,
      rawIdBase64,
      employeeId: employee.id,
      employeeNip: employee.nip,
      employeeName: employee.name,
      registeredAt: new Date().toISOString(),
      deviceLabel,
    };

    saveStoredCredential(record);

    return {
      success: true,
      method: 'WEBAUTHN_BIOMETRIC',
      credentialId: credential.id,
      authenticatorLabel: deviceLabel,
      message: `Biometrik perangkat (${deviceLabel}) berhasil didaftarkan dan diverifikasi untuk ${employee.name}.`,
    };
  } catch (err: unknown) {
    console.error('[WebAuthn] Registration error:', err);
    return handleWebAuthnError(err);
  }
}

/**
 * Verify employee identity using WebAuthn (Assertion Ceremony)
 * If no credential exists yet, it registers one automatically.
 */
export async function verifyWebAuthnCredential(employee: Employee): Promise<WebAuthnAuthResult> {
  if (!isWebAuthnSupported()) {
    return {
      success: false,
      method: 'WEBAUTHN_BIOMETRIC',
      message: 'Browser tidak mendukung Web Authentication API.',
      error: 'NOT_SUPPORTED',
    };
  }

  const storedCredential = getStoredCredential(employee.id);

  // If no credential is registered yet, perform registration ceremony first
  if (!storedCredential) {
    return registerWebAuthnCredential(employee);
  }

  // Create a 32-byte cryptographic random challenge
  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const hostname = window.location.hostname || 'localhost';

  const requestOptions: PublicKeyCredentialRequestOptions = {
    challenge,
    rpId: hostname === 'localhost' ? undefined : hostname,
    userVerification: 'required',
    allowCredentials: [
      {
        id: base64UrlToBuffer(storedCredential.rawIdBase64),
        type: 'public-key',
        transports: ['internal'],
      },
    ],
    timeout: 60000,
  };

  try {
    const assertion = (await navigator.credentials.get({
      publicKey: requestOptions,
    })) as PublicKeyCredential | null;

    if (!assertion) {
      return {
        success: false,
        method: 'WEBAUTHN_BIOMETRIC',
        message: 'Verifikasi biometrik dibatalkan.',
        error: 'NO_ASSERTION',
      };
    }

    const deviceLabel = storedCredential.deviceLabel || getPlatformDeviceLabel();

    return {
      success: true,
      method: 'WEBAUTHN_BIOMETRIC',
      credentialId: assertion.id,
      authenticatorLabel: deviceLabel,
      message: `Identitas ${employee.name} (${employee.nip}) terverifikasi via biometrik perangkat (${deviceLabel}).`,
    };
  } catch (err: unknown) {
    console.error('[WebAuthn] Verification error:', err);
    return handleWebAuthnError(err);
  }
}

/**
 * Helper to handle and format WebAuthn exceptions
 */
function handleWebAuthnError(err: unknown): WebAuthnAuthResult {
  const errorObj = err as Error | undefined;
  const errorName = errorObj?.name || 'Error';
  const errorMessage = errorObj?.message || 'Terjadi kesalahan otentikasi.';

  const isIframe = isRunningInIframe();

  if (errorName === 'NotAllowedError') {
    if (isIframe && (errorMessage.includes('permissions policy') || errorMessage.includes('document is not allowed'))) {
      return {
        success: false,
        method: 'WEBAUTHN_BIOMETRIC',
        isIframeIssue: true,
        message: 'Browser membatasi akses WebAuthn di dalam pratinjau iFrame. Silakan buka aplikasi di tab baru untuk biometrik perangkat langsung, atau gunakan mode simulasi biometrik.',
        error: 'IFRAME_PERMISSION_POLICY',
      };
    }
    return {
      success: false,
      method: 'WEBAUTHN_BIOMETRIC',
      message: 'Pemindaian biometrik dibatalkan oleh pengguna atau waktu verifikasi habis.',
      error: 'NOT_ALLOWED_CANCELED',
    };
  }

  if (errorName === 'SecurityError') {
    return {
      success: false,
      method: 'WEBAUTHN_BIOMETRIC',
      isIframeIssue: isIframe,
      message: 'Batasan keamanan domain (Origin mismatch). Buka aplikasi langsung di tab baru.',
      error: 'SECURITY_ERROR',
    };
  }

  if (errorName === 'NotSupportedError') {
    return {
      success: false,
      method: 'WEBAUTHN_BIOMETRIC',
      message: 'Perangkat atau browser tidak mendukung fitur otentikasi biometrik ini.',
      error: 'NOT_SUPPORTED',
    };
  }

  return {
    success: false,
    method: 'WEBAUTHN_BIOMETRIC',
    isIframeIssue: isIframe,
    message: `Gagal verifikasi biometrik: ${errorMessage}`,
    error: errorName,
  };
}
