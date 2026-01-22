
import React, { useState, useEffect } from 'react';
import { 
  FileText, Upload, CheckCircle2, Loader2, LayoutDashboard, ClipboardList, Search,
  Building2, X, Printer, Trash2, Package, Receipt, Activity,
  FileSearch, FileCheck, Hash, Stamp, Files, Clock, ChevronDown, ChevronUp, Split, Calendar,
  AlertCircle, FileDown, TrendingUp, ShieldCheck, Tag
} from 'lucide-react';
import { ProcessingFile, ExtractedData, ReconciliationResult } from './types';
import { optimizeImage, processDocument, reconcileDocuments } from './services/geminiService';

const STORAGE_KEY_FILES = 'documatch_files';
const STORAGE_KEY_RECON = 'documatch_recon';

const LOADING_STATUSES = [
  "Menganalisis struktur dokumen...",
  "Mendeteksi teks dan tabel barang...",
  "Menghitung PPN dan Total Nilai...",
  "Memisahkan Faktur Pajak & Nota...",
  "Menyusun laporan audit PDF...",
];

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
  const [statusIdx, setStatusIdx] = useState(0);
  const [view, setView] = useState<'upload' | 'dashboard' | 'reconciliation'>('upload');
  const [selectedDoc, setSelectedDoc] = useState<ExtractedData | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const filesToSave = files.map(({ file, ...rest }: any) => ({ ...rest }));
    localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(filesToSave));
  }, [files]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_RECON, JSON.stringify(reconResults));
  }, [reconResults]);

  useEffect(() => {
    let interval: any;
    if (isProcessing) {
      interval = setInterval(() => {
        setStatusIdx(prev => (prev + 1) % LOADING_STATUSES.length);
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [isProcessing]);

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

  const handleDeleteFile = (id: string) => {
    if (confirm("Hapus file ini dari daftar antrean?")) {
      setFiles(prev => prev.filter(f => f.id !== id));
    }
  };

  const processAllFiles = async () => {
    if (isProcessing) return;
    setIsProcessing(true);
    
    const updatedFiles = [...files];
    const allExtracted: ExtractedData[] = [];
    
    for (let i = 0; i < updatedFiles.length; i++) {
      if (updatedFiles[i].status === 'completed') {
        if (updatedFiles[i].extractedDocs) allExtracted.push(...updatedFiles[i].extractedDocs!);
        continue;
      }
      
      try {
        updatedFiles[i].status = 'processing';
        setFiles([...updatedFiles]);
        
        const fileObj = (updatedFiles[i] as any).file;
        if (!fileObj) {
          updatedFiles[i].status = 'error';
          continue;
        }

        const base64 = await optimizeImage(fileObj);
        const docs = await processDocument(base64, fileObj.type);
        
        updatedFiles[i].extractedDocs = docs;
        updatedFiles[i].status = 'completed';
        updatedFiles[i].processedAt = new Date().toLocaleString('id-ID');
        allExtracted.push(...docs);
      } catch (error) {
        console.error("Error:", error);
        updatedFiles[i].status = 'error';
      }
      setFiles([...updatedFiles]);
    }

    if (allExtracted.length > 0) {
      const results = await reconcileDocuments(allExtracted);
      setReconResults(results);
    }
    
    setIsProcessing(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const totalInvoices = reconResults.reduce((acc, curr) => acc + curr.documents.length, 0);
  const totalAmountAudit = reconResults.reduce((acc, curr) => 
    acc + curr.documents.reduce((docAcc, doc) => docAcc + doc.totalAmount, 0), 0
  );
  const totalTaxAudit = reconResults.reduce((acc, curr) => 
    acc + curr.documents.reduce((docAcc, doc) => docAcc + doc.taxAmount, 0), 0
  );

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 text-white hidden lg:flex flex-col no-print shadow-2xl">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-12">
            <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-500/20"><ClipboardList size={24} /></div>
            <span className="font-black text-xl tracking-tighter uppercase">DocuMatch AI</span>
          </div>
          <nav className="space-y-3">
            <button onClick={() => setView('upload')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all font-bold text-sm ${view === 'upload' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Upload size={18} /> Unggah Bundle</button>
            <button onClick={() => setView('dashboard')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all font-bold text-sm ${view === 'dashboard' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><LayoutDashboard size={18} /> Data Terurai</button>
            <button onClick={() => setView('reconciliation')} className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all font-bold text-sm ${view === 'reconciliation' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800'}`}><Activity size={18} /> Laporan Audit</button>
          </nav>
        </div>
        <div className="mt-auto p-8 border-t border-slate-800">
           <button onClick={() => {if(confirm("Hapus semua data?")) { localStorage.clear(); location.reload(); }}} className="w-full flex items-center gap-4 px-5 py-4 text-red-400 text-xs font-bold uppercase hover:bg-red-500/10 rounded-xl transition-all"><Trash2 size={16} /> Bersihkan Data</button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto">
        <header className="h-20 bg-white border-b flex items-center justify-between px-10 sticky top-0 z-10 no-print">
          <div>
            <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Finance Audit Hub</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">CV Global Solusi • Sistem Rekonsiliasi Otomatis</p>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Cari ID Faktur..." 
                className="pl-12 pr-6 py-2.5 bg-slate-100 rounded-full text-sm outline-none w-64 border-none focus:ring-2 focus:ring-blue-500/20 font-medium"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </header>

        {/* Kop Surat Laporan (Hanya Muncul Saat Print) */}
        <div className="hidden print:block p-12 text-center border-b-[6px] border-slate-900 mb-10">
           <div className="flex items-center justify-between mb-8">
              <div className="text-left">
                 <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 leading-none">CV GLOBAL SOLUSI</h1>
                 <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-2">Jl. Audit Digital No. 102, Jakarta Selatan</p>
                 <p className="text-xs text-slate-400 font-medium">Email: finance@globalsolusi.co.id | Telp: (021) 555-0192</p>
              </div>
              <div className="bg-slate-900 text-white p-6 rounded-3xl">
                 <ShieldCheck size={48} />
              </div>
           </div>
           <div className="bg-slate-50 py-4 border-y-2 border-slate-200">
              <h2 className="text-2xl font-black uppercase tracking-widest text-slate-800">LAPORAN REKONSILIASI GABUNGAN (PDF)</h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.5em] mt-1">Generated by DocuMatch AI Hub • Internal Audit Only</p>
           </div>
        </div>

        <div className="p-8 lg:p-12 max-w-6xl mx-auto space-y-10">
          {view === 'upload' && (
            <div className="space-y-10 animate-in fade-in">
              <div className="bg-white rounded-[40px] border-4 border-dashed border-slate-200 p-20 text-center hover:border-blue-500 hover:bg-blue-50/10 transition-all relative group cursor-pointer shadow-xl shadow-slate-200/50">
                <input type="file" multiple onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*,.pdf" />
                <div className="mx-auto w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center text-blue-600 mb-8 group-hover:scale-110 transition-all"><Upload size={40} /></div>
                <h3 className="text-2xl font-black text-slate-900 uppercase">Drop Bundle Faktur Anda</h3>
                <p className="text-slate-500 font-medium mt-4 max-w-md mx-auto">Satu file PDF dapat berisi banyak nota. AI akan memecah data secara otomatis per nomor faktur.</p>
              </div>

              {files.length > 0 && (
                <div className="bg-white rounded-[32px] border border-slate-200 shadow-2xl overflow-hidden">
                  <div className="px-10 py-8 border-b bg-slate-50 flex justify-between items-center">
                    <h2 className="font-black uppercase text-slate-800 flex items-center gap-3"><FileSearch size={20} className="text-blue-600" /> Bundle Antrean ({files.length})</h2>
                    <button 
                      onClick={processAllFiles} 
                      disabled={isProcessing}
                      className="bg-blue-600 text-white px-8 py-4 rounded-2xl text-sm font-black flex items-center gap-3 uppercase shadow-lg shadow-blue-500/20 active:scale-95 transition-all disabled:bg-slate-300"
                    >
                      {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />} {isProcessing ? "Memproses..." : "Ekstrak Sekarang"}
                    </button>
                  </div>
                  
                  {isProcessing && (
                    <div className="bg-blue-600 text-white p-6 text-center animate-pulse flex flex-col items-center gap-2">
                       <p className="font-black uppercase tracking-widest text-lg animate-bounce">{LOADING_STATUSES[statusIdx]}</p>
                       <p className="text-xs text-blue-100 font-bold uppercase">Harap tunggu, file besar sedang dioptimalkan...</p>
                    </div>
                  )}

                  <div className="divide-y divide-slate-100">
                    {files.map(f => (
                      <div key={f.id} className="px-10 py-6 flex items-center gap-6 hover:bg-slate-50 transition-all group">
                        <div className="w-12 h-16 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400"><FileText size={24} /></div>
                        <div className="flex-1">
                           <p className="font-black text-slate-800">{f.fileName}</p>
                           <div className="flex items-center gap-3 mt-1">
                              <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${f.status === 'completed' ? 'bg-green-50 text-green-600 border-green-100' : f.status === 'error' ? 'bg-red-50 text-red-600 border-red-100' : 'bg-slate-50 text-slate-400'}`}>{f.status}</span>
                              {f.extractedDocs && <span className="text-[9px] font-black text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded border border-blue-100 tracking-tighter">{f.extractedDocs.length} Dokumen Terdeteksi</span>}
                           </div>
                        </div>
                        <button 
                          onClick={() => handleDeleteFile(f.id)}
                          disabled={isProcessing}
                          className="p-3 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all opacity-0 group-hover:opacity-100 disabled:opacity-0"
                        >
                          <Trash2 size={20} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'dashboard' && (
            <div className="bg-white rounded-[32px] border border-slate-200 shadow-xl overflow-hidden animate-in fade-in">
              <div className="p-8 border-b bg-slate-50 flex justify-between items-center">
                 <h2 className="text-lg font-black uppercase tracking-tight">Database Hasil Ekstraksi</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest">
                    <tr>
                      <th className="px-8 py-6">ID Faktur</th>
                      <th className="px-8 py-6">Tanggal</th>
                      <th className="px-8 py-6">Vendor</th>
                      <th className="px-8 py-6 text-right">Diskon</th>
                      <th className="px-8 py-6 text-right">Total Akhir</th>
                      <th className="px-8 py-6 text-center no-print">Tindakan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {files.flatMap(f => f.extractedDocs || []).map((doc, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 transition-all text-sm font-medium">
                        <td className="px-8 py-6">
                          <div className="font-black text-slate-900 uppercase">#{doc.documentNumber}</div>
                          <div className="text-[9px] font-black text-blue-600 uppercase tracking-tighter">{doc.taxInvoiceNumber || 'Non-Pajak'}</div>
                        </td>
                        <td className="px-8 py-6 text-slate-500">{doc.date}</td>
                        <td className="px-8 py-6 text-slate-800 font-bold uppercase">{doc.vendorName}</td>
                        <td className="px-8 py-6 text-right font-black text-red-500">-{formatCurrency(doc.discountTotal || 0)}</td>
                        <td className="px-8 py-6 text-right font-black text-slate-900">{formatCurrency(doc.totalAmount)}</td>
                        <td className="px-8 py-6 text-center no-print">
                          <button onClick={() => setSelectedDoc(doc)} className="bg-slate-100 hover:bg-blue-600 hover:text-white px-4 py-2 rounded-lg text-blue-600 font-black text-[9px] uppercase tracking-widest transition-all active:scale-95">Rincian</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === 'reconciliation' && (
            <div className="space-y-8 animate-in fade-in duration-700">
              <div className="flex justify-between items-end no-print">
                 <div>
                    <h2 className="text-4xl font-black text-slate-900 tracking-tighter">Laporan Audit Gabungan</h2>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.3em] mt-2">Seluruh data nota & faktur pajak terintegrasi</p>
                 </div>
                 <div className="flex gap-4">
                    <button onClick={() => window.print()} className="bg-blue-600 text-white px-10 py-5 rounded-[24px] text-sm font-black flex items-center gap-4 uppercase shadow-2xl shadow-blue-500/30 hover:bg-blue-700 transition-all active:scale-95">
                       <FileDown size={22} /> Export Laporan ke PDF
                    </button>
                 </div>
              </div>

              {/* Ringkasan Akumulasi */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                 <div className="bg-white p-8 rounded-[36px] border-2 border-slate-100 shadow-xl flex flex-col justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><Files size={14} /> Total Dokumen Audit</p>
                    <div className="flex items-end justify-between">
                       <h4 className="text-4xl font-black text-slate-900">{totalInvoices}</h4>
                       <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Terverifikasi</span>
                    </div>
                 </div>
                 <div className="bg-white p-8 rounded-[36px] border-2 border-slate-100 shadow-xl flex flex-col justify-between">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2"><TrendingUp size={14} /> Akumulasi PPN Terdata (12%)</p>
                    <div className="flex items-end justify-between">
                       <h4 className="text-2xl lg:text-3xl font-black text-green-600">{formatCurrency(totalTaxAudit)}</h4>
                    </div>
                 </div>
                 <div className="bg-slate-900 p-8 rounded-[36px] shadow-2xl shadow-slate-900/20 flex flex-col justify-between">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4 flex items-center gap-2"><Receipt size={14} /> Grand Total Ekuitas</p>
                    <div className="flex items-end justify-between">
                       <h4 className="text-2xl lg:text-3xl font-black text-blue-400">{formatCurrency(totalAmountAudit)}</h4>
                    </div>
                 </div>
              </div>

              {reconResults.map((result, idx) => (
                <div key={idx} className="bg-white rounded-[48px] border border-slate-200 shadow-2xl overflow-hidden mb-12 break-inside-avoid print:shadow-none print:border-slate-300 print:rounded-[32px]">
                  <div 
                    onClick={() => toggleGroup(result.groupKey)}
                    className={`p-10 border-b flex items-center justify-between cursor-pointer transition-all ${result.isMatch ? 'bg-green-50/20' : 'bg-red-50/20'} print:bg-slate-50`}
                  >
                    <div className="flex items-center gap-10">
                      <div className={`p-6 rounded-[28px] shadow-2xl print:shadow-none ${result.isMatch ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {result.isMatch ? <FileCheck size={40} /> : <Activity size={40} />}
                      </div>
                      <div>
                        <h3 className="font-black text-2xl text-slate-900 uppercase tracking-tighter leading-none">ID Audit: {result.groupKey}</h3>
                        <div className="flex flex-wrap items-center gap-6 mt-3">
                           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2"><Clock size={12} /> Pengecekan: {result.checkedAt}</p>
                           <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest flex items-center gap-2"><Files size={12} /> {result.documents.length} Dokumen Relasi</p>
                        </div>
                      </div>
                    </div>
                    <div className="no-print">
                       {expandedGroups[result.groupKey] ? <ChevronUp size={32} className="text-slate-300" /> : <ChevronDown size={32} className="text-slate-300" />}
                    </div>
                  </div>
                  
                  {(expandedGroups[result.groupKey] || true) && (
                    <div className={`p-10 lg:p-14 space-y-16 animate-in slide-in-from-top-4 duration-500 ${!expandedGroups[result.groupKey] ? 'hidden print:block' : ''}`}>
                      {result.documents.map((doc, dIdx) => (
                        <div key={dIdx} className="space-y-6">
                           <div className="p-8 bg-slate-50 rounded-[40px] border border-slate-100 flex items-center justify-between print:bg-white print:border-slate-300 print:p-6">
                              <div className="flex items-center gap-6">
                                 <div className="p-4 bg-white rounded-2xl shadow-sm border border-slate-100 text-blue-600 print:hidden"><FileText size={32} /></div>
                                 <div>
                                    <h4 className="font-black text-xl text-slate-900 uppercase">#{doc.documentNumber}</h4>
                                    <p className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 mt-1"><Stamp size={12} /> No. Pajak: {doc.taxInvoiceNumber || 'Non-Pajak'}</p>
                                 </div>
                              </div>
                              <div className="text-right">
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Net</p>
                                 <p className="text-2xl font-black text-slate-900 tracking-tighter">{formatCurrency(doc.totalAmount)}</p>
                              </div>
                           </div>

                           <div className="overflow-hidden border-2 border-slate-100 rounded-[40px] bg-white print:border-slate-300 print:rounded-[24px]">
                              <table className="w-full text-left text-[11px] print:text-[10px]">
                                 <thead className="bg-slate-900 text-white font-black uppercase tracking-[0.2em]">
                                    <tr>
                                       <th className="px-8 py-6 print:px-5">Uraian Barang</th>
                                       <th className="px-6 py-6 text-center print:px-4">Qty</th>
                                       <th className="px-6 py-6 text-right print:px-4">Satuan</th>
                                       <th className="px-6 py-6 text-right text-red-400 print:px-4">Diskon</th>
                                       <th className="px-6 py-6 text-right text-green-400 print:px-4">PPN (12%)</th>
                                       <th className="px-8 py-6 text-right print:px-5">Jumlah</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100 font-bold text-slate-700 bg-white">
                                    {doc.items.map((item, iIdx) => (
                                       <tr key={iIdx}>
                                          <td className="px-8 py-5 uppercase font-black text-slate-900 leading-relaxed print:px-5">{item.description}</td>
                                          <td className="px-6 py-5 text-center print:px-4">{item.quantity}</td>
                                          <td className="px-6 py-5 text-right print:px-4">{formatCurrency(item.unitPrice)}</td>
                                          <td className="px-6 py-5 text-right text-red-500 print:px-4">-{formatCurrency(item.discountAmount || 0)}</td>
                                          <td className="px-6 py-5 text-right text-green-600 print:px-4">{formatCurrency(item.taxAmount || 0)}</td>
                                          <td className="px-8 py-5 text-right font-black text-slate-900 print:px-5">{formatCurrency(item.totalPrice)}</td>
                                       </tr>
                                    ))}
                                 </tbody>
                                 <tfoot className="bg-slate-50 font-black text-slate-900">
                                    <tr>
                                       <td colSpan={3} className="px-8 py-5 text-right text-[10px] uppercase text-slate-400 tracking-widest">Akumulasi Dokumen</td>
                                       <td className="px-6 py-5 text-right text-red-600">-{formatCurrency(doc.discountTotal || 0)}</td>
                                       <td className="px-6 py-5 text-right text-green-600">{formatCurrency(doc.taxAmount)}</td>
                                       <td className="px-8 py-5 text-right bg-slate-900 text-white">{formatCurrency(doc.totalAmount)}</td>
                                    </tr>
                                 </tfoot>
                              </table>
                           </div>
                        </div>
                      ))}

                      {/* Area Analisis Auditor */}
                      <div className="bg-slate-900 rounded-[48px] p-12 space-y-10 shadow-2xl relative overflow-hidden print:bg-white print:text-slate-900 print:border-2 print:border-slate-900 print:shadow-none print:p-8 print:rounded-[24px]">
                        <div className="absolute top-0 right-0 p-12 opacity-5 text-white pointer-events-none print:hidden"><ShieldCheck size={180} /></div>
                        <h4 className="text-white text-[14px] font-black uppercase tracking-[0.4em] border-b border-white/10 pb-6 flex items-center gap-5 print:text-slate-900 print:border-slate-200">
                           <Activity size={24} /> Catatan Auditor Keuangan
                        </h4>
                        <div className="space-y-6 relative z-10">
                           {result.analysisFindings.map((f, fIdx) => (
                              <div key={fIdx} className="flex gap-6 text-[14px] font-medium text-slate-300 items-start leading-relaxed print:text-slate-700">
                                 <div className="w-2.5 h-2.5 rounded-full mt-2.5 flex-shrink-0 bg-blue-500 shadow-[0_0_15px_rgba(59,130,246,0.6)] print:shadow-none" />
                                 <span>{f}</span>
                              </div>
                           ))}
                        </div>
                        
                        {/* Area Tanda Tangan */}
                        <div className="hidden print:grid grid-cols-2 gap-20 pt-16 mt-8">
                           <div className="text-center">
                              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-20">Auditor Lapangan</p>
                              <div className="border-b-2 border-slate-900 w-48 mx-auto"></div>
                              <p className="text-xs font-bold mt-2 uppercase">DocuMatch AI Signature</p>
                           </div>
                           <div className="text-center">
                              <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-20">Manajer Keuangan</p>
                              <div className="border-b-2 border-slate-900 w-48 mx-auto"></div>
                              <p className="text-xs font-bold mt-2 uppercase">Verified by Global Solusi</p>
                           </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {reconResults.length === 0 && (
                <div className="py-48 text-center bg-white rounded-[60px] border border-slate-100 shadow-inner no-print">
                   <Split size={80} className="mx-auto text-slate-100 mb-10" />
                   <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter">Belum Ada Hasil Audit</h3>
                   <p className="text-slate-400 font-bold uppercase tracking-widest mt-4">Unggah bundle dokumen faktur untuk memulai.</p>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Detail Modal */}
      {selectedDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 lg:p-12 no-print">
          <div className="absolute inset-0 bg-slate-900/95 backdrop-blur-2xl animate-in fade-in duration-300" onClick={() => setSelectedDoc(null)}></div>
          <div className="relative bg-white w-full max-w-5xl rounded-[56px] shadow-2xl overflow-hidden border-8 border-white transition-all transform animate-in zoom-in duration-300">
            <div className={`p-10 lg:p-14 flex items-center justify-between ${selectedDoc.documentNumber.toUpperCase().startsWith('PO') ? 'bg-slate-900 text-white' : 'bg-blue-600 text-white'}`}>
              <div className="flex items-center gap-8">
                <div className="p-5 bg-white/20 rounded-[32px] backdrop-blur-md"><Building2 size={44} /></div>
                <div>
                  <h2 className="text-4xl font-black uppercase tracking-tighter leading-none mb-4">{selectedDoc.documentType}</h2>
                  <div className="flex flex-wrap items-center gap-6 text-[10px] font-black opacity-60 tracking-[0.4em] uppercase">
                    <p className="flex items-center gap-2"><Hash size={14} /> NO: #{selectedDoc.documentNumber}</p>
                    <p className="flex items-center gap-2"><Stamp size={14} /> SERI: {selectedDoc.taxInvoiceNumber || 'NON-PKP'}</p>
                  </div>
                </div>
              </div>
              <button onClick={() => setSelectedDoc(null)} className="p-5 hover:bg-white/10 rounded-full text-white transition-all transform hover:rotate-90"><X size={40} /></button>
            </div>

            <div className="p-10 lg:p-16 space-y-12 overflow-y-auto max-h-[60vh]">
               <div className="grid grid-cols-3 gap-10">
                  <div className="space-y-4">
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border-b pb-4">Waktu Terbit</h4>
                     <p className="text-[14px] font-bold text-slate-900">{selectedDoc.date}</p>
                  </div>
                  <div className="space-y-4">
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border-b pb-4">Nama Vendor</h4>
                     <p className="text-[14px] font-bold text-slate-900 uppercase">{selectedDoc.vendorName}</p>
                  </div>
                  <div className="space-y-4 text-right">
                     <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] border-b pb-4">Grand Total</h4>
                     <p className="text-blue-600 font-black text-3xl tracking-tighter">{formatCurrency(selectedDoc.totalAmount)}</p>
                  </div>
               </div>

               <div className="border-4 border-slate-50 rounded-[40px] overflow-hidden shadow-xl">
                  <table className="w-full text-left">
                     <thead className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-widest">
                        <tr>
                           <th className="px-8 py-6">Nama Barang</th>
                           <th className="px-6 py-6 text-center">Qty</th>
                           <th className="px-6 py-6 text-right">Harga Satuan</th>
                           <th className="px-6 py-6 text-right">Diskon</th>
                           <th className="px-6 py-6 text-right text-green-400">PPN (12%)</th>
                           <th className="px-8 py-6 text-right">Net</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 bg-white">
                        {selectedDoc.items.map((item, i) => (
                           <tr key={i} className="text-sm font-bold text-slate-700">
                              <td className="px-8 py-5 uppercase font-black text-slate-900 leading-tight">{item.description}</td>
                              <td className="px-6 py-5 text-center">{item.quantity}</td>
                              <td className="px-6 py-5 text-right">{formatCurrency(item.unitPrice)}</td>
                              <td className="px-6 py-5 text-right text-red-500">-{formatCurrency(item.discountAmount || 0)}</td>
                              <td className="px-6 py-5 text-right text-green-600">{formatCurrency(item.taxAmount || 0)}</td>
                              <td className="px-8 py-5 text-right font-black text-slate-900">{formatCurrency(item.totalPrice)}</td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>

               <div className="flex justify-end">
                  <div className="bg-slate-900 p-10 rounded-[40px] text-white w-96 space-y-4 shadow-2xl">
                     <div className="flex justify-between items-center text-xs font-black uppercase text-slate-500">
                        <span>Subtotal Bruto</span>
                        <span>{formatCurrency(selectedDoc.subtotalAmount)}</span>
                     </div>
                     <div className="flex justify-between items-center text-xs font-black uppercase text-red-400">
                        <span>Total Potongan Diskon</span>
                        <span>-{formatCurrency(selectedDoc.discountTotal || 0)}</span>
                     </div>
                     <div className="flex justify-between items-center text-xs font-black uppercase text-blue-400">
                        <span>PPN (VAT) 12%</span>
                        <span>{formatCurrency(selectedDoc.taxAmount)}</span>
                     </div>
                     <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                        <div className="flex flex-col">
                           <span className="text-[10px] font-black uppercase text-slate-400">Hasil Akhir Audit</span>
                           <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">NET PAYABLE AMOUNT</span>
                        </div>
                        <span className="text-3xl font-black text-blue-400 tracking-tighter">{formatCurrency(selectedDoc.totalAmount)}</span>
                     </div>
                  </div>
               </div>
            </div>

            <div className="p-10 bg-slate-50 border-t flex justify-end gap-6 no-print">
               <button onClick={() => setSelectedDoc(null)} className="px-10 py-4 bg-white border-2 font-black rounded-2xl text-[10px] uppercase text-slate-500 border-slate-200 tracking-[0.2em]">Tutup Detail</button>
               <button onClick={() => window.print()} className="px-10 py-4 bg-blue-600 text-white font-black rounded-2xl text-[10px] flex items-center gap-4 uppercase shadow-xl hover:bg-blue-700 transition-all active:scale-95"><Printer size={20} /> Cetak Bukti PDF</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
