import { supabase } from "@/integrations/supabase/client";

/**
 * Pengaturan identitas bisnis / branding aplikasi (kwitansi & struk).
 * Tersimpan satu baris di tabel `app_settings` (id = 1).
 * Bila tabel belum ada / gagal dibaca, aplikasi memakai DEFAULT_BRAND
 * sehingga kwitansi tetap bisa dibuat seperti sebelumnya.
 */

export interface ReceiptLabels {
  title: string;
  subtitle: string;
  footer: string;
}

export interface BrandSettings {
  business_name: string;
  tagline: string;
  address: string;
  phone: string;
  logo_url: string | null;
  signature_url: string | null;
  labels: {
    payment: ReceiptLabels;
    dp: ReceiptLabels;
    pelunasan: ReceiptLabels;
  };
}

export type BrandPatch = Partial<
  Pick<BrandSettings, "business_name" | "tagline" | "address" | "phone" | "logo_url" | "signature_url">
> & { labels?: BrandSettings["labels"] };

export const DEFAULT_BRAND: BrandSettings = {
  business_name: "HIRAYA KOST",
  tagline: "Manajemen Kos & Pembayaran",
  address: "Jl. Cempaka No.79 RT 01 RW 08 Sukahati, Cibinong",
  phone: "087722667913",
  logo_url: null,
  signature_url: null,
  labels: {
    payment: {
      title: "KWITANSI PEMBAYARAN",
      subtitle: "Bukti pembayaran sewa kamar kos",
      footer: "Terima kasih telah membayar tepat waktu.",
    },
    dp: {
      title: "KWITANSI DOWN PAYMENT",
      subtitle: "Pembayaran DP reservasi kamar kos",
      footer: "DP yang hangus tidak dapat dikembalikan.",
    },
    pelunasan: {
      title: "KWITANSI PELUNASAN",
      subtitle: "Pelunasan sewa — penghuni baru setelah DP",
      footer: "Terima kasih telah membayar tepat waktu.",
    },
  },
};

function mergeLabels(raw: unknown): BrandSettings["labels"] {
  const merge = (kind: keyof BrandSettings["labels"], src: unknown): ReceiptLabels => {
    const def = DEFAULT_BRAND.labels[kind];
    if (!src || typeof src !== "object") return def;
    const s = src as Record<string, unknown>;
    return {
      title: typeof s.title === "string" && s.title.trim() ? s.title.trim() : def.title,
      subtitle: typeof s.subtitle === "string" && s.subtitle.trim() ? s.subtitle.trim() : def.subtitle,
      footer: typeof s.footer === "string" && s.footer.trim() ? s.footer.trim() : def.footer,
    };
  };
  const labels = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  return {
    payment: merge("payment", labels.payment),
    dp: merge("dp", labels.dp),
    pelunasan: merge("pelunasan", labels.pelunasan),
  };
}

function normalizeRow(row: Record<string, unknown> | null | undefined): BrandSettings {
  if (!row) return DEFAULT_BRAND;
  const str = (v: unknown, fb: string) => (typeof v === "string" && v.trim() ? v.trim() : fb);
  const nul = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v.trim() : null);
  return {
    business_name: str(row.business_name, DEFAULT_BRAND.business_name),
    tagline: str(row.tagline, DEFAULT_BRAND.tagline),
    address: str(row.address, DEFAULT_BRAND.address),
    phone: str(row.phone, DEFAULT_BRAND.phone),
    logo_url: nul(row.logo_url),
    signature_url: nul(row.signature_url),
    labels: mergeLabels(row.labels),
  };
}

// Cache proses tunggal: undefined = belum dimuat, null = sudah dicoba & gagal
let cached: BrandSettings | null | undefined;
let inflight: Promise<BrandSettings> | null = null;

