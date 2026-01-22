
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
  taxAmount?: number; // PPN per line item
  totalPrice: number;
}

export interface ExtractedData {
  documentType: DocumentType;
  documentNumber: string;
  referenceNumber?: string;
  date: string;
  taxInvoiceNumber?: string;
  vendorName: string;
  customerName: string;
  items: LineItem[];
  subtotalAmount: number;
  taxAmount: number;
  discountTotal: number;
  totalAmount: number;
}

export interface ProcessingFile {
  id: string;
  fileName: string;
  previewUrl?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  extractedDocs?: ExtractedData[]; // Support for multiple documents per file
  errorMessage?: string;
  processedAt?: string;
}

export interface ReconciliationResult {
  groupKey: string;
  documents: ExtractedData[];
  isMatch: boolean;
  discrepancies: string[];
  analysisFindings: string[];
  checkedAt: string;
  taxNumberRef?: string;
}
