import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { registerServiceWorker } from './registerSW.ts'
import { initInstallPromptCapture } from './lib/installPwa.ts'

// Tangkap event install PWA sejak awal (bisa muncul sebelum halaman /install dibuka)
initInstallPromptCapture();

createRoot(document.getElementById("root")!).render(<App />);

// Aktifkan PWA (service worker) pada build produksi
registerServiceWorker();
