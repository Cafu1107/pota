import { useSyncExternalStore } from 'react';

// Transient UI state shared across the shell (not persisted).
let searchOpen = false;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openSearch() {
  searchOpen = true;
  emit();
}

export function closeSearch() {
  searchOpen = false;
  emit();
}

export function useSearchOpen() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => searchOpen,
  );
}

// PWA install prompt (Chromium only).
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}
let installEvent: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent = e as BeforeInstallPromptEvent;
    installListeners.forEach((l) => l());
  });
  window.addEventListener('appinstalled', () => {
    installEvent = null;
    installListeners.forEach((l) => l());
  });
}

export function useCanInstall() {
  return useSyncExternalStore(
    (l) => {
      installListeners.add(l);
      return () => installListeners.delete(l);
    },
    () => installEvent !== null,
  );
}

export async function promptInstall() {
  if (!installEvent) return;
  await installEvent.prompt();
  await installEvent.userChoice.catch(() => undefined);
  installEvent = null;
  installListeners.forEach((l) => l());
}
