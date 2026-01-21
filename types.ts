
export enum DocumentType {
  PURCHASE_ORDER = 'Pesanan Pembelian (PO)',
  PURCHASE_INVOICE = 'Faktur Pembelian',
  SALES_INVOICE = 'Faktur Penjualan',
  GOODS_RECEIPT = 'Penerimaan Barang',
  DELIVERY_NOTE = 'Surat Jalan',
  TAX_INVOICE = 'Faktur Pajak'
}

export interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercentage?: number;
  discountAmount?: number;
  totalPrice: number;
}

export interface ExtractedData {
  documentType: DocumentType;
  documentNumber: string;
  referenceNumber?: string;
  date: string; // Issue date
  purchaseDate?: string;
  dueDate?: string;
  dueDuration?: string; // New: explicit duration/tempo from file (e.g. "30 Hari")
  receiptDate?: string;
  taxInvoiceNumber?: string;
  vendorName: string;
  customerName: string;
  items: LineItem[];
  totalAmount: number;
  taxAmount?: number;
}

export interface ProcessingFile {
  id: string;
  fileName: string;
  previewUrl?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  extractedData?: ExtractedData;
  errorMessage?: string;
  processedAt?: string;
}

export interface ReconciliationResult {
  groupKey: string;
  documents: ExtractedData[];
  isMatch: boolean;
  discrepancies: string[];
  analysisFindings: string[]; // Detailed findings about price/discount matches
  checkedAt: string;
}
