import { useEffect, useRef, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  fetchBrandSettings,
  saveBrandSettings,
  uploadBrandAsset,
  deleteBrandAsset,
  DEFAULT_BRAND,
  type BrandSettings,
  type ReceiptLabels,
} from "@/lib/branding";
import { generateKwitansiDPPDF } from "@/lib/kwitansiDPpdf";
import {
  generateKwitansiImage,
  generateKwitansiDPImage,
  generateKwitansiPelunasanImage,
} from "@/lib/kwitansiImage";
import { generateKwitansiPelunasanPDF } from "@/lib/kwitansiPelunasanPDF";
import { generateKwitansiPDF } from "@/lib/kwitansiPDF";
import {
  Store,
  Image as ImageIcon,
  PenLine,
  FileText,
  Loader2,
  UploadCloud,
  Trash2,
  Save,
  Building2,
  Eye,
  Download,
} from "lucide-react";

type PreviewKind = "payment" | "dp" | "pelunasan";

const RECEIPT_TYPES: {
  key: keyof BrandSettings["labels"];
  label: string;
  desc: string;
}[] = [
  { key: "payment", label: "Kwitansi Pembayaran", desc: "Kwitansi biasa saat penghuni bayar sewa." },
  { key: "dp", label: "Kwitansi DP", desc: "Bukti down payment reservasi kamar." },
  { key: "pelunasan", label: "Kwitansi Pelunasan", desc: "Pelunasan sewa penghuni baru setelah DP." },
];

