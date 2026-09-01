import { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { generateKwitansiImage } from "@/lib/kwitansiImage";
import { generateKwitansiPDF } from "@/lib/kwitansiPDF";
import { jsPDFToBlob } from "@/lib/pdfUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FileImage, FileText, Loader2 } from "lucide-react";
import { format } from "date-fns";

interface PaymentData {
  id: string;
  amount: number;
  payment_date: string;
  payment_month: string;
  payment_method: string;
  residents: {
    full_name: string;
    entry_date: string;
    rooms: { room_number: number } | null;
  } | null;
}

export default function KwitansiView() {
  const { id } = useParams<{ id: string }>();
  const [payment, setPayment] = useState<PaymentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    fetchPayment();
  }, [id]);

  useEffect(() => {
    if (payment) {
      generateImage();
    }
  }, [payment]);

  const fetchPayment = async () => {
    if (!id) {
      setError("ID pembayaran tidak ditemukan");
      setLoading(false);
      return;
    }
    try {
      const { data, error } = await supabase
        .from("payments")
        .select("*, residents(full_name, entry_date, rooms(room_number))")
        .eq("id", id)
        .single();
      if (error) throw error;
      if (!data) throw error;
      setPayment(data as PaymentData);
    } catch (err: any) {
      setError(err?.message || "Gagal memuat data pembayaran");
    } finally {
      setLoading(false);
    }
  };

  const generateImage = async () => {
    if (!payment) return;
    setGenerating(true);
    try {
      const blob = await generateKwitansiImage({
        namaPenyewa: payment.residents?.full_name || "-",
        kamar: payment.residents?.rooms?.room_number?.toString() || "-",
        bulanSewa: payment.payment_month,
        nominal: `Rp ${payment.amount.toLocaleString("id-ID")}`,
        tanggalBayar: format(new Date(payment.payment_date), "dd MMMM yyyy"),
        metodePembayaran: payment.payment_method,
        tanggalMasuk: format(new Date(payment.residents?.entry_date || ""), "dd MMMM yyyy"),
      });
      setImageBlob(blob);
      setImageUrl(URL.createObjectURL(blob));
    } catch (err) {
      console.error("Failed to generate image:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleDownloadImage = () => {
    if (!imageUrl || !payment) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = `kwitansi-${payment.residents?.full_name?.replace(/\s+/g, "_")}-${payment.payment_date}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadPDF = async () => {
    if (!payment) return;
    try {
      const { doc } = generateKwitansiPDF({
        namaPenyewa: payment.residents?.full_name || "-",
        tanggalMasuk: payment.residents?.entry_date || "",
        nominal: `Rp ${payment.amount.toLocaleString("id-ID")}`,
        tanggal: payment.payment_date,
        logoBase64: "",
        kamar: payment.residents?.rooms?.room_number?.toString() || "",
        metodePembayaran: payment.payment_method,
        bulanSewa: payment.payment_month,
      });
      doc.save(`kwitansi-${payment.residents?.full_name?.replace(/\s+/g, "_")}-${payment.payment_date}.pdf`);
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
  if (error || !payment) {
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
          <h1 className="font-semibold text-sm">Kwitansi Pembayaran</h1>
          <span className="text-xs text-muted-foreground">Hiraya Kost</span>
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
              alt="Kwitansi Pembayaran"
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
          <Button
            className="w-full"
            size="lg"
            onClick={handleDownloadImage}
            disabled={!imageUrl}
          >
            <FileImage className="h-4 w-4 mr-2" />
            Unduh sebagai Gambar (PNG)
          </Button>
          <Button
            variant="outline"
            className="w-full"
            size="lg"
            onClick={handleDownloadPDF}
          >
            <FileText className="h-4 w-4 mr-2" />
            Unduh sebagai PDF
          </Button>

        </div>

        {/* Footer */}
        <div className="mt-6 text-center text-xs text-muted-foreground pb-8">
          <p>Dokumen ini merupakan bukti pembayaran yang sah.</p>
          <p className="mt-1">Kontak Pengelola: 087722667913</p>
        </div>
      </div>
    </div>
  );
}
