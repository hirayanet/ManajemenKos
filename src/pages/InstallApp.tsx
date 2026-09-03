import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, Smartphone, CheckCircle, Monitor, HelpCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  getDeferredInstallPrompt,
  isRunningStandalone,
  subscribeInstallPrompt,
  clearDeferredInstallPrompt,
  BeforeInstallPromptEvent,
} from "@/lib/installPwa";

type Platform = "ios" | "android" | "desktop" | "unknown";

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const isIos =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  if (isIos) return "ios";
  if (/Android/i.test(ua)) return "android";
  if (/Windows|Macintosh|Linux|CrOS/i.test(ua)) return "desktop";
  return "unknown";
}

const guide = {
  android: [
    "Buka KOSFLOW di browser Chrome.",
    "Ketuk ikon ⋮ (tiga titik) di kanan atas.",
    "Pilih “Install aplikasi” (atau “Tambahkan ke layar utama”).",
    "Konfirmasi — ikon KOSFLOW muncul di layar utama HP.",
  ],
  ios: [
    "Buka KOSFLOW di Safari.",
    "Ketuk tombol Bagikan (⬆) di bawah.",
    "Pilih “Tambahkan ke Layar Utama”.",
    "Ketuk “Tambah” — ikon KOSFLOW muncul di layar utama.",
  ],
  desktop: [
    "Buka KOSFLOW di Chrome atau Edge.",
    "Klik ikon Install di ujung kanan address bar.",
    "Atau: menu ⋮ → “Instal KOSFLOW”.",
    "Aplikasi terbuka di jendela sendiri seperti aplikasi desktop.",
  ],
  unknown: [
    "Gunakan Chrome (Android) atau Safari (iPhone/iPad).",
    "Cari menu Install / “Tambahkan ke Layar Utama” di browser Anda.",
  ],
};

export default function InstallApp() {
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(() =>
    getDeferredInstallPrompt()
  );
  const [installed, setInstalled] = useState<boolean>(() => isRunningStandalone());
  const [installing, setInstalling] = useState(false);
  const platform = detectPlatform();
  const { toast } = useToast();

  useEffect(() => {
    const unsub = subscribeInstallPrompt((value) => {
      setPrompt(value);
      if (!value) setInstalled(true);
    });
    return unsub;
  }, []);

  const handleInstall = async () => {
    const deferred = getDeferredInstallPrompt();
    if (!deferred) {
      toast({
        title: "Install belum tersedia",
        description: "Gunakan menu browser untuk menginstal (lihat panduan di bawah).",
      });
      return;
    }
    setInstalling(true);
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
        clearDeferredInstallPrompt();
      }
    } catch {
      // Pengguna menutup dialog — tidak apa-apa
    } finally {
      setInstalling(false);
    }
  };

  const isIos = platform === "ios";
  const canPrompt = !!prompt && !isIos && !installed;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Instal Aplikasi</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pasang KOSFLOW di HP atau komputer Anda agar mudah diakses seperti aplikasi biasa.
        </p>
      </div>

      {/* Status utama */}
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div
              className={`h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center ${
                installed ? "bg-emerald-500/10 text-emerald-600" : "bg-primary/10 text-primary"
              }`}
            >
              {installed ? (
                <CheckCircle className="h-6 w-6" />
              ) : (
                <Smartphone className="h-6 w-6" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">
                {installed
                  ? "KOSFLOW sudah terpasang di perangkat Anda"
                  : platform === "unknown"
                    ? "KOSFLOW siap dipasang"
                    : isIos
                      ? "Install KOSFLOW lewat Safari"
                      : "Install KOSFLOW di perangkat Anda"}
              </p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {installed
                  ? "Buka dari ikon di layar utama — bisa dipakai tanpa internet untuk tampilan aplikasi."
                  : isIos
                    ? "iPhone/iPad memakai cara manual: Bagikan → Tambahkan ke Layar Utama (lihat langkah di bawah)."
                    : "Satu ketukan: aplikasi terpasang dengan ikon di layar utama, tampilan layar penuh, dan bisa dibuka offline."}
              </p>
            </div>
            {canPrompt && (
              <Button onClick={handleInstall} disabled={installing} className="shrink-0 w-full sm:w-auto">
                <Download className="h-4 w-4 mr-2" />
                {installing ? "Menyiapkan..." : "Install Aplikasi"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Keuntungan */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          {
            icon: Smartphone,
            title: "Ikon di layar utama",
            desc: "Buka KOSFLOW sekali ketuk, tanpa buka browser dulu.",
            tint: "bg-blue-500/10 text-blue-500",
          },
          {
            icon: Monitor,
            title: "Layar penuh",
            desc: "Tampilan bersih tanpa address bar, terasa seperti aplikasi asli.",
            tint: "bg-violet-500/10 text-violet-600",
          },
          {
            icon: CheckCircle,
            title: "Siap offline",
            desc: "Setelah pernah dibuka, aplikasi tetap bisa dijalankan tanpa internet.",
            tint: "bg-emerald-500/10 text-emerald-600",
          },
        ].map(({ icon: Icon, title, desc, tint }) => (
          <Card key={title} className="rounded-2xl shadow-sm">
            <CardContent className="p-4">
              <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${tint}`}>
                <Icon className="h-4 w-4" />
              </div>
              <p className="font-semibold text-sm mt-3">{title}</p>
              <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Panduan per perangkat */}
      <Card className="rounded-2xl shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <HelpCircle className="h-4 w-4 text-primary" />
            <p className="font-semibold">Panduan install {platform === "unknown" ? "" : `(${platform === "ios" ? "iPhone/iPad" : platform === "android" ? "Android" : "Komputer"})`}</p>
          </div>
          <ol className="space-y-2.5">
            {(platform === "ios" ? guide.ios : platform === "android" ? guide.android : platform === "desktop" ? guide.desktop : [...guide.android, ...guide.ios]).map(
              (step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="h-6 w-6 shrink-0 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
                    {i + 1}
                  </span>
                  <span className="text-sm text-foreground leading-relaxed">{step}</span>
                </li>
              )
            )}
          </ol>
          {canPrompt && (
            <p className="text-xs text-muted-foreground mt-4">
              Tombol “Install Aplikasi” di atas lebih cepat — panduan ini untuk perangkat yang tidak
              menampilkan tombol install otomatis (mis. iPhone/iPad).
            </p>
          )}
        </CardContent>
      </Card>

      {platform === "desktop" && !installed && (
        <p className="text-xs text-muted-foreground">
          Tip: pastikan situs diakses melalui HTTPS. Jika ikon install belum muncul, muat ulang
          halaman sekali lalu tunggu beberapa detik.
        </p>
      )}
    </div>
  );
}
