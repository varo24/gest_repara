// PIN and biometric authentication utilities — client-side only (localStorage)

export const PIN_KEY     = 'reparapro_pin_hash';
export const SESSION_KEY = 'reparapro_session';
export const BIO_KEY     = 'gestrepara_bio_cred';

const SALT = 'reparapro_salt_2025';

// ── PIN ───────────────────────────────────────────────────────────────────────

export async function hashPin(pin: string): Promise<string> {
  const data = new TextEncoder().encode(pin + SALT);
  const buf  = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export function isPinEnabled(): boolean {
  return !!localStorage.getItem(PIN_KEY);
}

export function getPinHash(): string | null {
  return localStorage.getItem(PIN_KEY);
}

export async function setPin(pin: string): Promise<void> {
  localStorage.setItem(PIN_KEY, await hashPin(pin));
}

export function clearPin(): void {
  localStorage.removeItem(PIN_KEY);
  localStorage.removeItem(BIO_KEY);
}

export async function verifyPin(pin: string): Promise<boolean> {
  const stored = getPinHash();
  if (!stored) return false;
  return (await hashPin(pin)) === stored;
}

// ── Session ───────────────────────────────────────────────────────────────────

export function saveSession(): void {
  sessionStorage.setItem(SESSION_KEY, String(Date.now()));
}

export function clearSession(): void {
  sessionStorage.removeItem(SESSION_KEY);
}

export function getSessionAge(): number {
  const t = sessionStorage.getItem(SESSION_KEY);
  return t ? Date.now() - Number(t) : Infinity;
}

// ── Biometrics (WebAuthn platform authenticator) ──────────────────────────────

function b64ToArr(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}

function arrToB64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}

export async function isBiometricAvailable(): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential) return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}

export function hasBiometricRegistered(): boolean {
  return !!localStorage.getItem(BIO_KEY);
}

export async function registerBiometric(): Promise<void> {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Gestrepara', id: location.hostname },
      user: { id: new Uint8Array(16), name: 'owner@gestrepara', displayName: 'Propietario' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required' },
      timeout: 60000,
    },
  }) as PublicKeyCredential | null;
  if (!cred) throw new Error('No credential returned');
  localStorage.setItem(BIO_KEY, arrToB64(cred.rawId));
}

export async function authenticateBiometric(): Promise<void> {
  const stored = localStorage.getItem(BIO_KEY);
  if (!stored) throw new Error('No biometric registered');
  await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      allowCredentials: [{ type: 'public-key', id: b64ToArr(stored) }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
  // If we reach here without throwing, the biometric succeeded
}
