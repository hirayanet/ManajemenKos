import { supabase } from "@/integrations/supabase/client";

/**
 * Upload file (PDF) ke Supabase Storage dan return public URL
 * @param {File | Blob} file - File PDF untuk diupload
 * @param {string} fileName - Nama file di storage
 * @returns {Promise<string | null>} - Public URL file
 */
export async function uploadPDFtoSupabase(file: File | Blob, fileName: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from("kwitansi") // bucket "kwitansi" harus sudah ada di Supabase Storage
    .upload(fileName, file, {
      cacheControl: "3600",
      upsert: true,
      contentType: "application/pdf"
    });

  if (error) {
    console.error("Upload error:", error);
    return null;
  }

  // Ambil public URL
  const { data: publicUrlData } = supabase.storage.from("kwitansi").getPublicUrl(fileName);
  return publicUrlData?.publicUrl || null;
}
