
import { GoogleGenAI, Type } from "@google/genai";
import { ExtractedData, DocumentType } from "../types";

// Always use the process.env.API_KEY directly for initialization.
// The key is provided by the environment, so we do not prompt for it or provide a default empty string.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Helper to encode file to base64
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

/**
 * Processes a business document image/PDF to extract structured data.
 * Uses gemini-3-flash-preview as it is highly efficient for text extraction and classification tasks.
 */
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
          text: `Extract structured data from this business document. 
          Classify it into one of these types: Pesanan Pembelian (PO), Faktur Pembelian, Faktur Penjualan, Penerimaan Barang, Surat Jalan, or Faktur Pajak.
          Provide the output as JSON.`
        }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          documentType: { type: Type.STRING, description: "One of the listed document types" },
          documentNumber: { type: Type.STRING },
          referenceNumber: { type: Type.STRING, description: "Reference to PO, SO, or Delivery Note if found" },
          date: { type: Type.STRING },
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

  // Correctly access text from the response object as a property
  const text = response.text;
  if (!text) throw new Error("No response from AI");
  
  return JSON.parse(text) as ExtractedData;
}

export async function reconcileDocuments(documents: ExtractedData[]): Promise<any> {
  // Logic to group documents and find discrepancies
  // This could also be an AI call, but simple logic often works better for exact matches
  const groups: Record<string, ExtractedData[]> = {};
  
  documents.forEach(doc => {
    const key = doc.referenceNumber || doc.documentNumber;
    if (!groups[key]) groups[key] = [];
    groups[key].push(doc);
  });

  const reconciliation = Object.entries(groups).map(([key, docs]) => {
    const discrepancies: string[] = [];
    
    // Check if we have both a PO and an Invoice to compare
    const po = docs.find(d => d.documentType.includes('Pesanan Pembelian'));
    const invoice = docs.find(d => d.documentType.includes('Faktur Pembelian'));
    const gr = docs.find(d => d.documentType.includes('Penerimaan Barang') || d.documentType.includes('Surat Jalan'));

    if (po && invoice) {
      if (Math.abs(po.totalAmount - invoice.totalAmount) > 1) {
        discrepancies.push(`Total amount mismatch: PO (${po.totalAmount}) vs Invoice (${invoice.totalAmount})`);
      }
    }

    if (po && gr) {
       // Compare total quantities
       const poQty = po.items.reduce((sum, i) => sum + i.quantity, 0);
       const grQty = gr.items.reduce((sum, i) => sum + i.quantity, 0);
       if (poQty !== grQty) {
          discrepancies.push(`Quantity mismatch: PO requested ${poQty} items, GR received ${grQty} items`);
       }
    }

    return {
      groupKey: key,
      documents: docs,
      isMatch: discrepancies.length === 0,
      discrepancies
    };
  });

  return reconciliation;
}
