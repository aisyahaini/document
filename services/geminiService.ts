
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
          Identifikasi SETIAP nota/faktur secara individu.
          
          ATURAN PERHITUNGAN PPN (TAX) KETAT:
          1. Hitung PPN (taxAmount) untuk SETIAP BARIS ITEM (Line Item). 
          2. Gunakan tarif PPN 12% dari (Harga Satuan * Qty - Diskon Item).
          3. Total PPN Dokumen (taxAmount di tingkat root) HARUS merupakan hasil penjumlahan dari seluruh taxAmount per item.
          4. Pastikan data berikut diekstrak:
             - Nama Barang, Qty, Harga Satuan.
             - Diskon per item (jika ada).
             - PPN per item (WAJIB ADA).
             - Nomor Seri Faktur Pajak (NSFP) jika ada.
          5. Validasi Matematika: Total Akhir = Sum(Semua Total Price Item). Dimana Total Price Item = (Qty * Harga) - Diskon + PPN.
          
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
            subtotalAmount: { type: Type.NUMBER, description: "Total bruto sebelum diskon dan pajak" },
            taxAmount: { type: Type.NUMBER, description: "Total akumulasi PPN dari semua item" },
            discountTotal: { type: Type.NUMBER, description: "Total akumulasi diskon dari semua item" },
            totalAmount: { type: Type.NUMBER, description: "Grand total bersih yang harus dibayar" },
            items: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  description: { type: Type.STRING },
                  quantity: { type: Type.NUMBER },
                  unitPrice: { type: Type.NUMBER },
                  discountAmount: { type: Type.NUMBER },
                  taxAmount: { type: Type.NUMBER, description: "PPN 12% untuk item ini" },
                  totalPrice: { type: Type.NUMBER, description: "Net price untuk item ini (Qty*Price - Disc + Tax)" }
                },
                required: ["description", "quantity", "unitPrice", "taxAmount", "totalPrice"]
              }
            }
          },
          required: ["documentType", "documentNumber", "date", "items", "totalAmount", "taxAmount"]
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
    
    const totalTaxFromItems = docs.reduce((acc, doc) => acc + (doc.taxAmount || 0), 0);
    analysisFindings.push(`Total PPN terakumulasi dari rincian barang: Rp ${totalTaxFromItems.toLocaleString('id-ID')}`);

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
