import { useSyncExternalStore } from 'react';

export const ACCENTS = {
  indigo: 'from-indigo-300 to-indigo-500',
  violet: 'from-violet-300 to-violet-500',
  sky: 'from-sky-300 to-indigo-500',
  emerald: 'from-emerald-300 to-teal-500',
  rose: 'from-rose-300 to-fuchsia-500',
  amber: 'from-amber-300 to-orange-500',
} as const;

export type AccentKey = keyof typeof ACCENTS;

export function isAccent(value: unknown): value is AccentKey {
  return typeof value === 'string' && value in ACCENTS;
}

export interface UserProfile {
  name: string;
  email: string;
  role: string;
  organization: string;
  bio: string;
  accent: AccentKey;
}

const STORAGE_KEY = 'insightflow.profile.v1';

export const DEFAULT_PROFILE: UserProfile = {
  name: 'Guest User',
  email: '',
  role: 'Workspace member',
  organization: '',
  bio: '',
  accent: 'violet',
};

function read(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PROFILE;
    const parsed = JSON.parse(raw) as Partial<UserProfile>;
    return {
      name: typeof parsed.name === 'string' && parsed.name.trim() ? parsed.name : DEFAULT_PROFILE.name,
      email: typeof parsed.email === 'string' ? parsed.email : '',
      role: typeof parsed.role === 'string' ? parsed.role : DEFAULT_PROFILE.role,
      organization: typeof parsed.organization === 'string' ? parsed.organization : '',
      bio: typeof parsed.bio === 'string' ? parsed.bio : '',
      accent: isAccent(parsed.accent) ? parsed.accent : DEFAULT_PROFILE.accent,
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

let current: UserProfile = read();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function saveProfile(next: UserProfile): void {
  current = { ...next, name: next.name.trim() || DEFAULT_PROFILE.name };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
  } catch {
    // Storage unavailable: the profile still applies for this session
  }
  emit();
}

export function resetProfile(): void {
  current = DEFAULT_PROFILE;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  emit();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useProfile(): UserProfile {
  return useSyncExternalStore(subscribe, () => current, () => DEFAULT_PROFILE);
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const first = parts[0][0] ?? '';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}
