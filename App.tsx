
import React, { useState, useEffect } from 'react';
import { 
  FileText, Upload, CheckCircle2, Loader2, LayoutDashboard, ClipboardList, Search,
  X, Printer, Trash2, Package, Receipt, Activity, AlertCircle,
  FileSearch, FileCheck, Hash, Stamp, Files, Clock, ChevronDown, ChevronUp, Split,
  FileDown, TrendingUp, ShieldCheck, Info, ChevronRight, ListOrdered, Tag, 
  Calculator, PieChart, BarChart3, ArrowUpRight
} from 'lucide-react';
import { ProcessingFile, ExtractedData, ReconciliationResult } from './types';
import { optimizeImage, processDocument, reconcileDocuments } from './services/geminiService';

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
  const [isDownloading, setIsDownloading] = useState(false);
  const [view, setView] = useState<'upload' | 'dashboard' | 'reconciliation'>('upload');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const [expandedDashboardDocs, setExpandedDashboardDocs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const filesToSave = files.map(({ file, ...rest }: any) => ({ ...rest }));
    localStorage.setItem(STORAGE_KEY_FILES, JSON.stringify(filesToSave));
  }, [files]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_RECON, JSON.stringify(reconResults));
  }, [reconResults]);

  const toggleDashboardDoc = (id: string) => {
    setExpandedDashboardDocs(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
  };

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
        const base64 = await optimizeImage(fileObj);
        const docs = await processDocument(base64, fileObj.type);
        updatedFiles[i].extractedDocs = docs;
        updatedFiles[i].status = 'completed';
        allExtracted.push(...docs);
      } catch (error: any) {
        updatedFiles[i].status = 'error';
        updatedFiles[i].errorMessage = error.message;
        console.error(error);
      }
      setFiles([...updatedFiles]);
    }

    const completedDocs = updatedFiles.flatMap(f => f.extractedDocs || []);
    if (completedDocs.length > 0) {
      const results = await reconcileDocuments(completedDocs);
      setReconResults(results);
    }
    setIsProcessing(false);
  };

  const handlePrint = () => {
    const element = document.getElementById('printable-area');
    if (!element) return;
    setIsDownloading(true);
    
    const opt = {
      margin: 10,
      filename: `Laporan_Audit_DocuMatch_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // @ts-ignore
    html2pdf().set(opt).from(element).save().then(() => setIsDownloading(false));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount);
  };

  // Statistik Kesimpulan
  const allDocs = files.flatMap(f => f.extractedDocs || []);
  const stats = {
    totalDocs: allDocs.length,
    totalPPN: allDocs.reduce((acc, d) => acc + (d.taxAmount || 0), 0),
    totalDiscount: allDocs.reduce((acc, d) => acc + (d.discountTotal || 0), 0),
    totalGrand: allDocs.reduce((acc, d) => acc + (d.totalAmount || 0), 0),
  };

  const filteredDashboardDocs = allDocs.filter(doc => 
    doc.documentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (doc.taxInvoiceNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.vendorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside className="w-72 bg-slate-900 text-white hidden lg:flex flex-col no-print fixed h-full shadow-2xl">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-12">
            <div className="bg-blue-600 p-2.5 rounded-2xl shadow-lg shadow-blue-500/20"><ClipboardList size={26} /></div>
            <span className="font-black text-2xl tracking-tighter uppercase">DocuMatch</span>
          </div>
          <nav className="space-y-4">
            <button onClick={() => setView('upload')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold text-sm transition-all ${view === 'upload' ? 'bg-blue-600 shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:bg-slate-800'}`}><Upload size={18} /> Unggah Bundle</button>
            <button onClick={() => setView('dashboard')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold text-sm transition-all ${view === 'dashboard' ? 'bg-blue-600 shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:bg-slate-800'}`}><LayoutDashboard size={18} /> Data Terurai</button>
            <button onClick={() => setView('reconciliation')} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl font-bold text-sm transition-all ${view === 'reconciliation' ? 'bg-blue-600 shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:bg-slate-800'}`}><Activity size={18} /> Laporan Audit</button>
          </nav>
        </div>
        <div className="mt-auto p-8 border-t border-white/5">
           <div className="bg-slate-800/50 p-4 rounded-2xl">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Sistem Status</p>
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                 <span className="text-[11px] font-bold text-slate-300">AI Engine Ready</span>
              </div>
           </div>
        </div>
      </aside>

      <main className="flex-1 lg:ml-72 min-h-screen">
        <header className="h-20 bg-white border-b flex items-center justify-between px-10 sticky top-0 z-10 no-print shadow-sm">
          <div>
            <h1 className="text-xl font-black text-slate-800 uppercase tracking-tighter">Finance Audit Hub</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Digital Tax Reconciliation System</p>
          </div>
          <div className="flex items-center gap-4">
            {(view === 'reconciliation' || view === 'dashboard') && allDocs.length > 0 && (
              <button 
                onClick={handlePrint}
                disabled={isDownloading}
                className="bg-slate-900 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase flex items-center gap-3 hover:bg-slate-800 disabled:bg-slate-400 transition-all shadow-lg"
              >
                {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} 
                {isDownloading ? "Generating PDF..." : "Cetak Laporan Audit"}
              </button>
            )}
            <div className="w-px h-8 bg-slate-200" />
            <div className="flex items-center gap-3 pl-2">
               <div className="w-9 h-9 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 font-black text-xs uppercase">GS</div>
            </div>
          </div>
        </header>

        <div id="printable-area" className="p-8 lg:p-12 max-w-6xl mx-auto space-y-10">
          
          {/* Summary Section - KESIMPULAN UTAMA DI ATAS */}
          {(view === 'dashboard' || view === 'reconciliation') && allDocs.length > 0 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-700">
               <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                     <BarChart3 size={18} className="text-blue-600" /> Kesimpulan Ringkasan Audit
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase">Periode: {new Date().toLocaleDateString('id-ID', { month: 'long', year: 'numeric' })}</span>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Dokumen</p>
                     <p className="text-2xl font-black text-slate-900 flex items-center gap-2">{stats.totalDocs} <span className="text-xs text-slate-400 font-bold">Berkas</span></p>
                  </div>
                  <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Diskon</p>
                     <p className="text-2xl font-black text-red-600 tracking-tighter">-{formatCurrency(stats.totalDiscount)}</p>
                  </div>
                  <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total PPN (12%)</p>
                     <p className="text-2xl font-black text-green-600 tracking-tighter">{formatCurrency(stats.totalPPN)}</p>
                  </div>
                  <div className="bg-slate-900 p-6 rounded-[32px] shadow-xl shadow-slate-900/20 transform hover:-translate-y-1 transition-transform">
                     <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Grand Total (Net)</p>
                     <p className="text-2xl font-black text-white tracking-tighter">{formatCurrency(stats.totalGrand)}</p>
                  </div>
               </div>
            </div>
          )}

          {view === 'upload' && (
            <div className="space-y-10">
              <div className="bg-white rounded-[40px] border-4 border-dashed border-slate-200 p-16 text-center hover:border-blue-500 transition-all relative cursor-pointer shadow-xl shadow-slate-200/50 no-print">
                <input type="file" multiple onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*,.pdf" />
                <div className="mx-auto w-24 h-24 bg-blue-50 rounded-[40px] flex items-center justify-center text-blue-600 mb-8 shadow-inner"><Upload size={40} /></div>
                <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Input Bundle Faktur & Nota</h3>
                <p className="text-slate-500 font-medium mt-3 max-w-sm mx-auto">Tarik & letakkan file atau klik untuk mengunggah bundle dokumen pajak (Faktur, PO, Surat Jalan).</p>
                <div className="mt-8 flex justify-center gap-4">
                   <span className="px-4 py-2 bg-slate-50 rounded-full text-[10px] font-black text-slate-400 uppercase border border-slate-100">Supports PDF & Images</span>
                   <span className="px-4 py-2 bg-slate-50 rounded-full text-[10px] font-black text-slate-400 uppercase border border-slate-100">Multi-page Scanning</span>
                </div>
              </div>

              {files.length > 0 && (
                <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden no-print animate-in slide-in-from-bottom-8 duration-500">
                  <div className="px-12 py-10 border-b bg-slate-50/50 flex justify-between items-center">
                    <div>
                      <h2 className="font-black text-xl uppercase text-slate-800 flex items-center gap-4"><FileSearch size={24} className="text-blue-600" /> Antrean Bundle ({files.length} File)</h2>
                      <p className="text-[11px] font-bold text-blue-600 uppercase mt-2 bg-blue-50 px-3 py-1 rounded-full w-fit">Status: {isProcessing ? 'Sedang Menganalisis...' : 'Siap Diproses'}</p>
                    </div>
                    <button 
                      onClick={processAllFiles} 
                      disabled={isProcessing} 
                      className="bg-blue-600 text-white px-10 py-5 rounded-3xl text-sm font-black flex items-center gap-4 uppercase disabled:bg-slate-300 transition-all hover:scale-105 active:scale-95 shadow-xl shadow-blue-600/20"
                    >
                      {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />} 
                      {isProcessing ? 'Processing Deep Scan...' : 'Jalankan Analisis Bundle'}
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {files.map(f => (
                      <div key={f.id} className="px-12 py-8 flex items-center gap-8 group hover:bg-slate-50 transition-colors">
                        <div className={`w-14 h-18 rounded-2xl flex items-center justify-center shadow-sm ${f.status === 'completed' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-400'}`}>
                           {f.status === 'processing' ? <Loader2 className="animate-spin" size={24} /> : <FileText size={28} />}
                        </div>
                        <div className="flex-1">
                           <p className="font-black text-lg text-slate-800 truncate max-w-md">{f.fileName}</p>
                           <div className="flex items-center gap-4 mt-2">
                              <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${f.status === 'completed' ? 'bg-green-50 text-green-600 border-green-200' : f.status === 'error' ? 'bg-red-50 text-red-600 border-red-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                                 {f.status}
                              </span>
                              {f.extractedDocs && (
                                <span className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-2">
                                  <Tag size={12} /> {f.extractedDocs.length} DOKUMEN TERDETEKSI
                                </span>
                              )}
                              {f.status === 'error' && (
                                <span className="text-[10px] font-bold text-red-500 flex items-center gap-1">
                                   <AlertCircle size={12} /> {f.errorMessage}
                                </span>
                              )}
                           </div>
                        </div>
                        <button onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))} disabled={isProcessing} className="p-4 text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={24} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'dashboard' && (
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl overflow-hidden animate-in fade-in duration-500">
              <div className="p-10 border-b bg-slate-50/50 flex justify-between items-center no-print">
                 <div className="relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Cari Nomor Faktur, NSFP, atau Nama Vendor..." 
                      className="pl-14 pr-8 py-4 bg-white border border-slate-200 rounded-[24px] text-sm outline-none w-[400px] focus:ring-4 focus:ring-blue-500/10 transition-all font-medium"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                 </div>
                 <div className="text-right">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Urut Berdasarkan</p>
                    <p className="text-xs font-bold text-slate-900 uppercase">Input Terbaru</p>
                 </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em]">
                    <tr>
                      <th className="px-8 py-8 w-16 text-center no-print"></th>
                      <th className="px-10 py-8">Identitas Dokumen</th>
                      <th className="px-10 py-8">Entitas Vendor</th>
                      <th className="px-10 py-8 text-right">PPN Masukan</th>
                      <th className="px-10 py-8 text-right">Grand Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredDashboardDocs.map((doc, idx) => {
                      const isExpanded = expandedDashboardDocs[doc.documentNumber];
                      return (
                        <React.Fragment key={idx}>
                          <tr onClick={() => toggleDashboardDoc(doc.documentNumber)} className="cursor-pointer hover:bg-slate-50 transition-all group">
                            <td className="px-8 py-8 text-center no-print">
                               <ChevronRight size={20} className={`text-slate-300 transition-transform duration-300 ${isExpanded ? 'rotate-90 text-blue-600' : 'group-hover:text-slate-500'}`} />
                            </td>
                            <td className="px-10 py-8">
                              <div className="font-black text-slate-900 text-base">#{doc.documentNumber}</div>
                              <div className="text-[10px] font-black text-blue-600 uppercase tracking-tighter mt-1">NSFP: {doc.taxInvoiceNumber || 'NON-PKP / INTERNAL'}</div>
                            </td>
                            <td className="px-10 py-8 text-slate-800 font-bold uppercase text-xs">{doc.vendorName}</td>
                            <td className="px-10 py-8 text-right font-black text-green-600">{formatCurrency(doc.taxAmount || 0)}</td>
                            <td className="px-10 py-8 text-right font-black text-slate-900">{formatCurrency(doc.totalAmount)}</td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50/50">
                              <td colSpan={5} className="px-16 py-10">
                                <div className="bg-white rounded-[24px] border border-slate-200 overflow-hidden shadow-lg animate-in slide-in-from-top-2 duration-300">
                                   <table className="w-full text-xs">
                                      <thead className="bg-slate-100/50 text-[10px] font-black uppercase text-slate-400">
                                         <tr>
                                            <th className="px-8 py-4">Deskripsi Barang/Jasa</th>
                                            <th className="px-6 py-4 text-center">Qty</th>
                                            <th className="px-8 py-4 text-right">Harga Satuan</th>
                                            <th className="px-8 py-4 text-right text-red-500">Potongan</th>
                                            <th className="px-8 py-4 text-right text-green-600">PPN (12%)</th>
                                            <th className="px-8 py-4 text-right">Total Net</th>
                                         </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-50">
                                         {doc.items.map((item, i) => (
                                            <tr key={i} className="hover:bg-slate-50/30">
                                               <td className="px-8 py-4 font-bold text-slate-900 uppercase">{item.description}</td>
                                               <td className="px-6 py-4 text-center font-medium">{item.quantity}</td>
                                               <td className="px-8 py-4 text-right text-slate-600">{formatCurrency(item.unitPrice)}</td>
                                               <td className="px-8 py-4 text-right text-red-500">-{formatCurrency(item.discountAmount || 0)}</td>
                                               <td className="px-8 py-4 text-right text-green-600 font-black">{formatCurrency(item.taxAmount || 0)}</td>
                                               <td className="px-8 py-4 text-right font-black text-slate-900">{formatCurrency(item.totalPrice)}</td>
                                            </tr>
                                         ))}
                                      </tbody>
                                   </table>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {view === 'reconciliation' && (
            <div className="space-y-10 animate-in slide-in-from-bottom-6 duration-700">
              <div className="no-print bg-blue-600 p-8 rounded-[40px] text-white flex items-center justify-between shadow-xl shadow-blue-600/20">
                 <div className="flex items-center gap-6">
                    <div className="bg-white/20 p-4 rounded-3xl"><Activity size={32} /></div>
                    <div>
                       <h2 className="text-2xl font-black uppercase tracking-tighter">Hasil Rekonsiliasi Pajak</h2>
                       <p className="text-blue-100 text-xs font-bold uppercase tracking-widest mt-1">Audit Grouping Berdasarkan Nomor Seri Faktur Pajak</p>
                    </div>
                 </div>
                 <div className="bg-white/10 px-6 py-4 rounded-[24px] text-right border border-white/10">
                    <p className="text-[10px] font-black uppercase opacity-60">Status Verifikasi</p>
                    <p className="text-lg font-black uppercase">Exhaustive Scan</p>
                 </div>
              </div>

              {reconResults.map((result, idx) => (
                <div key={idx} className="bg-white rounded-[40px] border border-slate-200 shadow-xl overflow-hidden break-inside-avoid transform hover:shadow-2xl transition-shadow duration-500">
                  <div onClick={() => toggleGroup(result.groupKey)} className={`p-10 border-b flex items-center justify-between cursor-pointer transition-colors ${result.taxNumberRef ? 'bg-blue-50/10' : 'bg-slate-50/30'}`}>
                    <div className="flex items-center gap-10">
                      <div className={`p-6 rounded-[24px] shadow-lg ${result.taxNumberRef ? 'bg-blue-600 text-white shadow-blue-500/20' : 'bg-slate-800 text-white'}`}>
                        <Stamp size={36} />
                      </div>
                      <div>
                        <h3 className="font-black text-2xl text-slate-900 uppercase tracking-tighter">
                          {result.taxNumberRef ? `PKP: ${result.taxNumberRef}` : `NON-PKP: ${result.groupKey.split('-')[1]}`}
                        </h3>
                        <p className="text-[11px] font-black uppercase text-slate-400 mt-2 flex items-center gap-2">
                           <Clock size={12} /> Diverifikasi pada {result.checkedAt}
                        </p>
                      </div>
                    </div>
                    <ChevronDown size={28} className={`text-slate-300 transition-transform duration-500 no-print ${expandedGroups[result.groupKey] ? 'rotate-180 text-blue-600' : ''}`} />
                  </div>
                  
                  {(expandedGroups[result.groupKey] || true) && (
                    <div className={`p-12 space-y-12 ${!expandedGroups[result.groupKey] ? 'hidden' : ''}`}>
                      {result.documents.map((doc, dIdx) => (
                        <div key={dIdx} className="space-y-8 animate-in fade-in duration-500">
                           <div className="p-8 bg-slate-50 rounded-[32px] border border-slate-100 flex items-center justify-between shadow-inner">
                              <div className="flex items-center gap-6">
                                 <div className="bg-white p-3 rounded-2xl shadow-sm text-blue-600"><Files size={24} /></div>
                                 <div>
                                    <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight">{doc.vendorName}</h4>
                                    <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mt-1">Inv: #{doc.documentNumber} | Tanggal: {doc.date}</p>
                                 </div>
                              </div>
                              <div className="text-right">
                                 <p className="text-[10px] font-black text-green-600 uppercase tracking-widest mb-1">Pajak Masukan (12%)</p>
                                 <p className="text-2xl font-black text-green-600 tracking-tighter">{formatCurrency(doc.taxAmount)}</p>
                              </div>
                           </div>

                           <div className="overflow-hidden border border-slate-200 rounded-[32px] shadow-sm bg-white">
                              <table className="w-full text-left text-xs">
                                 <thead className="bg-slate-900 text-white font-black uppercase tracking-[0.1em]">
                                    <tr>
                                       <th className="px-8 py-5">Rincian Komoditas</th>
                                       <th className="px-6 py-5 text-center">Volume</th>
                                       <th className="px-8 py-5 text-right">Harga Satuan</th>
                                       <th className="px-8 py-5 text-right text-red-400">Pot.</th>
                                       <th className="px-8 py-5 text-right text-green-400">PPN</th>
                                       <th className="px-8 py-5 text-right">Total Net</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100">
                                    {doc.items.map((item, iIdx) => (
                                       <tr key={iIdx} className="font-medium text-slate-700 hover:bg-slate-50/50">
                                          <td className="px-8 py-5 uppercase text-slate-900 font-bold">{item.description}</td>
                                          <td className="px-6 py-5 text-center font-black">{item.quantity}</td>
                                          <td className="px-8 py-5 text-right">{formatCurrency(item.unitPrice)}</td>
                                          <td className="px-8 py-5 text-right text-red-500">-{formatCurrency(item.discountAmount || 0)}</td>
                                          <td className="px-8 py-5 text-right text-green-600 font-black">{formatCurrency(item.taxAmount || 0)}</td>
                                          <td className="px-8 py-5 text-right font-black text-slate-900">{formatCurrency(item.totalPrice)}</td>
                                       </tr>
                                    ))}
                                 </tbody>
                              </table>
                           </div>
                        </div>
                      ))}

                      <div className="bg-slate-900 rounded-[32px] p-10 space-y-8 shadow-2xl shadow-slate-900/30">
                        <div className="flex items-center justify-between border-b border-white/10 pb-6">
                           <h4 className="text-white text-sm font-black uppercase tracking-[0.2em] flex items-center gap-4">
                             <ShieldCheck size={24} className="text-blue-500" /> Kesimpulan Auditor Digital
                           </h4>
                           <span className="text-[10px] font-black text-white/30 uppercase bg-white/5 px-4 py-1.5 rounded-full border border-white/5 tracking-widest">Verified by Gemini AI</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                           <div className="space-y-4">
                              {result.analysisFindings.map((f, fIdx) => (
                                 <div key={fIdx} className="flex gap-5 text-sm text-slate-300 items-start">
                                    <div className="w-2 h-2 rounded-full mt-1.5 bg-blue-500 flex-shrink-0 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
                                    <span className="font-medium leading-relaxed">{f}</span>
                                 </div>
                              ))}
                           </div>
                           <div className="bg-white/5 rounded-3xl p-8 border border-white/5 flex flex-col justify-center">
                              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-4">Ringkasan Nilai Group</p>
                              <div className="space-y-4">
                                 <div className="flex justify-between items-end">
                                    <span className="text-slate-400 text-xs font-bold uppercase">Total Pajak</span>
                                    <span className="text-green-400 font-black text-xl tracking-tighter">{formatCurrency(result.documents.reduce((acc, d) => acc + (d.taxAmount || 0), 0))}</span>
                                 </div>
                                 <div className="flex justify-between items-end">
                                    <span className="text-slate-400 text-xs font-bold uppercase">Total Nilai Bersih</span>
                                    <span className="text-white font-black text-xl tracking-tighter">{formatCurrency(result.documents.reduce((acc, d) => acc + (d.totalAmount || 0), 0))}</span>
                                 </div>
                              </div>
                           </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              
              {/* Footer Kesimpulan Akhir untuk PDF */}
              <div className="pt-20 pb-10 border-t border-slate-200 mt-20 text-center space-y-6">
                 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Lembar Verifikasi Akhir</h3>
                 <p className="text-sm text-slate-500 max-w-2xl mx-auto font-medium">Laporan ini dihasilkan secara otomatis oleh sistem kecerdasan buatan DocuMatch AI untuk CV Global Solusi. Seluruh perhitungan pajak telah divalidasi berdasarkan data yang diekstraksi dari bundle dokumen fisik.</p>
                 <div className="flex justify-center gap-20 pt-10">
                    <div className="text-center">
                       <div className="w-40 h-px bg-slate-200 mb-4" />
                       <p className="text-[10px] font-black text-slate-400 uppercase">Petugas Audit</p>
                    </div>
                    <div className="text-center">
                       <div className="w-40 h-px bg-slate-200 mb-4" />
                       <p className="text-[10px] font-black text-slate-400 uppercase">Manager Keuangan</p>
                    </div>
                 </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