/** Ambil pengaturan dari server (sekali per sesi; panggil force=true untuk muat ulang). */
export async function fetchBrandSettings(force = false): Promise<BrandSettings> {
  // cache sukses dipakai; kalau gagal (null) coba lagi di pemanggilan berikutnya
  if (!force && cached) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    try {
      const { data, error } = await supabase.from("app_settings").select("*").limit(1).maybeSingle();
      if (error) throw error;
      cached = normalizeRow(data as unknown as Record<string, unknown>);
    } catch (err) {
      // Tabel belum dibuat / offline — fallback aman ke nilai default.
      console.warn("Gagal memuat app_settings, memakai default:", err);
      cached = null;
    } finally {
      inflight = null;
    }
    return cached ?? DEFAULT_BRAND;
  })();

  return inflight;
}

/** Versi sinkron untuk pemakaian sepele (sudah pasti termuat). */
export function getCachedBrand(): BrandSettings {
  return cached ?? DEFAULT_BRAND;
}

/** Setel ulang cache (dipanggil setelah simpan di halaman Pengaturan). */
export function resetBrandCache(): void {
  cached = undefined;
}

/** Simpan patch ke tabel app_settings lalu segarkan cache. */
export async function saveBrandSettings(patch: BrandPatch): Promise<{ ok: boolean; error?: string }> {
  const payload: Record<string, unknown> = { id: 1 };
  if (patch.business_name !== undefined) payload.business_name = patch.business_name;
  if (patch.tagline !== undefined) payload.tagline = patch.tagline;
  if (patch.address !== undefined) payload.address = patch.address;
  if (patch.phone !== undefined) payload.phone = patch.phone;
  if (patch.logo_url !== undefined) payload.logo_url = patch.logo_url;
  if (patch.signature_url !== undefined) payload.signature_url = patch.signature_url;
  if (patch.labels !== undefined) payload.labels = patch.labels;

  try {
    const { data, error } = await supabase
      .from("app_settings")
      .upsert(payload, { onConflict: "id" })
      .select("*")
      .maybeSingle();
    if (error) throw error;
    cached = normalizeRow(data as unknown as Record<string, unknown>);
    return { ok: true };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Gagal menyimpan pengaturan";
    return { ok: false, error: message };
  }
}

/** Upload logo/tanda tangan ke bucket `branding`, balas public URL. */
export async function uploadBrandAsset(
  file: File | Blob,
  kind: "logo" | "signature"
): Promise<{ ok: boolean; url?: string; error?: string }> {
  const fileName = `${kind}.png`;
  try {
    const { error } = await supabase.storage
      .from("branding")
      .upload(fileName, file, { cacheControl: "0", upsert: true, contentType: "image/png" });
    if (error) throw error;
    const { data } = supabase.storage.from("branding").getPublicUrl(fileName);
    return { ok: true, url: data.publicUrl };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : `Gagal mengunggah ${kind}`;
    return { ok: false, error: message };
  }
}

/** Hapus file logo/tanda tangan dari bucket. */
export async function deleteBrandAsset(kind: "logo" | "signature"): Promise<void> {
  try {
    await supabase.storage.from("branding").remove([`${kind}.png`]);
  } catch {
    // abaikan — kalau gagal, URL tinggal dikosongkan
  }
}

/** Ubah URL publik gambar menjadi data URL (buat ditempel di PDF). */
export async function imageUrlToDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const blob = await res.blob();
    if (blob.size === 0) return null;
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Baca ukuran asli PNG dari data URL (PNG header IHDR), untuk proporsi gambar. */
export function pngSizeFromDataUrl(dataUrl: string): { w: number; h: number } | null {
  try {
    const comma = dataUrl.indexOf(",");
    if (comma < 0) return null;
    const bin = atob(dataUrl.slice(comma + 1));
    if (bin.length < 24) return null;
    // cek signature PNG
    for (let i = 0; i < 8; i++) {
      if (bin.charCodeAt(i) !== [137, 80, 78, 71, 13, 10, 26, 10][i]) return null;
    }
    const w = (bin.charCodeAt(16) << 24) | (bin.charCodeAt(17) << 16) | (bin.charCodeAt(18) << 8) | bin.charCodeAt(19);
    const h = (bin.charCodeAt(20) << 24) | (bin.charCodeAt(21) << 16) | (bin.charCodeAt(22) << 8) | bin.charCodeAt(23);
    if (!w || !h) return null;
    return { w, h };
  } catch {
    return null;
  }
}
