
import React, { useState, useEffect } from 'react';
import { 
  FileText, Upload, CheckCircle2, Loader2, LayoutDashboard, ClipboardList, Search,
  X, Printer, Trash2, Package, Receipt, Activity, AlertCircle,
  FileSearch, FileCheck, Hash, Stamp, Files, Clock, ChevronDown, ChevronUp, Split,
  FileDown, TrendingUp, ShieldCheck, Info, ChevronRight, ListOrdered, Tag, 
  Calculator, PieChart, BarChart3, ArrowUpRight, AlertTriangle
} from 'lucide-react';
import { ProcessingFile, ExtractedData, ReconciliationResult } from './types';
import { optimizeImage, processDocument, reconcileDocuments } from './services/geminiService';

const STORAGE_KEY_FILES = 'documatch_files';
const STORAGE_KEY_RECON = 'documatch_recon';

const App: React.FC = () => {
  const [files, setFiles] = useState<ProcessingFile[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_FILES);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse files from storage", e);
      return [];
    }
  });
  
  const [reconResults, setReconResults] = useState<ReconciliationResult[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_RECON);
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      console.error("Failed to parse reconciliation results from storage", e);
      return [];
    }
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
        if (!fileObj) {
           updatedFiles[i].status = 'error';
           updatedFiles[i].errorMessage = "Data file tidak ditemukan. Mohon unggah ulang.";
           continue;
        }
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
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(amount || 0);
  };

  const allDocs = files.flatMap(f => f.extractedDocs || []);
  const stats = {
    totalDocs: allDocs.length,
    totalPPN: allDocs.reduce((acc, d) => acc + (d.taxAmount || 0), 0),
    totalDiscount: allDocs.reduce((acc, d) => acc + (d.discountTotal || 0), 0),
    totalGrand: allDocs.reduce((acc, d) => acc + (d.totalAmount || 0), 0),
    alertsCount: reconResults.filter(r => !r.isMatch).length
  };

  const filteredDashboardDocs = allDocs.filter(doc => 
    (doc.documentNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (doc.taxInvoiceNumber || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (doc.vendorName || "").toLowerCase().includes(searchQuery.toLowerCase())
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
          
          {/* Summary Section */}
          {(view === 'dashboard' || view === 'reconciliation') && allDocs.length > 0 && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-700">
               <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest flex items-center gap-2">
                     <BarChart3 size={18} className="text-blue-600" /> Kesimpulan Ringkasan Audit
                  </h3>
                  <div className="flex items-center gap-4">
                    {stats.alertsCount > 0 && (
                       <span className="bg-red-100 text-red-600 text-[10px] font-black px-3 py-1 rounded-full uppercase flex items-center gap-2 animate-pulse">
                         <AlertTriangle size={12} /> {stats.alertsCount} Grup Bermasalah
                       </span>
                    )}
                    <span className="text-[10px] font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase">Update: {new Date().toLocaleTimeString('id-ID')}</span>
                  </div>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Dokumen</p>
                     <p className="text-2xl font-black text-slate-900">{stats.totalDocs}</p>
                  </div>
                  <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total PPN (12%)</p>
                     <p className="text-2xl font-black text-green-600">{formatCurrency(stats.totalPPN)}</p>
                  </div>
                  <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm">
                     <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Diskon</p>
                     <p className="text-2xl font-black text-red-600">-{formatCurrency(stats.totalDiscount)}</p>
                  </div>
                  <div className="bg-slate-900 p-6 rounded-[32px] shadow-xl">
                     <p className="text-[9px] font-black text-white/40 uppercase tracking-widest mb-1">Grand Total (Net)</p>
                     <p className="text-2xl font-black text-white">{formatCurrency(stats.totalGrand)}</p>
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
                <p className="text-slate-500 font-medium mt-3 max-w-sm mx-auto">Unggah bundle dokumen pajak (Faktur, PO, Surat Jalan) untuk audit otomatis.</p>
              </div>

              {files.length > 0 && (
                <div className="bg-white rounded-[40px] border border-slate-200 shadow-2xl overflow-hidden no-print animate-in slide-in-from-bottom-8 duration-500">
                  <div className="px-12 py-10 border-b bg-slate-50/50 flex justify-between items-center">
                    <div>
                      <h2 className="font-black text-xl uppercase text-slate-800 flex items-center gap-4"><FileSearch size={24} className="text-blue-600" /> Antrean Bundle ({files.length} File)</h2>
                    </div>
                    <button 
                      onClick={processAllFiles} 
                      disabled={isProcessing} 
                      className="bg-blue-600 text-white px-10 py-5 rounded-3xl text-sm font-black flex items-center gap-4 uppercase disabled:bg-slate-300 transition-all hover:scale-105 shadow-xl shadow-blue-600/20"
                    >
                      {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />} 
                      {isProcessing ? 'Memproses...' : 'Jalankan Analisis'}
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
                           </div>
                        </div>
                        <button onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))} disabled={isProcessing} className="p-4 text-slate-300 hover:text-red-500"><Trash2 size={24} /></button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'dashboard' && (
            <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl overflow-hidden">
              <div className="p-10 border-b bg-slate-50/50 flex justify-between items-center no-print">
                 <div className="relative">
                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                    <input 
                      type="text" 
                      placeholder="Cari No Faktur, Vendor..." 
                      className="pl-14 pr-8 py-4 bg-white border border-slate-200 rounded-[24px] text-sm outline-none w-[400px] focus:ring-4 focus:ring-blue-500/10 font-medium"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                    />
                 </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.2em]">
                    <tr>
                      <th className="px-8 py-8 w-16 text-center"></th>
                      <th className="px-10 py-8">Identitas Dokumen</th>
                      <th className="px-10 py-8">Entitas Vendor</th>
                      <th className="px-10 py-8 text-right">PPN Masukan</th>
                      <th className="px-10 py-8 text-right">Grand Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(filteredDashboardDocs || []).map((doc, idx) => {
                      const isExpanded = expandedDashboardDocs[doc.documentNumber];
                      return (
                        <React.Fragment key={idx}>
                          <tr onClick={() => toggleDashboardDoc(doc.documentNumber)} className="cursor-pointer hover:bg-slate-50 transition-all group">
                            <td className="px-8 py-8 text-center no-print">
                               <ChevronRight size={20} className={`text-slate-300 transition-transform ${isExpanded ? 'rotate-90 text-blue-600' : ''}`} />
                            </td>
                            <td className="px-10 py-8">
                              <div className="font-black text-slate-900 text-base">#{doc.documentNumber}</div>
                              <div className="text-[10px] font-black text-blue-600 uppercase mt-1">NSFP: {doc.taxInvoiceNumber || 'INTERNAL'}</div>
                            </td>
                            <td className="px-10 py-8 text-slate-800 font-bold uppercase text-xs">{doc.vendorName}</td>
                            <td className="px-10 py-8 text-right font-black text-green-600">{formatCurrency(doc.taxAmount || 0)}</td>
                            <td className="px-10 py-8 text-right font-black text-slate-900">{formatCurrency(doc.totalAmount)}</td>
                          </tr>
                          {isExpanded && (
                            <tr className="bg-slate-50/50">
                              <td colSpan={5} className="px-16 py-10">
                                <div className="bg-white rounded-[24px] border-2 border-slate-200 overflow-hidden shadow-2xl animate-in fade-in duration-300">
                                   <div className="bg-slate-900 px-8 py-4 border-b flex items-center justify-between">
                                      <span className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
                                         <Calculator size={14} className="text-blue-400" /> Rincian Akurasi Pajak & Diskon Per Item
                                      </span>
                                   </div>
                                   <table className="w-full text-xs">
                                      <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-500 border-b">
                                         <tr>
                                            <th className="px-8 py-5">Barang/Jasa</th>
                                            <th className="px-4 py-5 text-center">Qty</th>
                                            <th className="px-6 py-5 text-right">Harga Satuan</th>
                                            <th className="px-8 py-5 text-right bg-slate-50/50">Gross (QxP)</th>
                                            <th className="px-8 py-5 text-right bg-red-50 text-red-600 border-x border-red-100">Diskon (Nominal)</th>
                                            <th className="px-8 py-5 text-right bg-green-50 text-green-700 border-x border-green-100">PPN (12%)</th>
                                            <th className="px-8 py-5 text-right font-bold">Nett Total</th>
                                         </tr>
                                      </thead>
                                      <tbody className="divide-y divide-slate-100">
                                         {(doc.items || []).map((item, i) => (
                                            <tr key={i} className="hover:bg-slate-50/30 transition-colors">
                                               <td className="px-8 py-5 font-bold text-slate-900 uppercase">{item.description}</td>
                                               <td className="px-4 py-5 text-center font-black text-slate-600">{item.quantity}</td>
                                               <td className="px-6 py-5 text-right text-slate-500">{formatCurrency(item.unitPrice)}</td>
                                               <td className="px-8 py-5 text-right font-bold text-slate-700 bg-slate-50/30">{formatCurrency(item.quantity * item.unitPrice)}</td>
                                               <td className="px-8 py-5 text-right bg-red-50/30 border-x border-red-50">
                                                  <div className="flex flex-col items-end">
                                                     <span className="text-red-600 font-black">-{formatCurrency(item.discountAmount || 0)}</span>
                                                     {item.discountPercentage && <span className="text-[9px] bg-red-600 text-white px-1.5 py-0.5 rounded uppercase font-black mt-1">{item.discountPercentage}% OFF</span>}
                                                  </div>
                                               </td>
                                               <td className="px-8 py-5 text-right bg-green-50/30 border-x border-green-50">
                                                  <div className="flex flex-col items-end">
                                                     <span className="text-green-700 font-black">{formatCurrency(item.taxAmount || 0)}</span>
                                                     <span className="text-[8px] text-green-600/60 uppercase font-black tracking-widest mt-0.5">VAT IN (12%)</span>
                                                  </div>
                                               </td>
                                               <td className="px-8 py-5 text-right font-black text-slate-900 text-sm">{formatCurrency(item.totalPrice)}</td>
                                            </tr>
                                         ))}
                                      </tbody>
                                      <tfoot className="bg-slate-900 text-white">
                                         <tr>
                                            <td colSpan={6} className="px-8 py-5 text-right font-black uppercase text-[10px] tracking-widest border-r border-white/10">Total Akumulasi Dokumen (Nett)</td>
                                            <td className="px-8 py-5 text-right font-black text-base bg-blue-600">{formatCurrency(doc.totalAmount)}</td>
                                         </tr>
                                      </tfoot>
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
              <div className="no-print bg-slate-900 p-8 rounded-[40px] text-white flex items-center justify-between shadow-xl">
                 <div className="flex items-center gap-6">
                    <div className="bg-blue-600 p-4 rounded-3xl shadow-lg shadow-blue-500/30"><Activity size={32} /></div>
                    <div>
                       <h2 className="text-2xl font-black uppercase tracking-tighter">Hasil Audit & Rekonsiliasi</h2>
                       <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Deep Analysis Grouping berdasarkan NSFP</p>
                    </div>
                 </div>
              </div>

              {(reconResults || []).map((result, idx) => (
                <div key={idx} className={`bg-white rounded-[40px] border-2 shadow-xl overflow-hidden break-inside-avoid ${result.isMatch ? 'border-slate-200' : 'border-red-500/30'}`}>
                  <div 
                    onClick={() => toggleGroup(result.groupKey)} 
                    className={`p-10 border-b flex items-center justify-between cursor-pointer transition-colors ${!result.isMatch ? 'bg-red-50/50' : 'bg-slate-50/30'}`}
                  >
                    <div className="flex items-center gap-10">
                      <div className={`p-6 rounded-[24px] shadow-lg ${result.isMatch ? 'bg-slate-800 text-white' : 'bg-red-600 text-white shadow-red-500/20 animate-pulse'}`}>
                        {result.isMatch ? <Stamp size={36} /> : <AlertTriangle size={36} />}
                      </div>
                      <div>
                        <div className="flex items-center gap-4">
                           <h3 className="font-black text-2xl text-slate-900 uppercase tracking-tighter">
                             {result.taxNumberRef ? `PKP: ${result.taxNumberRef}` : `NON-PKP: ${result.groupKey}`}
                           </h3>
                           {!result.isMatch && (
                             <span className="bg-red-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase flex items-center gap-2">
                               <AlertTriangle size={12} /> RED FLAG: KETIDAKSESUAIAN
                             </span>
                           )}
                           {result.isMatch && (result.documents || []).length > 1 && (
                             <span className="bg-green-600 text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase flex items-center gap-2">
                               <CheckCircle2 size={12} /> DATA SINKRON
                             </span>
                           )}
                        </div>
                        <p className="text-[11px] font-black uppercase text-slate-400 mt-2 flex items-center gap-2">
                           <Clock size={12} /> Diverifikasi pada {result.checkedAt}
                        </p>
                      </div>
                    </div>
                    <ChevronDown size={28} className={`text-slate-300 transition-transform no-print ${expandedGroups[result.groupKey] ? 'rotate-180' : ''}`} />
                  </div>
                  
                  {expandedGroups[result.groupKey] && (
                    <div className="p-12 space-y-12 animate-in fade-in slide-in-from-top-4 duration-500">
                      
                      {!result.isMatch && (result.discrepancies || []).length > 0 && (
                        <div className="bg-red-50 border-2 border-red-200 rounded-[32px] p-8 space-y-4">
                           <div className="flex items-center gap-3 text-red-600 font-black text-sm uppercase tracking-widest">
                              <AlertCircle size={20} /> Rincian Temuan Audit (Anomaly Detected)
                           </div>
                           <div className="space-y-2">
                              {(result.discrepancies || []).map((msg, mIdx) => (
                                 <div key={mIdx} className="flex gap-4 text-red-800 text-sm items-start bg-white/50 p-4 rounded-2xl border border-red-100">
                                    <div className="w-2 h-2 rounded-full mt-1.5 bg-red-600 flex-shrink-0" />
                                    <span className="font-bold uppercase tracking-tight">{msg}</span>
                                 </div>
                              ))}
                           </div>
                        </div>
                      )}

                      {(result.documents || []).map((doc, dIdx) => (
                        <div key={dIdx} className="space-y-6">
                           <div className={`p-8 rounded-[32px] border flex items-center justify-between ${!result.isMatch ? 'bg-red-50/20 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
                              <div className="flex items-center gap-6">
                                 <div className={`p-3 rounded-2xl shadow-sm ${!result.isMatch ? 'bg-red-100 text-red-600' : 'bg-white text-blue-600'}`}><Files size={24} /></div>
                                 <div>
                                    <h4 className="font-black text-slate-900 text-lg uppercase tracking-tight">{doc.vendorName}</h4>
                                    <p className="text-[11px] font-black text-slate-400 uppercase mt-1">#{doc.documentNumber} | Tanggal: {doc.date}</p>
                                 </div>
                              </div>
                              <div className="text-right">
                                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Nilai</p>
                                 <p className={`text-2xl font-black tracking-tighter ${!result.isMatch ? 'text-red-600' : 'text-slate-900'}`}>{formatCurrency(doc.totalAmount)}</p>
                              </div>
                           </div>

                           <div className="overflow-hidden border-2 border-slate-100 rounded-[32px] shadow-sm bg-white">
                              <div className="bg-slate-50 px-8 py-4 border-b flex items-center justify-between">
                                 <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] flex items-center gap-2">
                                    <ListOrdered size={14} /> Detil Komponen Harga per Item (Audit Lanjutan)
                                 </span>
                              </div>
                              <table className="w-full text-left text-xs">
                                 <thead className="bg-slate-900 text-white font-black uppercase">
                                    <tr>
                                       <th className="px-8 py-5">Deskripsi Item</th>
                                       <th className="px-4 py-5 text-center">Qty</th>
                                       <th className="px-6 py-5 text-right">Unit Price</th>
                                       <th className="px-6 py-5 text-right bg-white/5">Gross</th>
                                       <th className="px-8 py-5 text-right text-red-400 bg-red-900/10">Diskon (-)</th>
                                       <th className="px-8 py-5 text-right text-green-400 bg-green-900/10">PPN 12% (+)</th>
                                       <th className="px-8 py-5 text-right">Subtotal Nett</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-slate-100">
                                    {(doc.items || []).map((item, iIdx) => (
                                       <tr key={iIdx} className="hover:bg-slate-50 transition-colors">
                                          <td className="px-8 py-5 uppercase text-slate-900 font-bold max-w-xs">{item.description}</td>
                                          <td className="px-4 py-5 text-center font-black">{item.quantity}</td>
                                          <td className="px-6 py-5 text-right text-slate-500">{formatCurrency(item.unitPrice)}</td>
                                          <td className="px-6 py-5 text-right font-bold text-slate-700 bg-slate-50/30">{formatCurrency(item.quantity * item.unitPrice)}</td>
                                          <td className="px-8 py-5 text-right bg-red-50 text-red-700 font-black">
                                             <div className="flex flex-col items-end">
                                                <span>-{formatCurrency(item.discountAmount || 0)}</span>
                                             </div>
                                          </td>
                                          <td className="px-8 py-5 text-right bg-green-50 text-green-700 font-black">
                                             <div className="flex flex-col items-end">
                                                <span>{formatCurrency(item.taxAmount || 0)}</span>
                                                <span className="text-[8px] opacity-60">PAJAK MASUKAN</span>
                                             </div>
                                          </td>
                                          <td className="px-8 py-5 text-right font-black text-slate-900 text-sm">{formatCurrency(item.totalPrice)}</td>
                                       </tr>
                                    ))}
                                 </tbody>
                                 <tfoot className="bg-slate-50 border-t">
                                    <tr>
                                       <td colSpan={6} className="px-8 py-4 text-right font-black uppercase text-[10px] tracking-widest text-slate-400">Total Akumulasi Dokumen Ini</td>
                                       <td className="px-8 py-4 text-right font-black text-slate-900 border-l border-slate-100 text-base">{formatCurrency(doc.totalAmount)}</td>
                                    </tr>
                                 </tfoot>
                              </table>
                           </div>
                        </div>
                      ))}

                      <div className={`rounded-[32px] p-10 space-y-8 shadow-2xl ${result.isMatch ? 'bg-slate-900' : 'bg-red-900 shadow-red-900/20'}`}>
                        <div className="flex items-center justify-between border-b border-white/10 pb-6">
                           <h4 className="text-white text-sm font-black uppercase tracking-[0.2em] flex items-center gap-4">
                             <ShieldCheck size={24} className={result.isMatch ? 'text-blue-500' : 'text-white'} /> Kesimpulan Auditor
                           </h4>
                           <span className="text-[10px] font-black text-white/30 uppercase tracking-widest">Verified by DocuMatch AI</span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                           <div className="space-y-4">
                              {(result.analysisFindings || []).map((f, fIdx) => (
                                 <div key={fIdx} className="flex gap-5 text-sm text-slate-100 items-start">
                                    <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${result.isMatch ? 'bg-blue-500' : 'bg-white'}`} />
                                    <span className="font-medium leading-relaxed">{f}</span>
                                 </div>
                              ))}
                           </div>
                           <div className="bg-white/5 rounded-3xl p-8 border border-white/5 flex flex-col justify-center">
                              <p className="text-[10px] font-black text-white/40 uppercase tracking-widest mb-4">Total Nilai Akumulasi</p>
                              <div className="space-y-4">
                                 <div className="flex justify-between items-end">
                                    <span className="text-slate-400 text-xs font-bold uppercase">Nilai Bersih Terbesar</span>
                                    <span className="text-white font-black text-2xl tracking-tighter">
                                      {formatCurrency(Math.max(...(result.documents || []).map(d => d.totalAmount || 0), 0))}
                                    </span>
                                 </div>
                              </div>
                           </div>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              ))}
              
              <div className="pt-20 pb-10 border-t border-slate-200 mt-20 text-center space-y-6">
                 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">Lembar Validasi Audit</h3>
                 <p className="text-xs text-slate-500 max-w-2xl mx-auto font-medium">Laporan ini membandingkan data Faktur Pembelian, Penjualan, Surat Jalan, dan Faktur Pajak. Status 'Sesuai' menandakan sinkronisasi data 100% akurat.</p>
                 <div className="flex justify-center gap-20 pt-10">
                    <div className="text-center">
                       <div className="w-40 h-px bg-slate-200 mb-4" />
                       <p className="text-[10px] font-black text-slate-400 uppercase">Petugas Audit</p>
                    </div>
                    <div className="text-center">
                       <div className="w-40 h-px bg-slate-200 mb-4" />
                       <p className="text-[10px] font-black text-slate-400 uppercase">Tanda Tangan Digital</p>
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
