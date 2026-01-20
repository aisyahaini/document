
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
  totalPrice: number;
}

export interface ExtractedData {
  documentType: DocumentType;
  documentNumber: string;
  referenceNumber?: string; // e.g. PO number referenced in Invoice
  date: string;
  vendorName: string;
  customerName: string;
  items: LineItem[];
  totalAmount: number;
  taxAmount?: number;
}

export interface ProcessingFile {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  extractedData?: ExtractedData;
  errorMessage?: string;
}

export interface ReconciliationResult {
  groupKey: string; // usually the PO number
  documents: ExtractedData[];
  isMatch: boolean;
  discrepancies: string[];
}
