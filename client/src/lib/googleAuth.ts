import { loginWithGoogle } from './profile';

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number | string;
            }
          ) => void;
          prompt: (notification?: (notification: unknown) => void) => void;
          disableAutoSelect: () => void;
        };
      };
    };
  }
}

export interface GoogleCredentialResponse {
  credential: string;
  select_by?: string;
  clientId?: string;
}

export interface GoogleAuthUser {
  id: string;
  email: string;
  name: string;
  picture?: string;
  emailVerified?: boolean;
}

const CLIENT_ID_STORAGE_KEY = 'insightflow.google_client_id.v1';

export function getStoredGoogleClientId(): string {
  try {
    return localStorage.getItem(CLIENT_ID_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredGoogleClientId(id: string): void {
  try {
    if (id.trim()) {
      localStorage.setItem(CLIENT_ID_STORAGE_KEY, id.trim());
    } else {
      localStorage.removeItem(CLIENT_ID_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

let cachedClientId: string | null = null;

export async function resolveGoogleClientId(): Promise<string> {
  if (cachedClientId) return cachedClientId;

  // 1. Env variable
  const envId = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined)?.trim();
  if (envId) {
    cachedClientId = envId;
    return envId;
  }

  // 2. Local storage
  const stored = getStoredGoogleClientId();
  if (stored) {
    cachedClientId = stored;
    return stored;
  }

  // 3. Backend /api/auth/config
  try {
    const res = await fetch('/api/auth/config');
    if (res.ok) {
      const data = await res.json();
      if (data?.googleClientId) {
        cachedClientId = data.googleClientId;
        return data.googleClientId;
      }
    }
  } catch {
    // backend might be unavailable or offline
  }

  return '';
}

/**
 * Decode JWT token payload on client as fallback or validation
 */
export function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return null;
  }
}

/**
 * Exchange Google credential with server or process locally
 */
export async function handleGoogleCredential(
  response: GoogleCredentialResponse,
  clientId?: string
): Promise<GoogleAuthUser> {
  const credential = response.credential;
  if (!credential) {
    throw new Error('No credential provided in Google response');
  }

  try {
    const res = await fetch('/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential, clientId }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        loginWithGoogle(data.user);
        return data.user;
      }
    }
  } catch (err) {
    console.warn('[GoogleAuth] Backend verification failed, using token payload fallback:', err);
  }

  // Fallback client-side JWT decoding if backend was not reachable
  const payload = decodeJwtPayload(credential);
  if (!payload || !payload.sub || !payload.email) {
    throw new Error('Unable to parse Google authentication credential');
  }

  const user: GoogleAuthUser = {
    id: String(payload.sub),
    email: String(payload.email),
    name: String(payload.name || payload.email).split('@')[0],
    picture: payload.picture ? String(payload.picture) : undefined,
    emailVerified: Boolean(payload.email_verified),
  };

  loginWithGoogle(user);
  return user;
}

/**
 * Mock sign-in for local development or demo purposes
 */
export function signInWithMockGoogle(customEmail?: string): GoogleAuthUser {
  const email = customEmail || 'alex.chen@innovatecorp.ai';
  const name = email.split('@')[0].replace('.', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  const mockUser: GoogleAuthUser = {
    id: 'google-mock-' + Date.now(),
    email,
    name,
    picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    emailVerified: true,
  };
  loginWithGoogle(mockUser);
  return mockUser;
}
