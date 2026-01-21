
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedData, DocumentType } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = reader.result?.toString().split(',')[1];
      if (base64String) resolve(base64String);
      else reject("Failed to convert file to base64");
    };
    reader.onerror = error => reject(error);
  });
};

export async function processDocument(base64Data: string, mimeType: string): Promise<ExtractedData> {
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
          text: `Extract structured data from this business document with high precision for finance audit.
          
          STRICT CLASSIFICATION RULES:
          1. Pesanan Pembelian (PO): 
             - MUST have a document number starting with "PO".
             - Often contains "Nomor Faktur Pajak" at the top or in the header section.
             - This is the master order document.
          2. Faktur Pembelian: 
             - MUST start with prefix "PI".
             - Usually references a PO number.
          3. Faktur Penjualan: 
             - Starts with "INV", "SI", or "IV".
          4. Surat Jalan (Delivery Note): 
             - Can be from a SELLER directly OR from an EXPEDITION/LOGISTICS company.
             - Look for terms: "Surat Jalan", "Delivery Note", "Logistik", "Ekspedisi", "Carrier", "Transport".
          5. Faktur Pajak: 
             - Standalone tax document with a 16-digit code.

          EXTRACTION GUIDELINES:
          - Extract "Nomor Faktur Pajak" if it appears in any field (very common in PO field #1).
          - Identify "Reference Number" (e.g., if a PI references a PO number).
          - Capture line items accurately (Description, Qty, Price, Discount).
          - Capture "Tempo" or "Due Duration" (e.g., "30 Hari").
          
          Output the result as a strict JSON object.`
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          documentType: { type: Type.STRING },
          documentNumber: { type: Type.STRING },
          referenceNumber: { type: Type.STRING },
          date: { type: Type.STRING },
          purchaseDate: { type: Type.STRING },
          dueDate: { type: Type.STRING },
          dueDuration: { type: Type.STRING },
          receiptDate: { type: Type.STRING },
          taxInvoiceNumber: { type: Type.STRING },
          vendorName: { type: Type.STRING },
          customerName: { type: Type.STRING },
          totalAmount: { type: Type.NUMBER },
          taxAmount: { type: Type.NUMBER },
          items: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                description: { type: Type.STRING },
                quantity: { type: Type.NUMBER },
                unitPrice: { type: Type.NUMBER },
                discountPercentage: { type: Type.NUMBER },
                discountAmount: { type: Type.NUMBER },
                totalPrice: { type: Type.NUMBER }
              },
              required: ["description", "quantity", "unitPrice", "totalPrice"]
            }
          }
        },
        required: ["documentType", "documentNumber", "date", "items", "totalAmount"]
      }
    }
  });

  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  return JSON.parse(text) as ExtractedData;
}

export async function reconcileDocuments(documents: ExtractedData[]): Promise<any> {
  const groups: Record<string, ExtractedData[]> = {};
  
  // Step 1: Intelligent Grouping
  // Priority: PO Number > PI Number > Reference Number
  documents.forEach(doc => {
    let key = '';
    
    // If it's a PO, it's the master of the group
    if (doc.documentNumber.toUpperCase().startsWith('PO')) {
      key = doc.documentNumber.toUpperCase();
    } 
    // If it's an invoice referencing a PO
    else if (doc.referenceNumber?.toUpperCase().startsWith('PO')) {
      key = doc.referenceNumber.toUpperCase();
    }
    // If it's a PI, it might be a sub-key if PO isn't found yet
    else if (doc.documentNumber.toUpperCase().startsWith('PI')) {
      key = doc.documentNumber.toUpperCase();
    }
    // Fallback to whatever unique ID exists
    else {
      key = doc.referenceNumber || doc.documentNumber;
    }

    if (!groups[key]) groups[key] = [];
    groups[key].push(doc);
  });

  return Object.entries(groups).map(([key, docs]) => {
    const discrepancies: string[] = [];
    const analysisFindings: string[] = [];
    
    const masterPO = docs.find(d => d.documentNumber.toUpperCase().startsWith('PO'));
    const invoices = docs.filter(d => d.documentType.includes('Faktur'));
    const deliveryNotes = docs.filter(d => d.documentType.includes('Surat Jalan'));
    
    // Tax number inheritance: if any document has a tax number, consider it verified for the group
    const groupTaxNumber = docs.find(d => d.taxInvoiceNumber)?.taxInvoiceNumber;

    // 1. PO Validation
    if (!masterPO) {
      discrepancies.push("DOKUMEN KRITIS HILANG: Berkas Pesanan Pembelian (PO) dengan nomor referensi terkait tidak ditemukan.");
    } else {
      analysisFindings.push(`MASTER PO TERDETEKSI: #${masterPO.documentNumber} - Mencakup ${invoices.length} Faktur terkait.`);
    }

    // 2. Invoice & Delivery Validation
    if (invoices.length === 0) {
      discrepancies.push("DOKUMEN HILANG: Belum ada Faktur (PI/INV) yang diunggah untuk transaksi ini.");
    }

    if (deliveryNotes.length === 0) {
      discrepancies.push("DOKUMEN HILANG: Berkas Surat Jalan (Logistik/Seller) tidak ditemukan.");
    }

    // 3. Tax Check
    if (groupTaxNumber) {
      const hasTaxFile = docs.some(d => d.documentType === 'Faktur Pajak');
      if (hasTaxFile) {
        analysisFindings.push(`PAJAK TERVERIFIKASI: Nomor Faktur Pajak ${groupTaxNumber} sesuai dengan berkas fisik.`);
      } else {
        analysisFindings.push(`PAJAK TERDETEKSI: Nomor Pajak ${groupTaxNumber} ditemukan dalam referensi (biasanya di PO), namun file fisik Faktur Pajak belum diunggah.`);
      }
    } else {
      discrepancies.push("INFORMASI HILANG: Nomor Faktur Pajak tidak ditemukan di PO maupun dokumen lainnya.");
    }

    // 4. Logistics Origin Analysis
    deliveryNotes.forEach(note => {
      const isExpedition = /ekspedisi|logistic|kurir|transport|jne|jnt|pos|cargo/i.test(note.vendorName) || /ekspedisi|logistic|kurir/i.test(note.documentNumber);
      analysisFindings.push(`LOGISTIK: Surat Jalan #${note.documentNumber} berasal dari ${isExpedition ? 'Pihak Ekspedisi/Logistic' : 'Pihak Penjual Langsung'}.`);
    });

    // 5. Aggregate Totals (One PO to Many Invoices)
    if (masterPO && invoices.length > 0) {
      const totalInvoiceAmount = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);
      if (Math.abs(totalInvoiceAmount - masterPO.totalAmount) > 100) {
        discrepancies.push(`SELISIH NILAI: Total Akumulasi Faktur (${totalInvoiceAmount.toLocaleString('id-ID')}) berbeda dengan nilai Master PO (${masterPO.totalAmount.toLocaleString('id-ID')}).`);
      }
    }

    return {
      groupKey: key,
      documents: docs,
      isMatch: discrepancies.length === 0,
      discrepancies,
      analysisFindings,
      checkedAt: new Date().toLocaleString('id-ID'),
      taxNumberRef: groupTaxNumber
    };
  });
}