export default function Settings() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  // Form identitas & label
  const [identity, setIdentity] = useState({
    business_name: DEFAULT_BRAND.business_name,
    tagline: DEFAULT_BRAND.tagline,
    address: DEFAULT_BRAND.address,
    phone: DEFAULT_BRAND.phone,
  });
  const [labels, setLabels] = useState<BrandSettings["labels"]>(DEFAULT_BRAND.labels);

  // Aset: logo & tanda tangan
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [assetBusy, setAssetBusy] = useState<"logo" | "signature" | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  // State pratinjau kwitansi
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewKind, setPreviewKind] = useState<PreviewKind>("payment");
  const [previewMode, setPreviewMode] = useState<"gambar" | "pdf">("gambar");
  const [previewPng, setPreviewPng] = useState<string | null>(null);
  const [previewPdf, setPreviewPdf] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState<"png" | "pdf" | null>(null);
  const pngUrlRef = useRef<string | null>(null);
  const pdfUrlRef = useRef<string | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    const brand = await fetchBrandSettings(true);
    setIdentity({
      business_name: brand.business_name,
      tagline: brand.tagline,
      address: brand.address,
      phone: brand.phone,
    });
    setLabels(brand.labels);
    setLogoUrl(brand.logo_url);
    setSignatureUrl(brand.signature_url);
    setLoading(false);
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const patchLabels = (kind: keyof BrandSettings["labels"], patch: Partial<ReceiptLabels>) => {
    setLabels((prev) => ({ ...prev, [kind]: { ...prev[kind], ...patch } }));
  };

  const handleSaveText = async () => {
    setSaving(true);
    const result = await saveBrandSettings({
      business_name: identity.business_name.trim(),
      tagline: identity.tagline.trim(),
      address: identity.address.trim(),
      phone: identity.phone.trim(),
      labels,
    });
    setSaving(false);
    if (result.ok) {
      setSavedAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
      toast({
        title: "Pengaturan tersimpan",
        description: "Identitas & label baru akan dipakai di kwitansi berikutnya.",
      });
    } else {
      toast({
        title: "Gagal menyimpan",
        description:
          result.error ||
          "Pastikan tabel app_settings sudah dibuat (jalankan file migrasi di Supabase).",
        variant: "destructive",
      });
    }
  };

  const pickAsset = (kind: "logo" | "signature") => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const preview = URL.createObjectURL(file);
    if (kind === "logo") setLogoPreview(preview);
    else setSignaturePreview(preview);
    // File tersimpan di input; dipakai saat tombol "Simpan" ditekan
  };

  const saveAsset = async (kind: "logo" | "signature") => {
    const input = kind === "logo" ? logoInputRef.current : signatureInputRef.current;
    const file = input?.files?.[0];
    if (!file) {
      toast({ title: "Pilih file dulu", description: "Pilih gambar terlebih dahulu.", variant: "destructive" });
      return;
    }
    setAssetBusy(kind);
    const up = await uploadBrandAsset(file, kind);
    if (!up.ok || !up.url) {
      setAssetBusy(null);
      toast({
        title: "Gagal upload",
        description:
          up.error ||
          "Pastikan bucket 'branding' sudah dibuat di Supabase Storage (lihat file migrasi).",
        variant: "destructive",
      });
      return;
    }
    const result = await saveBrandSettings(
      kind === "logo" ? { logo_url: up.url } : { signature_url: up.url }
    );
    setAssetBusy(null);
    if (result.ok) {
      if (kind === "logo") {
        setLogoUrl(up.url);
        setLogoPreview(null);
        if (logoInputRef.current) logoInputRef.current.value = "";
      } else {
        setSignatureUrl(up.url);
        setSignaturePreview(null);
        if (signatureInputRef.current) signatureInputRef.current.value = "";
      }
      setSavedAt(new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" }));
      toast({
        title: kind === "logo" ? "Logo tersimpan" : "Tanda tangan tersimpan",
        description:
          kind === "signature"
            ? "Tanda tangan akan menggantikan stempel bulat di kwitansi."
            : "Logo baru akan tampil di header kwitansi.",
      });
    } else {
      toast({
        title: "Gagal menyimpan",
        description: result.error || "Terjadi kesalahan saat menyimpan.",
        variant: "destructive",
      });
    }
  };

  const removeAsset = async (kind: "logo" | "signature") => {
    setAssetBusy(kind);
    await deleteBrandAsset(kind);
    const result = await saveBrandSettings(
      kind === "logo" ? { logo_url: null } : { signature_url: null }
    );
    setAssetBusy(null);
    if (result.ok) {
      if (kind === "logo") {
        setLogoUrl(null);
        setLogoPreview(null);
        if (logoInputRef.current) logoInputRef.current.value = "";
      } else {
        setSignatureUrl(null);
        setSignaturePreview(null);
        if (signatureInputRef.current) signatureInputRef.current.value = "";
      }
      toast({ title: "Dihapus", description: "File berhasil dihapus dari kwitansi." });
    } else {
      toast({
        title: "Gagal menghapus",
        description: result.error || "Terjadi kesalahan.",
        variant: "destructive",
      });
    }
  };

  const setPng = (url: string | null) => {
    if (pngUrlRef.current) URL.revokeObjectURL(pngUrlRef.current);
    pngUrlRef.current = url;
    setPreviewPng(url);
  };

  const setPdf = (url: string | null) => {
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    pdfUrlRef.current = url;
    setPreviewPdf(url);
  };

  const buildOverrideBrand = (): BrandSettings => ({
    business_name: identity.business_name.trim() || DEFAULT_BRAND.business_name,
    tagline: identity.tagline.trim() || DEFAULT_BRAND.tagline,
    address: identity.address.trim() || DEFAULT_BRAND.address,
    phone: identity.phone.trim() || DEFAULT_BRAND.phone,
    logo_url: logoUrl,
    signature_url: signatureUrl,
    labels,
  });

  const refreshPreviewPng = async (kind: PreviewKind) => {
    setPreviewBusy("png");
    try {
      const brand = buildOverrideBrand();
      let blob: Blob;
      if (kind === "dp") {
        blob = await generateKwitansiDPImage(
          {
            namaCalon: "Siti Aminah",
            kamar: "Kamar 2",
            tanggalDP: "3 September 2026",
            deadlinePelunasan: "28 September 2026",
            nominalDP: "Rp 300.000",
            metodePembayaran: "Tunai",
          },
          { brand }
        );
      } else if (kind === "pelunasan") {
        blob = await generateKwitansiPelunasanImage(
          {
            namaPenyewa: "Siti Aminah",
            kamar: "Kamar 2",
            tanggalPelunasan: "28 September 2026",
            nominalPelunasan: "Rp 975.000",
            metodePembayaran: "Tunai",
          },
          { brand }
        );
      } else {
        blob = await generateKwitansiImage(
          {
            namaPenyewa: "Budi Santoso",
            kamar: "Kamar 1",
            periodeSewa: "1 September 2026 - 1 Oktober 2026",
            nominal: "Rp 150.000",
            tanggalBayar: "3 September 2026",
            metodePembayaran: "Tunai",
          },
          { brand }
        );
      }
      setPng(URL.createObjectURL(blob));
    } catch {
      setPng(null);
      toast({ title: "Gagal membuat pratinjau", variant: "destructive" });
    } finally {
      setPreviewBusy(null);
    }
  };

  const openPreview = async () => {
    setPreviewKind("payment");
    setPreviewMode("gambar");
    setPng(null);
    setPdf(null);
    setPreviewOpen(true);
    await refreshPreviewPng("payment");
  };

  const switchPreviewKind = async (k: PreviewKind) => {
    setPreviewKind(k);
    setPng(null);
    setPdf(null);
    await refreshPreviewPng(k);
    if (previewMode === "pdf") {
      await refreshPreviewPdf(k);
    }
  };

  const switchPreviewMode = async (m: "gambar" | "pdf") => {
    setPreviewMode(m);
    if (m === "pdf" && !previewPdf) {
      await refreshPreviewPdf(previewKind);
    }
  };

  const closePreview = () => {
    setPng(null);
    setPdf(null);
    setPreviewOpen(false);
  };

  const buildPreviewPdfBlob = async (
    kind: PreviewKind,
    brand: BrandSettings
  ): Promise<Blob> => {
    if (kind === "payment") {
      const { doc } = await generateKwitansiPDF(
        {
          namaPenyewa: "Budi Santoso",
          tanggalMasuk: "2026-09-01",
          nominal: "Rp 150.000",
          tanggal: "2026-09-03",
          logoBase64: "",
          kamar: "Kamar 1",
          metodePembayaran: "Tunai",
          bulanSewa: "September",
        },
        { brand }
      );
      return doc.output("blob");
    }
    if (kind === "dp") {
      const { doc } = await generateKwitansiDPPDF(
        {
          namaCalon: "Siti Aminah",
          kamar: "Kamar 2",
          nominalDP: "Rp 300.000",
          sisaPelunasan: "Rp 975.000",
          totalHarga: "Rp 1.275.000",
          tanggalDP: "2026-09-03",
          deadlinePelunasan: "2026-09-28",
          metodePembayaran: "Tunai",
          logoBase64: "",
        },
        { brand }
      );
      return doc.output("blob");
    }
    const { doc } = await generateKwitansiPelunasanPDF(
      {
        namaPenyewa: "Siti Aminah",
        kamar: "Kamar 2",
        nominalDP: "Rp 300.000",
        nominalPelunasan: "Rp 975.000",
        totalHarga: "Rp 1.275.000",
        tanggalPelunasan: "2026-09-28",
        bulanSewa: "September",
        tanggalMasuk: "2026-09-28",
        metodePembayaran: "Tunai",
        logoBase64: "",
      },
      { brand }
    );
    return doc.output("blob");
  };

  const refreshPreviewPdf = async (kind: PreviewKind) => {
    setPreviewBusy("pdf");
    try {
      const blob = await buildPreviewPdfBlob(kind, buildOverrideBrand());
      setPdf(URL.createObjectURL(blob));
    } catch {
      setPdf(null);
      toast({ title: "Gagal membuat pratinjau PDF", variant: "destructive" });
    } finally {
      setPreviewBusy(null);
    }
  };

  const downloadPreviewPdf = async () => {
    setPreviewBusy("pdf");
    try {
      const blob = await buildPreviewPdfBlob(previewKind, buildOverrideBrand());
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        previewKind === "payment"
          ? "contoh-kwitansi-pembayaran.pdf"
          : `contoh-kwitansi-${previewKind}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast({ title: "Berhasil", description: "Contoh PDF diunduh." });
    } catch (err: unknown) {
      toast({
        title: "Gagal membuat PDF",
        description: err instanceof Error ? err.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setPreviewBusy(null);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pengaturan</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Identitas bisnis yang tampil di kwitansi & struk — cocok saat aplikasi dipakai kos lain.
          </p>
        </div>
        <div className="flex w-full sm:w-auto gap-2">
          <Button
            variant="outline"
            className="flex-1 sm:flex-none shrink-0"
            onClick={openPreview}
            disabled={loading}
          >
            <Eye className="h-4 w-4 mr-2" />
            Pratinjau
          </Button>
          <Button
            className="flex-1 sm:flex-none shrink-0"
            onClick={handleSaveText}
            disabled={loading || saving}
          >
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Simpan Pengaturan
          </Button>
        </div>
      </div>

      {savedAt && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          ✓ Tersimpan {savedAt} — kwitansi berikutnya langsung memakai pengaturan baru.
        </div>
      )}

      {/* ── Identitas bisnis ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Store className="h-5 w-5" /> Identitas Bisnis
          </CardTitle>
          <CardDescription>
            Nama, alamat & kontak yang tercetak di kwitansi PDF dan struk gambar.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="set-business-name">Nama Bisnis / Kos</Label>
                  <Input
                    id="set-business-name"
                    placeholder="mis. HIRAYA KOST"
                    value={identity.business_name}
                    onChange={(e) => setIdentity({ ...identity, business_name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="set-tagline">Tagline</Label>
                  <Input
                    id="set-tagline"
                    placeholder="mis. Manajemen Kos & Pembayaran"
                    value={identity.tagline}
                    onChange={(e) => setIdentity({ ...identity, tagline: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="set-address">Alamat</Label>
                <Textarea
                  id="set-address"
                  rows={2}
                  placeholder="Alamat lengkap kos"
                  value={identity.address}
                  onChange={(e) => setIdentity({ ...identity, address: e.target.value })}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="set-phone">Kontak (Telepon / WhatsApp)</Label>
                  <Input
                    id="set-phone"
                    placeholder="mis. 087722667913"
                    value={identity.phone}
                    onChange={(e) => setIdentity({ ...identity, phone: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Logo & Tanda tangan ── */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" /> Logo
            </CardTitle>
            <CardDescription>Tampil di pojok kiri atas header kwitansi (PNG, ukuran kecil).</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-32 rounded-xl border border-dashed bg-muted/40 mb-3 overflow-hidden">
              {(logoPreview || logoUrl) ? (
                <img
                  src={logoPreview || logoUrl || ""}
                  alt="Logo"
                  className="max-h-24 max-w-[70%] object-contain"
                />
              ) : (
                <div className="flex flex-col items-center text-muted-foreground">
                  <Building2 className="h-8 w-8 mb-1" />
                  <span className="text-xs">Belum ada logo</span>
                </div>
              )}
            </div>
            <input ref={logoInputRef} type="file" accept="image/png" className="hidden" onChange={pickAsset("logo")} />
            <div className="flex flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => logoInputRef.current?.click()}
            >
              {logoPreview || logoUrl ? "Ganti Logo" : "Pilih Logo (PNG)"}
            </Button>
              {(logoPreview || logoUrl) && (
                <>
                  <Button className="flex-1" disabled={assetBusy === "logo"} onClick={() => saveAsset("logo")}>
                    {assetBusy === "logo" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <UploadCloud className="h-4 w-4 mr-1.5" />}
                    Simpan
                  </Button>
                  {!logoPreview && logoUrl && (
                    <Button variant="outline" size="icon" title="Hapus logo" disabled={assetBusy === "logo"} onClick={() => removeAsset("logo")}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <PenLine className="h-5 w-5" /> Tanda Tangan Digital
            </CardTitle>
            <CardDescription>
              PNG transparan di atas garis "Pengelola Kost". Stempel bulat tetap dipertahankan.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-32 rounded-xl border border-dashed bg-muted/40 mb-3 overflow-hidden">
              {(signaturePreview || signatureUrl) ? (
                <img
                  src={signaturePreview || signatureUrl || ""}
                  alt="Tanda tangan"
                  className="max-h-24 max-w-[70%] object-contain"
                />
              ) : (
                <div className="flex flex-col items-center text-muted-foreground">
                  <PenLine className="h-8 w-8 mb-1" />
                  <span className="text-xs">Belum ada tanda tangan</span>
                </div>
              )}
            </div>
            <input
              ref={signatureInputRef}
              type="file"
              accept="image/png"
              className="hidden"
              onChange={pickAsset("signature")}
            />
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => signatureInputRef.current?.click()}
              >
                {signaturePreview || signatureUrl ? "Ganti Tanda Tangan" : "Pilih Tanda Tangan (PNG)"}
              </Button>
              {(signaturePreview || signatureUrl) && (
                <>
                  <Button className="flex-1" disabled={assetBusy === "signature"} onClick={() => saveAsset("signature")}>
                    {assetBusy === "signature" ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <UploadCloud className="h-4 w-4 mr-1.5" />}
                    Simpan
                  </Button>
                  {!signaturePreview && signatureUrl && (
                    <Button
                      variant="outline"
                      size="icon"
                      title="Hapus tanda tangan"
                      disabled={assetBusy === "signature"}
                      onClick={() => removeAsset("signature")}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Label kwitansi ── */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Label Kwitansi
          </CardTitle>
          <CardDescription>
            Judul, sub-judul & catatan kaki per jenis kwitansi. Kosongkan untuk memakai teks bawaan.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {RECEIPT_TYPES.map(({ key, label, desc }) => {
            const l = labels[key];
            return (
              <div key={key} className="rounded-xl border border-muted p-4 space-y-3">
                <div>
                  <p className="font-semibold text-sm">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor={`lbl-${key}-title`}>Judul</Label>
                    <Input
                      id={`lbl-${key}-title`}
                      value={l.title}
                      onChange={(e) => patchLabels(key, { title: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`lbl-${key}-subtitle`}>Sub-judul</Label>
                    <Input
                      id={`lbl-${key}-subtitle`}
                      value={l.subtitle}
                      onChange={(e) => patchLabels(key, { subtitle: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`lbl-${key}-footer`}>Catatan kaki</Label>
                  <Input
                    id={`lbl-${key}-footer`}
                    value={l.footer}
                    onChange={(e) => patchLabels(key, { footer: e.target.value })}
                  />
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSaveText} disabled={loading || saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
          Simpan Pengaturan
        </Button>
      </div>

      {/* ── Dialog Pratinjau Kwitansi ── */}
      <Dialog open={previewOpen} onOpenChange={(o) => (o ? openPreview() : closePreview())}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pratinjau Kwitansi</DialogTitle>
            <DialogDescription>
              Contoh kwitansi memakai pengaturan di atas (nama data sampel). Logo & tanda tangan baru
              ikut tampil setelah tombol Simpan aset ditekan.
            </DialogDescription>
          </DialogHeader>

          <div className="flex gap-2 flex-wrap items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {(
                [
                  ["payment", "Pembayaran"],
                  ["dp", "DP"],
                  ["pelunasan", "Pelunasan"],
                ] as const
              ).map(([k, lbl]) => (
                <Button
                  key={k}
                  size="sm"
                  variant={previewKind === k ? "default" : "outline"}
                  onClick={() => switchPreviewKind(k)}
                  disabled={previewBusy !== null}
                >
                  {lbl}
                </Button>
              ))}
            </div>
            <div className="inline-flex rounded-lg border bg-muted p-0.5">
              {(
                [
                  ["gambar", "Gambar"],
                  ["pdf", "PDF"],
                ] as const
              ).map(([m, lbl]) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => switchPreviewMode(m)}
                  disabled={previewBusy !== null}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    previewMode === m
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border bg-muted/30 p-2 flex items-center justify-center min-h-[240px] overflow-auto">
            {previewBusy === "png" || previewBusy === "pdf" ? (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            ) : previewMode === "pdf" ? (
              previewPdf ? (
                <iframe
                  src={previewPdf}
                  title="Pratinjau PDF kwitansi"
                  className="w-full h-[55vh] rounded-md bg-white"
                />
              ) : (
                <p className="text-sm text-muted-foreground p-6 text-center">
                  PDF belum tersedia. Coba lagi.
                </p>
              )
            ) : previewPng ? (
              <img
                src={previewPng}
                alt="Pratinjau struk kwitansi"
                className="max-h-[50vh] w-auto rounded-md shadow-sm"
              />
            ) : (
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            )}
          </div>

          <DialogFooter className="sm:justify-between items-center gap-2">
            <p className="text-xs text-muted-foreground">Hasil mengikuti identitas & label saat ini.</p>
            <Button onClick={downloadPreviewPdf} disabled={previewBusy === "pdf"}>
              {previewBusy === "pdf" ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Download className="h-4 w-4 mr-2" />
              )}
              Unduh PDF Contoh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
