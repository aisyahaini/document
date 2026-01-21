
import React, { useState, useEffect, useMemo } from 'react';
import { 
  FileText, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  LayoutDashboard, 
  ClipboardList, 
  Search,
  Building2,
  AlertTriangle,
  X,
  Printer,
  Trash2,
  Clock,
  Package,
  Receipt,
  ShieldAlert,
  Truck,
  FileSearch,
  Stamp,
  ArrowRight,
  Files,
  Activity
} from 'lucide-react';
import { ProcessingFile, ExtractedData, ReconciliationResult } from './types';
import { fileToBase64, processDocument, reconcileDocuments } from './services/geminiService';

const STORAGE_KEY_FILES = 'documatch_files';
const STORAGE_KEY_RECON = 'documatch_recon';

const App: React.FC = () => {
  const [files, setFiles] = useState<ProcessingFile[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_FILES);
    return saved ? JSON.parse(saved) : [];
  });
  
  const [reconResults, setReconResults] = useState<ReconciliationResult[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_RECON);
    return saved ? JSON.parse(saved) : [];
  });

  const [isProcessing, setIsProcessing] = useState(false);
  const [view, setView] = useState<'upload' | 'dashboard' | 'reconciliation'>('upload');
  const [selectedDoc, setSelectedDoc] = useState<ExtractedData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const filesToSave = files.map(f => ({ ...f, previewUrl: undefined }));
    localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(filesToSave));
  }, [files]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_RECON, JSON.stringify(reconResults));
  }, [reconResults]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    const newFiles = Array.from(event.target.files).map((file: File) => ({
      id: Math.random().toString(36).substring(2, 11),
      fileName: file.name,
      file,
      status: 'pending' as const
    }));
    setFiles(prev => [...prev, ...newFiles]);
  };

  const processAllFiles = async () => {
    setIsProcessing(true);
    const updatedFiles = [...files];
    for (let i = 0; i < updatedFiles.length; i++) {
      if (updatedFiles[i].status === 'completed') continue;
      try {
        updatedFiles[i].status = 'processing';
        setFiles([...updatedFiles]);
        const fileObj = (updatedFiles[i] as any).file;
        const base64 = await fileToBase64(fileObj);
        const data = await processDocument(base64, fileObj.type);
        updatedFiles[i].extractedData = data;
        updatedFiles[i].status = 'completed';
        updatedFiles[i].processedAt = new Date().toLocaleString('id-ID');
      } catch (error) {
        updatedFiles[i].status = 'error';
      }
      setFiles([...updatedFiles]);
    }
    const docs = updatedFiles.filter(f => f.status === 'completed' && f.extractedData).map(f => f.extractedData!);
    if (docs.length > 0) {
      const results = await reconcileDocuments(docs);
      setReconResults(results);
    }
    setIsProcessing(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const clearMemory = () => {
    if (window.confirm("Hapus semua data audit?")) {
      setFiles([]);
      setReconResults([]);
      localStorage.removeItem(STORAGE_KEY_FILES);
      localStorage.removeItem(STORAGE_KEY_RECON);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col no-print">
        <div className="p-6">
          <div className="flex items-center gap-2 text-blue-600 mb-8">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg shadow-lg shadow-blue-200"><ClipboardList size={24} /></div>
            <span className="font-bold text-xl text-slate-800 tracking-tight">DocuMatch AI</span>
          </div>
          <nav className="space-y-1 text-sm font-medium">
            <button onClick={() => setView('upload')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'upload' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}><Upload size={18} /> Upload</button>
            <button onClick={() => setView('dashboard')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}><LayoutDashboard size={18} /> Dashboard</button>
            <button onClick={() => setView('reconciliation')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${view === 'reconciliation' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}><Activity size={18} /> Rekonsiliasi</button>
          </nav>
        </div>
        <div className="mt-auto p-6"><button onClick={clearMemory} className="w-full flex items-center gap-3 px-4 py-3 text-red-500 text-sm hover:bg-red-50 rounded-xl transition-colors"><Trash2 size={18} /> Hapus Database</button></div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="h-20 bg-white border-b flex items-center justify-between px-8 sticky top-0 z-10 no-print">
          <h1 className="text-xl font-bold text-slate-800 uppercase tracking-tight">Finance Audit - CV Global Solusi</h1>
          <div className="relative"><Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} /><input type="text" placeholder="Cari nomor PO/PI..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-10 pr-4 py-2 bg-slate-100 rounded-full text-sm outline-none w-64 focus:w-80 transition-all border-none focus:ring-2 focus:ring-blue-500/20" /></div>
        </header>

        <div className="p-8 max-w-7xl mx-auto space-y-8">
          {view === 'upload' && (
            <div className="space-y-8 no-print">
              <div className="bg-white rounded-[40px] border-4 border-dashed border-slate-200 p-16 text-center hover:border-blue-400 cursor-pointer relative group transition-all">
                <input type="file" multiple onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*,.pdf" />
                <div className="mx-auto w-20 h-20 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 mb-6 group-hover:scale-110 transition-transform"><Upload size={40} /></div>
                <h3 className="text-2xl font-black text-slate-800 uppercase">Input Berkas Audit</h3>
                <p className="text-slate-500 font-medium tracking-tight">Mendukung Multi-Faktur per PO. Harap unggah PO diawali prefix "PO".</p>
              </div>
              
              {files.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl overflow-hidden">
                  <div className="px-8 py-6 border-b flex justify-between items-center bg-slate-50">
                    <h2 className="font-black uppercase text-slate-800 flex items-center gap-2 font-black"><FileSearch size={20} /> Antrean Dokumen ({files.length})</h2>
                    <button onClick={processAllFiles} disabled={isProcessing} className="bg-blue-600 text-white px-8 py-3 rounded-2xl text-sm font-black flex items-center gap-2 uppercase shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:bg-slate-300">
                      {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />} Mulai Sinkronisasi
                    </button>
                  </div>
                  <div className="divide-y">{files.map(f => (
                    <div key={f.id} className="p-6 flex items-center gap-6 hover:bg-slate-50 transition-colors">
                      <div className="w-12 h-16 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400"><FileText size={24} /></div>
                      <div className="flex-1">
                        <p className="text-sm font-black text-slate-900">{f.fileName}</p>
                        <span className={`text-[10px] uppercase font-bold ${f.status === 'completed' ? 'text-green-600' : 'text-slate-400'}`}>{f.status}</span>
                      </div>
                      {f.status === 'completed' && <CheckCircle2 className="text-green-500" size={24} />}
                      {f.status === 'processing' && <Loader2 className="animate-spin text-blue-600" size={24} />}
                      {f.status === 'error' && <AlertTriangle className="text-red-500" size={24} />}
                    </div>
                  ))}</div>
                </div>
              )}
            </div>
          )}

          {view === 'dashboard' && (
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl overflow-hidden">
              <table className="w-full text-left">
                <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                  <tr>
                    <th className="px-8 py-6">Kualitas Prefix</th>
                    <th className="px-8 py-6">Jenis & Nomor</th>
                    <th className="px-8 py-6">Tempo & Pajak</th>
                    <th className="px-8 py-6">Nilai Akhir</th>
                    <th className="px-8 py-6 text-center">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y">{files.filter(f => f.extractedData).map(f => {
                  const data = f.extractedData!;
                  const isPO = data.documentNumber.toUpperCase().startsWith('PO');
                  const isPI = data.documentNumber.toUpperCase().startsWith('PI');
                  const isCorrect = (data.documentType.includes('Pesanan') && isPO) || (data.documentType === 'Faktur Pembelian' && isPI) || !data.documentType.includes('Faktur');
                  
                  return (
                    <tr key={f.id} className="text-sm hover:bg-slate-50 group">
                      <td className="px-8 py-6">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isCorrect ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {isCorrect ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="font-black text-slate-900 uppercase">#{data.documentNumber}</div>
                        <div className="text-[10px] font-bold text-blue-600 uppercase flex items-center gap-1">
                          {data.documentType.includes('Surat Jalan') && <Truck size={12} />}
                          {data.documentType}
                        </div>
                      </td>
                      <td className="px-8 py-6">
                        <div className="font-bold text-slate-700">{data.date}</div>
                        <div className="text-[10px] font-black text-orange-600 uppercase">Tempo: {data.dueDuration || 'NET'} {data.taxInvoiceNumber && '| Pajak Tertera'}</div>
                      </td>
                      <td className="px-8 py-6 font-black text-slate-900">{formatCurrency(data.totalAmount || 0)}</td>
                      <td className="px-8 py-6 text-center">
                        <button onClick={() => setSelectedDoc(data)} className="bg-slate-100 px-6 py-2 rounded-xl text-blue-600 font-black uppercase text-[10px] hover:bg-blue-600 hover:text-white transition-all shadow-sm">Detail</button>
                      </td>
                    </tr>
                  );
                })}</tbody>
              </table>
            </div>
          )}

          {view === 'reconciliation' && (
            <div className="space-y-8 no-print">
              <div className="flex justify-end"><button onClick={() => window.print()} className="bg-slate-900 text-white px-8 py-3 rounded-2xl text-sm font-black flex items-center gap-3 uppercase shadow-xl hover:bg-slate-800 transition-all"><Printer size={20} /> Cetak Laporan</button></div>
              {reconResults.map((result, idx) => (
                <div key={idx} className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden break-inside-avoid">
                  <div className={`p-8 border-b flex items-center justify-between ${result.isMatch ? 'bg-green-50' : 'bg-red-50'}`}>
                    <div className="flex items-center gap-6">
                      <div className={`p-4 rounded-3xl shadow-lg ${result.isMatch ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {result.isMatch ? <ShieldAlert size={32} /> : <AlertTriangle size={32} />}
                      </div>
                      <div>
                        <h3 className="font-black text-2xl text-slate-900 uppercase tracking-tight">Transaksi: {result.groupKey}</h3>
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Master PO & Multi-Faktur Reconciliation</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-2">
                      <span className={`px-6 py-2 rounded-full text-xs font-black uppercase shadow-sm ${result.isMatch ? 'bg-white text-green-700 border border-green-200' : 'bg-white text-red-700 border border-red-200'}`}>
                        {result.isMatch ? 'Audit Lolos' : 'Perlu Investigasi'}
                      </span>
                      {(result as any).taxNumberRef && (
                         <div className="flex items-center gap-2 text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg border border-blue-100">
                           <Receipt size={12} /> No. Pajak: {(result as any).taxNumberRef}
                         </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="p-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
                    <div className="space-y-6">
                      <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] border-b pb-3 flex items-center gap-2 font-black"><Files size={14} /> Berkas Dalam Rantai Transaksi</h4>
                      <div className="space-y-4">
                        {result.documents.map((doc, dIdx) => (
                          <div key={dIdx} onClick={() => setSelectedDoc(doc)} className="p-5 rounded-[32px] border bg-slate-50 hover:border-blue-500 hover:bg-white transition-all cursor-pointer shadow-sm group">
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-[10px] font-black uppercase text-blue-600 flex items-center gap-2">
                                {doc.documentType.includes('Surat Jalan') ? <Truck size={14} /> : doc.documentType.includes('Pesanan') ? <Building2 size={14} /> : <FileText size={14} />}
                                {doc.documentType}
                              </span>
                              <span className="text-xs font-black text-slate-900">{formatCurrency(doc.totalAmount)}</span>
                            </div>
                            <div className="text-[10px] font-bold text-slate-500 space-y-1">
                               <div className="flex justify-between">
                                  <span>Nomor: <span className="text-slate-900 font-mono">#{doc.documentNumber}</span></span>
                                  {doc.dueDuration && <span className="text-orange-600">Tempo: {doc.dueDuration}</span>}
                               </div>
                               <div>Entitas: <span className="text-slate-800 uppercase text-[9px]">{doc.vendorName}</span></div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-6">
                      <h4 className="text-[11px] font-black uppercase text-slate-400 tracking-[0.2em] border-b pb-3 flex items-center gap-2"><Activity size={14} /> Laporan Temuan AI</h4>
                      <div className="bg-slate-900 rounded-[32px] p-8 space-y-6 shadow-xl">
                        <div className="space-y-4">
                          {result.analysisFindings.map((f, fIdx) => (
                            <div key={fIdx} className="flex gap-4 text-xs font-medium text-slate-300 items-start">
                              <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5 flex-shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.6)]" />
                              <span className="leading-relaxed">{f}</span>
                            </div>
                          ))}
                        </div>
                        
                        {result.discrepancies.length > 0 && (
                          <div className="pt-6 border-t border-white/10 space-y-3">
                             <div className="text-[10px] font-black text-red-400 uppercase tracking-widest flex items-center gap-2"><AlertCircle size={14} /> Peringatan Fatal:</div>
                             {result.discrepancies.map((d, dIdx) => (
                               <div key={dIdx} className="p-4 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl text-[11px] font-bold flex gap-3 items-start">
                                  <AlertTriangle size={16} className="flex-shrink-0" /> {d}
                               </div>
                             ))}
                          </div>
                        )}
                        
                        {result.isMatch && (
                          <div className="p-5 bg-green-500/10 border border-green-500/20 text-green-400 rounded-2xl text-[11px] font-bold flex items-center gap-3">
                            <CheckCircle2 size={18} /> Verifikasi Master PO dan Rantai Pasokan Sesuai Standar CV Global Solusi.
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md no-print" onClick={() => setSelectedDoc(null)}></div>
          <div className="relative bg-white w-full max-w-5xl rounded-[50px] shadow-2xl overflow-hidden border-4 border-white transition-all transform scale-100">
            <div className={`p-10 flex items-center justify-between no-print ${selectedDoc.documentNumber.toUpperCase().startsWith('PO') ? 'bg-slate-900 text-white' : 'bg-blue-600 text-white'}`}>
              <div className="flex items-center gap-6">
                <div className="p-4 bg-white/20 rounded-[28px] shadow-inner">
                  {selectedDoc.documentType.includes('Surat Jalan') ? <Truck size={32} /> : <Building2 size={32} />}
                </div>
                <div>
                  <h2 className="text-3xl font-black uppercase tracking-tight leading-none mb-2">{selectedDoc.documentType}</h2>
                  <p className="text-xs font-bold opacity-70 tracking-widest uppercase">ID Berkas: #{selectedDoc.documentNumber}</p>
                </div>
              </div>
              <button onClick={() => setSelectedDoc(null)} className="p-4 hover:bg-white/10 rounded-full text-white transition-colors"><X size={32} /></button>
            </div>

            <div className="p-12 space-y-12 overflow-y-auto max-h-[70vh]">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
                <div className="space-y-4">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] border-b pb-3">Audit Header</h4>
                  <div className="space-y-3 text-sm font-bold text-slate-700">
                    <div className="flex justify-between"><span>Tanggal:</span><span className="text-slate-900">{selectedDoc.date}</span></div>
                    <div className="flex justify-between"><span>Tempo:</span><span className="text-blue-600 uppercase font-black">{selectedDoc.dueDuration || 'NET'}</span></div>
                    <div className="flex justify-between"><span>Jatuh Tempo:</span><span className="text-orange-600">{selectedDoc.dueDate || '-'}</span></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] border-b pb-3">Fiskal</h4>
                  <div className="space-y-3 text-sm font-bold text-slate-700">
                    <div className="flex justify-between items-center">
                      <span>No. Pajak:</span>
                      <span className="text-slate-900 font-mono text-xs bg-slate-100 px-2 py-1 rounded-lg border">{selectedDoc.taxInvoiceNumber || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between"><span>PPN Terhitung:</span><span className="text-green-600 font-black">{formatCurrency(selectedDoc.taxAmount || 0)}</span></div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] border-b pb-3">Entitas Bisnis</h4>
                  <div className="space-y-3 text-sm font-bold text-slate-700">
                    <div className="flex justify-between"><span>Asal:</span><span className="text-slate-900 uppercase text-xs truncate max-w-[150px] font-black">{selectedDoc.vendorName}</span></div>
                    <div className="flex justify-between"><span>Tujuan:</span><span className="text-slate-900 uppercase text-xs truncate max-w-[150px] font-black">{selectedDoc.customerName}</span></div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em] flex items-center gap-3 font-black"><Package size={16} /> Rincian Transaksi Item</h4>
                <div className="border-[3px] border-slate-100 rounded-[40px] overflow-hidden shadow-sm">
                  <table className="w-full text-left">
                    <thead className="bg-slate-900 text-white text-[10px] font-black uppercase">
                      <tr><th className="px-10 py-6">Deskripsi Barang</th><th className="px-10 py-6 text-center">Qty</th><th className="px-10 py-6 text-right">Harga Satuan</th><th className="px-10 py-6 text-center bg-blue-600/10 text-blue-400">Disk</th><th className="px-10 py-6 text-right">Total Net</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">{selectedDoc.items.map((item, i) => (
                      <tr key={i} className="text-sm hover:bg-slate-50 transition-colors font-bold">
                        <td className="px-10 py-6 text-slate-900 uppercase leading-tight">{item.description}</td>
                        <td className="px-10 py-6 text-center text-slate-600">{item.quantity}</td>
                        <td className="px-10 py-6 text-right text-slate-600">{formatCurrency(item.unitPrice)}</td>
                        <td className="px-10 py-6 text-center text-orange-600">{item.discountPercentage ? `${item.discountPercentage}%` : '-'}</td>
                        <td className="px-10 py-6 text-right text-slate-900">{formatCurrency(item.totalPrice)}</td>
                      </tr>
                    ))}</tbody>
                  </table>
                </div>
              </div>

              <div className="flex justify-end">
                <div className="w-full max-w-sm bg-slate-900 p-10 rounded-[40px] text-white space-y-6 shadow-2xl border border-white/5">
                  <div className="flex justify-between text-[11px] font-black uppercase text-slate-500 border-b border-white/10 pb-3"><span>Bruto Subtotal</span><span>{formatCurrency(selectedDoc.totalAmount - (selectedDoc.taxAmount || 0))}</span></div>
                  <div className="flex justify-between text-[11px] font-black uppercase text-blue-400 border-b border-white/10 pb-3"><span>Pajak PPN</span><span>{formatCurrency(selectedDoc.taxAmount || 0)}</span></div>
                  <div className="flex justify-between items-center pt-2">
                    <span className="text-[11px] font-black uppercase text-slate-300">Total Audit Terverifikasi</span>
                    <span className="text-3xl font-black text-blue-400 tracking-tighter drop-shadow-lg">{formatCurrency(selectedDoc.totalAmount)}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-10 bg-slate-50 border-t flex justify-end gap-6 no-print">
              <button onClick={() => setSelectedDoc(null)} className="px-10 py-4 bg-white border-2 font-black rounded-2xl text-xs uppercase text-slate-500 hover:bg-slate-100 transition-all">Tutup</button>
              <button onClick={() => window.print()} className="px-10 py-4 bg-blue-600 text-white font-black rounded-2xl text-xs flex items-center gap-3 uppercase shadow-xl shadow-blue-200 transition-all hover:bg-blue-700 shadow-blue-500/20"><Printer size={18} /> Cetak Laporan Audit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
