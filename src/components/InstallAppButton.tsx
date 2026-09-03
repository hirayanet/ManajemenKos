import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getDeferredInstallPrompt,
  isRunningStandalone,
  subscribeInstallPrompt,
  clearDeferredInstallPrompt,
  BeforeInstallPromptEvent,
} from "@/lib/installPwa";

const INSTALLED_AT = "kosflow_installed_at";
const INSTALLED_FLAG_LEGACY = "kosflow_installed"; // versi lama (boolean "1")

// Jika aplikasi dibuka lewat browser biasa (bukan mode standalone) setelah
// terpasang, tombol muncul lagi setelah melewati masa ini — berguna bila
// pengguna menghapus aplikasinya, tapi tetap menyembunyikan tombol dalam
// waktu yang wajar bagi yang masih memasangnya.
const HIDE_AFTER_DAYS = 7;
const HIDE_AFTER_MS = HIDE_AFTER_DAYS * 24 * 60 * 60 * 1000;

function readInstalledAt(): number | null {
  try {
    let raw = localStorage.getItem(INSTALLED_AT);
    if (!raw && localStorage.getItem(INSTALLED_FLAG_LEGACY) === "1") {
      // Migrasi penanda versi lama → anggap baru terpasang sekarang
      localStorage.removeItem(INSTALLED_FLAG_LEGACY);
      localStorage.setItem(INSTALLED_AT, String(Date.now()));
      raw = localStorage.getItem(INSTALLED_AT);
    }
    const ts = raw ? parseInt(raw, 10) : NaN;
    return Number.isFinite(ts) ? ts : null;
  } catch {
    return null;
  }
}

function clearInstalledAt() {
  try {
    localStorage.removeItem(INSTALLED_AT);
    localStorage.removeItem(INSTALLED_FLAG_LEGACY);
  } catch {
    // abaikan
  }
}

function markInstalled() {
  try {
    localStorage.setItem(INSTALLED_AT, String(Date.now()));
    localStorage.removeItem(INSTALLED_FLAG_LEGACY);
  } catch {
    // abaikan
  }
}

function isInstalledNow(): boolean {
  // Berjalan sebagai aplikasi terpasang (layar penuh / standalone) → pasti terpasang
  if (isRunningStandalone()) return true;
  const ts = readInstalledAt();
  if (ts === null) return false;
  // Penanda kedaluwarsa → anggap aplikasi sudah dihapus, munculkan tombol lagi
  if (Date.now() - ts > HIDE_AFTER_MS) {
    clearInstalledAt();
    return false;
  }
  return true;
}

// Tombol "Install Aplikasi" di pojok kanan atas.
// - Muncul selama aplikasi belum terpasang (menyala otomatis saat browser
//   mengizinkan install via event `beforeinstallprompt`).
// - Hilang setelah terpasang (standalone / event `appinstalled` / user
//   menyetujui dialog install). Jika aplikasi di-uninstall, tombol muncul
//   lagi setelah HIDE_AFTER_DAYS hari saat dibuka lewat browser biasa.
export default function InstallAppButton({ className }: { className?: string }) {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(() =>
    getDeferredInstallPrompt()
  );
  const [installed, setInstalled] = useState<boolean>(() => isInstalledNow());
  const [installing, setInstalling] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const unsub = subscribeInstallPrompt((value) => {
      setPrompt(value);
      if (!value) {
        // Event `appinstalled` → aplikasi benar-benar terpasang
        setInstalled(true);
        markInstalled();
      }
    });
    return unsub;
  }, []);

  if (installed) return null;

  const handleInstall = async () => {
    const deferred = getDeferredInstallPrompt();
    if (deferred) {
      setInstalling(true);
      try {
        await deferred.prompt();
        const choice = await deferred.userChoice;
        if (choice.outcome === "accepted") {
          setInstalled(true);
          markInstalled();
          clearDeferredInstallPrompt();
        }
      } catch {
        // Dialog ditutup tanpa memilih
      } finally {
        setInstalling(false);
      }
      return;
    }

    // Belum ada event install otomatis (mis. iPhone/iPad) — buka panduan manual
    toast({
      title: "Install manual",
      description: "Perangkat ini belum menampilkan tombol install otomatis. Buka panduan langkah demi langkah.",
    });
    navigate("/install");
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleInstall}
      disabled={installing}
      className={`h-8 rounded-full border-primary/30 bg-primary/10 text-primary hover:bg-primary hover:text-white hover:border-primary text-xs font-semibold gap-1.5 shrink-0 ${className ?? ""}`}
    >
      <Download className="h-3.5 w-3.5" />
      {installing ? "Menyiapkan..." : "Install Aplikasi"}
    </Button>
  );
}
