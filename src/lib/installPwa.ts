// Penangkap global event install PWA. Dipanggil sekali dari main.tsx agar
// event `beforeinstallprompt` (yang bisa muncul lebih dulu sebelum halaman
// /install dibuka) tidak terlewat.
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const subscribers = new Set<(value: BeforeInstallPromptEvent | null) => void>();

function emit() {
  subscribers.forEach((fn) => fn(deferredPrompt));
}

export function initInstallPromptCapture() {
  window.addEventListener("beforeinstallprompt", (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    emit();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    emit();
  });
}

export function getDeferredInstallPrompt(): BeforeInstallPromptEvent | null {
  return deferredPrompt;
}

export function clearDeferredInstallPrompt() {
  deferredPrompt = null;
  emit();
}

export function subscribeInstallPrompt(
  fn: (value: BeforeInstallPromptEvent | null) => void
): () => void {
  subscribers.add(fn);
  return () => {
    subscribers.delete(fn);
  };
}

export function isRunningStandalone(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // Safari iOS lama
    (navigator as unknown as { standalone?: boolean }).standalone === true
  );
}
