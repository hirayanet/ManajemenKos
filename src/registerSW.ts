// Registrasi Service Worker untuk PWA.
// Hanya diaktifkan pada build produksi (import.meta.env.PROD) agar tidak
// mengganggu HMR / dev server, dan hanya pada koneksi aman (https/localhost).
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;
  if (
    location.protocol !== "https:" &&
    location.hostname !== "localhost" &&
    location.hostname !== "127.0.0.1"
  ) {
    return;
  }

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .catch((err) => {
        console.error("Gagal mendaftarkan service worker:", err);
      });
  });
}
