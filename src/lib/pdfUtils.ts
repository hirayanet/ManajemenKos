import jsPDF from 'jspdf';

/**
 * Convert jsPDF instance to Blob
 */
export function jsPDFToBlob(doc: jsPDF): Promise<Blob> {
  return new Promise((resolve) => {
    const pdfArrayBuffer = doc.output('arraybuffer');
    const blob = new Blob([pdfArrayBuffer], { type: 'application/pdf' });
    resolve(blob);
  });
}
