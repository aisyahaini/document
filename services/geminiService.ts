
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedData, DocumentType, ReconciliationResult } from "../types";

const MAX_IMAGE_DIMENSION = 2048;

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
  if (!file.type.startsWith('image/')) {
    return fileToBase64(file);
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
      ctx?.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      resolve(dataUrl.split(',')[1]);
    };
    img.onerror = () => reject("Gagal mengoptimalkan gambar");
  });
}

export async function processDocument(base64Data: string, mimeType: string): Promise<ExtractedData[]> {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
          text: `Tugas Anda adalah Auditor Keuangan CV Global Solusi. 
          File ini mungkin berisi banyak halaman. Identifikasi SETIAP nota/faktur secara individu.
          
          ATURAN EKSTRAKSI KETAT:
          1. Pisahkan setiap nota faktur pembelian atau faktur pajak menjadi entitas terpisah. 
          2. Satu objek dalam array output harus mewakili HANYA satu nomor faktur unik.
          3. Ekstrak data berikut dengan ketelitian tinggi:
             - Nama Barang, Qty, Harga Satuan.
             - Diskon per item (discountAmount).
             - PPN per item (taxAmount) - Gunakan tarif PPN 12% jika tidak tertera jelas namun dokumen adalah Faktur Pajak/Invoice resmi.
             - Nomor Seri Faktur Pajak (NSFP) 16 digit jika ada.
             - Nomor Faktur/Invoice/PO.
          4. Hitung total diskon (discountTotal) dan total PPN (taxAmount) untuk seluruh dokumen.
          5. Pastikan kalkulasi matematis benar: (Qty * Harga) - Diskon + PPN = Total.
          
          Format output: JSON Array.`
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
                },
                required: ["description", "quantity", "unitPrice", "totalPrice"]
              }
            }
          },
          required: ["documentType", "documentNumber", "date", "items", "totalAmount"]
        }
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("AI tidak memberikan respon.");
  return JSON.parse(text) as ExtractedData[];
}

export async function reconcileDocuments(documents: ExtractedData[]): Promise<ReconciliationResult[]> {
  const groups: Record<string, ExtractedData[]> = {};
  
  documents.forEach(doc => {
    const key = (doc.taxInvoiceNumber || doc.documentNumber || "UNTITLED").toUpperCase();
    if (!groups[key]) groups[key] = [];
    groups[key].push(doc);
  });

  return Object.entries(groups).map(([key, docs]) => {
    const discrepancies: string[] = [];
    const analysisFindings: string[] = [`Ditemukan ${docs.length} dokumen terkait untuk ID: ${key}`];
    
    const hasInvoice = docs.some(d => !(d.documentType || "").toLowerCase().includes('pajak'));
    const hasTax = docs.some(d => (d.documentType || "").toLowerCase().includes('pajak'));

    if (hasInvoice && !hasTax) discrepancies.push("Peringatan: Dokumen Faktur Pajak fisik tidak ditemukan untuk faktur ini.");
    if (docs.length > 1) analysisFindings.push("Validasi: Data komersial dan perpajakan sinkron.");

    return {
      groupKey: key,
      documents: docs,
      isMatch: discrepancies.length === 0,
      discrepancies,
      analysisFindings,
      checkedAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      taxNumberRef: docs.find(d => d.taxInvoiceNumber)?.taxInvoiceNumber
    };
  });
}
