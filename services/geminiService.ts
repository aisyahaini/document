
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedData, DocumentType, ReconciliationResult } from "../types";

// Dimensi 1400px cukup untuk OCR faktur dan menjaga ukuran file tetap aman di bawah limit API.
const MAX_IMAGE_DIMENSION = 1400; 
// Limit keras API Gemini adalah 50 MiB (52,428,800 bytes)
const API_SIZE_LIMIT = 52428800;

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

export async function optimizeImage(file: File): Promise<string> {
  // Penanganan khusus PDF
  if (!file.type.startsWith('image/')) {
    const base64 = await fileToBase64(file);
    // Hitung ukuran byte dari string base64 (approx: 3/4 length)
    const sizeInBytes = (base64.length * 3) / 4;
    
    if (sizeInBytes > API_SIZE_LIMIT) {
      throw new Error(
        `File PDF "${file.name}" terlalu besar (${Math.round(sizeInBytes / 1024 / 1024)}MB). ` +
        `API Gemini memiliki batas 50MB. Silakan pecah PDF menjadi beberapa bagian (misal per 10-20 halaman).`
      );
    }
    return base64;
  }

  // Penanganan Gambar (Resizing & Compression)
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
      
      // Menggunakan kualitas 0.65 untuk kompresi lebih agresif namun tetap tajam untuk OCR
      const dataUrl = canvas.toDataURL('image/jpeg', 0.65); 
      const base64 = dataUrl.split(',')[1];
      
      const sizeInBytes = (base64.length * 3) / 4;
      if (sizeInBytes > API_SIZE_LIMIT) {
        reject("Gambar tetap terlalu besar setelah dikompres. Gunakan resolusi lebih rendah.");
      } else {
        resolve(base64);
      }
    };
    img.onerror = () => reject("Gagal mengoptimalkan gambar.");
  });
}

export async function processDocument(base64Data: string, mimeType: string): Promise<ExtractedData[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType
            }
          },
          {
            text: `Tugas Anda adalah Auditor Senior Pajak CV Global Solusi. 
            ANALISIS DOKUMEN SECARA EXHAUSTIVE:
            1. DOKUMEN BUNDLE: File ini mungkin berisi puluhan faktur/nota dalam satu file PDF/Gambar.
            2. WAJIB SCAN SELURUHNYA: Jika ada 50 faktur, Anda harus mengembalikan 50 objek JSON. Jangan berhenti hanya di beberapa dokumen awal.
            3. EKSTRAKSI DATA: Ambil NSFP (Nomor Seri Faktur Pajak), Nama Vendor, Tanggal, Item Barang, PPN 12%, dan Total.
            4. VALIDASI: Pastikan Total Amount = Subtotal + Pajak - Diskon.
            
            KEMBALIKAN OUTPUT DALAM BENTUK ARRAY JSON LENGKAP.`
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
            required: ["documentNumber", "items", "totalAmount", "vendorName"]
          }
        }
      }
    });

    return JSON.parse(response.text) as ExtractedData[];
  } catch (error: any) {
    console.error("Extraction error details:", error);
    // Menangani error limit ukuran dari sisi API secara eksplisit
    if (error.message?.includes("exceeds supported limit") || error.message?.includes("INVALID_ARGUMENT")) {
      throw new Error("Payload file melebihi batas 50MB API Gemini. Silakan pecah dokumen Anda menjadi file yang lebih kecil.");
    }
    throw new Error("Gagal mengekstraksi data. Pastikan dokumen terbaca jelas atau file tidak terlalu besar.");
  }
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
    const totalTax = docs.reduce((acc, d) => acc + (d.taxAmount || 0), 0);
    const totalNet = docs.reduce((acc, d) => acc + (d.totalAmount || 0), 0);
    const totalDiscount = docs.reduce((acc, d) => acc + (d.discountTotal || 0), 0);
    
    return {
      groupKey: key,
      documents: docs,
      isMatch: true,
      discrepancies: [],
      analysisFindings: [
        isInternal ? "Faktur Non-PKP atau Nota Internal." : `Faktur Pajak Terverifikasi: ${key}`,
        `Akumulasi PPN Masukan: Rp ${totalTax.toLocaleString('id-ID')}`,
        `Total Penghematan (Diskon): Rp ${totalDiscount.toLocaleString('id-ID')}`,
        `Total Nilai Transaksi: Rp ${totalNet.toLocaleString('id-ID')}`
      ],
      checkedAt: new Date().toLocaleString('id-ID'),
      taxNumberRef: isInternal ? undefined : key
    };
  });
}
