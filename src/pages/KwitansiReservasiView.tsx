import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generateKwitansiDPImage, generateKwitansiPelunasanImage } from "@/lib/kwitansiImage";
import { generateKwitansiDPPDF } from "@/lib/kwitansiDPpdf";
import { generateKwitansiPelunasanPDF } from "@/lib/kwitansiPelunasanPDF";
import { fetchBrandSettings } from "@/lib/branding";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileImage, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";
import { id as idLocale } from "date-fns/locale";

interface DPReservasiData {
  id: string;
  nama_calon: string;
  harga_per_bulan: number;
  nominal_dp: number;
  nominal_pelunasan: number;
  tanggal_dp: string;
  deadline_pelunasan: string;
  tanggal_pelunasan: string | null;
  payment_method_dp: string;
  payment_method_pelunasan: string | null;
  status: "Menunggu" | "Lunas" | "Hangus";
  rooms: { room_number: number } | null;
}

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

const formatRupiah = (n: number) => `Rp ${n.toLocaleString("id-ID")}`;

const formatTanggalID = (s: string) => {
  try {
    return format(new Date(s + "T00:00:00"), "dd MMMM yyyy", { locale: idLocale });
  } catch {
    return s;
  }
};

type Kind = "dp" | "pelunasan";

function KwitansiReservasiView({ kind }: { kind: Kind }) {
  const { id } = useParams<{ id: string }>();
  const [data, setData] = useState<DPReservasiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [brandName, setBrandName] = useState<string>("");
  const [brandPhone, setBrandPhone] = useState<string>("");
  const imgRef = useRef<HTMLImageElement>(null);

  const isLunas = kind === "pelunasan";
  const title = isLunas ? "Kwitansi Pelunasan" : "Kwitansi Down Payment (DP)";

  useEffect(() => {
    fetchReservasi();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    fetchBrandSettings().then((b) => {
      setBrandName(b.business_name);
      setBrandPhone(b.phone);
    });
  }, []);

  useEffect(() => {
    if (data) generateImage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const fetchReservasi = async () => {
    if (!id) {
      setError("ID kwitansi tidak ditemukan");
      setLoading(false);
      return;
    }
    try {
      const { data: row, error: err } = await supabase
        .from("dp_reservasi")
        .select("*, rooms(room_number)")
        .eq("id", id)
        .single();
      if (err) throw err;
      if (!row) throw new Error("Data tidak ditemukan");
      if (isLunas && !row.tanggal_pelunasan) {
        throw new Error("Belum ada data pelunasan untuk reservasi ini");
      }
      setData(row as unknown as DPReservasiData);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Gagal memuat data kwitansi");
    } finally {
      setLoading(false);
    }
  };

  const kamarDisplay = (): string => {
    const n = data?.rooms?.room_number;
    return n != null ? `Kamar ${n}` : "-";
  };

  const generateImage = async () => {
    if (!data) return;
    setGenerating(true);
    try {
      const blob = isLunas
        ? await generateKwitansiPelunasanImage({
            namaPenyewa: data.nama_calon,
            kamar: kamarDisplay(),
            tanggalPelunasan: formatTanggalID(data.tanggal_pelunasan || ""),
            nominalPelunasan: formatRupiah(data.nominal_pelunasan),
            metodePembayaran: data.payment_method_pelunasan || "Tunai",
          })
        : await generateKwitansiDPImage({
            namaCalon: data.nama_calon,
            kamar: kamarDisplay(),
            tanggalDP: formatTanggalID(data.tanggal_dp),
            deadlinePelunasan: formatTanggalID(data.deadline_pelunasan),
            nominalDP: formatRupiah(data.nominal_dp),
            metodePembayaran: data.payment_method_dp,
          });
      setImageBlob(blob);
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      setImageUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error("Failed to generate image:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadImage = () => {
    if (!imageUrl || !data) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `${isLunas ? "kwitansi-pelunasan" : "kwitansi-dp"}-${data.nama_calon.replace(
      /\s+/g,
      "_"
    )}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadPDF = async () => {
    if (!data) return;
    try {
      const kamarNum = data.rooms?.room_number?.toString() || "";
      if (isLunas) {
        const { doc } = await generateKwitansiPelunasanPDF({
          namaPenyewa: data.nama_calon,
          kamar: kamarNum,
          nominalDP: formatRupiah(data.nominal_dp),
          nominalPelunasan: formatRupiah(data.nominal_pelunasan),
          totalHarga: formatRupiah(data.harga_per_bulan),
          tanggalPelunasan: data.tanggal_pelunasan || "",
          bulanSewa: MONTHS[new Date((data.tanggal_pelunasan || "") + "T00:00:00").getMonth()],
          tanggalMasuk: data.tanggal_pelunasan || "",
          metodePembayaran: data.payment_method_pelunasan || "Tunai",
          logoBase64: "",
        });
        doc.save(`kwitansi-pelunasan-${data.nama_calon.replace(/\s+/g, "_")}.pdf`);
      } else {
        const { doc } = await generateKwitansiDPPDF({
          namaCalon: data.nama_calon,
          kamar: kamarNum,
          nominalDP: formatRupiah(data.nominal_dp),
          sisaPelunasan: formatRupiah(data.nominal_pelunasan),
          totalHarga: formatRupiah(data.harga_per_bulan),
          tanggalDP: data.tanggal_dp,
          deadlinePelunasan: data.deadline_pelunasan,
          metodePembayaran: data.payment_method_dp,
          logoBase64: "",
        });
        doc.save(`kwitansi-dp-${data.nama_calon.replace(/\s+/g, "_")}.pdf`);
      }
    } catch (err) {
      console.error("Failed to generate PDF:", err);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Memuat kwitansi...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-destructive font-medium mb-2">Gagal memuat kwitansi</p>
            <p className="text-sm text-muted-foreground">{error || "Data tidak ditemukan"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <h1 className="font-semibold text-sm">{title}</h1>
          <span className="text-xs text-muted-foreground">{brandName || "Hiraya Kost"}</span>
        </div>
      </div>

      {/* Kwitansi Image */}
      <div className="max-w-lg mx-auto p-4">
        {generating ? (
          <div className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
            <p className="text-sm text-muted-foreground">Menyiapkan kwitansi...</p>
          </div>
        ) : imageUrl ? (
          <div className="rounded-xl overflow-hidden shadow-lg bg-white">
            <img
              ref={imgRef}
              src={imageUrl}
              alt={title}
              className="w-full h-auto"
            />
          </div>
        ) : (
          <div className="text-center py-16 text-muted-foreground text-sm">
            Gagal generate gambar
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-4 space-y-2">
          <Button className="w-full" size="lg" onClick={handleDownloadImage} disabled={!imageUrl}>
            <FileImage className="h-4 w-4 mr-2" />
            Unduh sebagai Gambar (PNG)
          </Button>
          <Button variant="outline" className="w-full" size="lg" onClick={handleDownloadPDF}>
            <FileText className="h-4 w-4 mr-2" />
            Unduh sebagai PDF
          </Button>
        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-muted-foreground pb-8">
          <p>Dokumen ini merupakan bukti pembayaran yang sah.</p>
          <p className="mt-1">Kontak Pengelola: {brandPhone || "087722667913"}</p>
        </div>
      </div>
    </div>
  );
}

export function KwitansiDPView() {
  return <KwitansiReservasiView kind="dp" />;
}

export function KwitansiLunasView() {
  return <KwitansiReservasiView kind="pelunasan" />;
}
