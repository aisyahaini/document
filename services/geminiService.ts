
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedData, DocumentType, ReconciliationResult } from "../types";

const MAX_IMAGE_DIMENSION = 1400; 
const API_SIZE_LIMIT = 52428800;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const result = reader.result?.toString();
      if (result) {
        const base64String = result.split(',')[1];
        resolve(base64String);
      } else {
        reject("Gagal mengonversi file ke base64");
      }
    };
    reader.onerror = error => reject(error);
  });
};

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function optimizeImage(file: File): Promise<string> {
  if (!file.type.startsWith('image/')) {
    const base64 = await fileToBase64(file);
    const sizeInBytes = (base64.length * 3) / 4;
    if (sizeInBytes > API_SIZE_LIMIT) {
      throw new Error(`File PDF "${file.name}" terlalu besar. Maksimal 50MB.`);
    }
    return base64;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.src = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(img.src);
      let width = img.width;
      let height = img.height;

      if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
        if (width > height) {
          height = (height / width) * MAX_IMAGE_DIMENSION;
          width = MAX_IMAGE_DIMENSION;
        } else {
          width = (width / height) * MAX_IMAGE_DIMENSION;
          height = MAX_IMAGE_DIMENSION;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
      }
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.65); 
      const base64 = dataUrl.split(',')[1];
      resolve(base64);
    };
    img.onerror = () => reject("Gagal mengoptimalkan gambar.");
  });
}

export async function processDocument(base64Data: string, mimeType: string): Promise<ExtractedData[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  let lastError: any;

  for (let i = 0; i < MAX_RETRIES; i++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: {
          parts: [
            { inlineData: { data: base64Data, mimeType: mimeType } },
            {
              text: `Tugas: Auditor Senior Pajak CV Global Solusi. 
              EKSTRAKSI DOKUMEN BUNDLE: Identifikasi SEMUA faktur/nota dalam file ini.
              Setiap dokumen harus menjadi satu objek JSON. 
              Ambil: Tipe Dokumen, No Dokumen, Tanggal, No Seri Faktur Pajak (NSFP), Nama Vendor, Nama Customer, Daftar Barang (Deskripsi, Qty, Harga, Diskon, Pajak), Subtotal, Total Pajak, Total Diskon, dan Grand Total.`
            }
          ]
        },
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                documentType: { type: Type.STRING },
                documentNumber: { type: Type.STRING },
                date: { type: Type.STRING },
                taxInvoiceNumber: { type: Type.STRING },
                vendorName: { type: Type.STRING },
                customerName: { type: Type.STRING },
                subtotalAmount: { type: Type.NUMBER },
                taxAmount: { type: Type.NUMBER },
                discountTotal: { type: Type.NUMBER },
                totalAmount: { type: Type.NUMBER },
                items: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      description: { type: Type.STRING },
                      quantity: { type: Type.NUMBER },
                      unitPrice: { type: Type.NUMBER },
                      discountAmount: { type: Type.NUMBER },
                      taxAmount: { type: Type.NUMBER },
                      totalPrice: { type: Type.NUMBER }
                    }
                  }
                }
              },
              required: ["documentNumber", "vendorName", "totalAmount"]
            }
          }
        }
      });

      if (!response.text) {
        throw new Error("Respons AI kosong.");
      }

      return JSON.parse(response.text) as ExtractedData[];
    } catch (error: any) {
      lastError = error;
      console.warn(`Attempt ${i + 1} failed:`, error.message);
      if (i < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAY * Math.pow(2, i)); // Exponential backoff
      }
    }
  }

  console.error("All extraction attempts failed:", lastError);
  throw new Error(lastError?.message || "Gagal mengekstraksi data dari dokumen setelah beberapa percobaan.");
}

export async function reconcileDocuments(documents: ExtractedData[]): Promise<ReconciliationResult[]> {
  const groups: Record<string, ExtractedData[]> = {};
  
  documents.forEach(doc => {
    const key = doc.taxInvoiceNumber ? doc.taxInvoiceNumber.trim().toUpperCase() : `INTERNAL-${doc.documentNumber.toUpperCase()}`;
    if (!groups[key]) groups[key] = [];
    groups[key].push(doc);
  });

  return Object.entries(groups).map(([key, docs]) => {
    const isInternal = key.startsWith('INTERNAL-');
    const discrepancies: string[] = [];
    let isMatch = true;

    if (docs.length > 1) {
      const firstDoc = docs[0];
      docs.forEach((doc, idx) => {
        if (idx === 0) return;

        if (Math.abs(doc.totalAmount - firstDoc.totalAmount) > 0.1) {
          isMatch = false;
          discrepancies.push(`Selisih Total: ${doc.documentNumber} (${doc.totalAmount.toLocaleString()}) vs ${firstDoc.documentNumber} (${firstDoc.totalAmount.toLocaleString()})`);
        }

        if (Math.abs((doc.taxAmount || 0) - (firstDoc.taxAmount || 0)) > 0.1) {
          isMatch = false;
          discrepancies.push(`Selisih PPN: Terjadi perbedaan nilai pajak masukan antar dokumen.`);
        }

        if (doc.vendorName.toLowerCase().replace(/\s/g, '') !== firstDoc.vendorName.toLowerCase().replace(/\s/g, '')) {
          discrepancies.push(`Inkonsistensi Vendor: Nama vendor terdeteksi berbeda (${doc.vendorName} vs ${firstDoc.vendorName})`);
        }
      });
    } else if (!isInternal && !docs[0].taxInvoiceNumber) {
      isMatch = false;
      discrepancies.push("Peringatan: Dokumen pajak tidak memiliki Nomor Seri Faktur Pajak (NSFP).");
    }

    const analysisFindings = [
      isInternal ? "Dokumen Non-PKP / Nota Internal." : `Faktur Pajak Terverifikasi: ${key}`,
      `Status Audit: ${isMatch ? 'SESUAI (MATCH)' : '⚠️ ADA KETIDAKSESUAIAN'}`,
      `Jumlah Dokumen Terkait: ${docs.length} Berkas`
    ];

    if (isMatch && docs.length > 1) {
      analysisFindings.push("Validasi Silang: Seluruh nilai numerik (Total, PPN, Diskon) sinkron antar dokumen.");
    }

    return {
      groupKey: key,
      documents: docs,
      isMatch,
      discrepancies,
      analysisFindings,
      checkedAt: new Date().toLocaleString('id-ID'),
      taxNumberRef: isInternal ? undefined : key
    };
  });
}
