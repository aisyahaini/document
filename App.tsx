
import React, { useState, useEffect } from 'react';
import { 
  FileText, Upload, CheckCircle2, Loader2, LayoutDashboard, ClipboardList, Search,
  Printer, Trash2, Activity, AlertCircle, FileSearch, Hash, Stamp, Files, Clock, 
  ChevronRight, ListOrdered, Tag, Calculator, BarChart3, AlertTriangle, 
  ShieldCheck, ArrowRight, Layers, Box, CreditCard, Sparkles
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
           updatedFiles[i].errorMessage = "Data file tidak ditemukan.";
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
      filename: `DocuMatch_Audit_${new Date().toISOString().split('T')[0]}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
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
    (doc.vendorName || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex min-h-screen bg-[#F1F5F9] text-slate-900 selection:bg-blue-100">
      {/* Dynamic Sidebar */}
      <aside className="w-20 lg:w-72 bg-slate-950 text-white hidden md:flex flex-col no-print fixed h-full z-30 shadow-2xl transition-all duration-300">
        <div className="p-6 lg:p-10 flex flex-col h-full">
          <div className="flex items-center gap-3 mb-16 overflow-hidden">
            <div className="bg-gradient-to-br from-blue-500 to-indigo-600 p-3 rounded-2xl shadow-lg shadow-blue-500/20 shrink-0">
              <Sparkles size={24} className="text-white" />
            </div>
            <span className="font-black text-2xl tracking-tighter uppercase hidden lg:block bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">DocuMatch</span>
          </div>

          <nav className="space-y-4 flex-1">
            {[
              { id: 'upload', label: 'Dashboard', icon: Box },
              { id: 'dashboard', label: 'Data Terurai', icon: LayoutDashboard },
              { id: 'reconciliation', label: 'Hasil Audit', icon: Activity },
            ].map((item) => (
              <button 
                key={item.id}
                onClick={() => setView(item.id as any)} 
                className={`w-full flex items-center gap-4 px-4 lg:px-6 py-4 rounded-2xl font-bold text-sm transition-all relative group ${view === item.id ? 'bg-white/10 text-white shadow-xl shadow-black/20' : 'text-slate-500 hover:text-white hover:bg-white/5'}`}
              >
                <item.icon size={20} className={`${view === item.id ? 'text-blue-400' : 'text-slate-500 group-hover:text-blue-400'}`} />
                <span className="hidden lg:block">{item.label}</span>
                {view === item.id && <div className="absolute left-0 w-1 h-6 bg-blue-500 rounded-r-full hidden lg:block" />}
              </button>
            ))}
          </nav>

          <div className="mt-auto hidden lg:block">
            <div className="bg-blue-600/10 border border-blue-500/20 p-5 rounded-3xl">
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center gap-2">
                <ShieldCheck size={12} /> Secure Cloud
              </p>
              <p className="text-[11px] font-bold text-slate-400 leading-relaxed">Analisis data dilakukan secara privat & terenkripsi.</p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 md:ml-20 lg:ml-72 min-h-screen overflow-x-hidden">
        {/* Header */}
        <header className="h-24 bg-white/80 backdrop-blur-md border-b flex items-center justify-between px-8 lg:px-12 sticky top-0 z-20 no-print">
          <div className="flex flex-col">
            <h1 className="text-xl lg:text-2xl font-black text-slate-900 uppercase tracking-tighter">
              {view === 'upload' ? 'Smart Upload' : view === 'dashboard' ? 'Document Analytics' : 'Audit Reconciliation'}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
               <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
               <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">AI Engine Active</span>
            </div>
          </div>

          <div className="flex items-center gap-4 lg:gap-6">
            {(view === 'reconciliation' || view === 'dashboard') && allDocs.length > 0 && (
              <button 
                onClick={handlePrint}
                disabled={isDownloading}
                className="bg-slate-900 text-white px-6 py-3.5 rounded-2xl text-xs font-black uppercase flex items-center gap-3 hover:bg-slate-800 disabled:bg-slate-300 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-slate-900/10"
              >
                {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Printer size={16} />} 
                {isDownloading ? "Analysing PDF..." : "Export Report"}
              </button>
            )}
            <div className="w-10 h-10 bg-slate-100 rounded-2xl flex items-center justify-center font-black text-slate-400 text-xs">AI</div>
          </div>
        </header>

        {/* Content Container (Centered) */}
        <div id="printable-area" className="p-6 lg:p-10 max-w-7xl mx-auto space-y-12">
          
          {/* Dashboard Stats */}
          {(view === 'dashboard' || view === 'reconciliation') && allDocs.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-in fade-in slide-in-from-top-4 duration-1000">
               {[
                 { label: 'Total Berkas', value: stats.totalDocs, icon: Layers, color: 'blue' },
                 { label: 'PPN Masukan', value: formatCurrency(stats.totalPPN), icon: CreditCard, color: 'green' },
                 { label: 'Total Diskon', value: `-${formatCurrency(stats.totalDiscount)}`, icon: Tag, color: 'red' },
                 { label: 'Grand Total', value: formatCurrency(stats.totalGrand), icon: Sparkles, color: 'indigo', primary: true },
               ].map((stat, i) => (
                  <div key={i} className={`relative overflow-hidden group p-8 rounded-[36px] border transition-all hover:shadow-2xl hover:-translate-y-1 ${stat.primary ? 'bg-slate-950 border-slate-900 shadow-xl' : 'bg-white border-slate-200 shadow-sm'}`}>
                     <div className={`p-4 rounded-2xl w-fit mb-6 ${stat.primary ? 'bg-blue-600' : 'bg-slate-50 text-slate-900'}`}>
                        <stat.icon size={22} className={stat.primary ? 'text-white' : `text-${stat.color}-600`} />
                     </div>
                     <p className={`text-[10px] font-black uppercase tracking-widest mb-1 ${stat.primary ? 'text-slate-500' : 'text-slate-400'}`}>{stat.label}</p>
                     <p className={`text-2xl font-black tracking-tight ${stat.primary ? 'text-white' : 'text-slate-900'}`}>{stat.value}</p>
                     <div className="absolute top-0 right-0 p-8 opacity-0 group-hover:opacity-10 transition-opacity">
                        <stat.icon size={80} />
                     </div>
                  </div>
               ))}
            </div>
          )}

          {view === 'upload' && (
            <div className="max-w-4xl mx-auto space-y-12 py-10">
              <div className="text-center space-y-4">
                 <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter uppercase italic">Ready to audit?</h2>
                 <p className="text-slate-500 font-medium text-lg">Unggah berkas pajak Anda dan biarkan AI kami bekerja.</p>
              </div>

              <div className="group relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[48px] blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
                <div className="bg-white rounded-[48px] border-2 border-dashed border-slate-200 p-16 lg:p-24 text-center hover:border-blue-500 transition-all relative cursor-pointer shadow-2xl no-print">
                  <input type="file" multiple onChange={handleFileSelect} className="absolute inset-0 opacity-0 cursor-pointer" accept="image/*,.pdf" />
                  <div className="mx-auto w-28 h-28 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-10 shadow-inner group-hover:scale-110 transition-transform duration-500">
                    <Upload size={48} />
                  </div>
                  <h3 className="text-3xl font-black text-slate-900 uppercase tracking-tighter mb-4">Seret Berkas Kesini</h3>
                  <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">Mendukung JPEG, PNG, dan PDF Hingga 50MB</p>
                </div>
              </div>

              {files.length > 0 && (
                <div className="bg-white rounded-[40px] shadow-2xl border border-slate-200 overflow-hidden animate-in slide-in-from-bottom-10 duration-700 no-print">
                  <div className="px-10 py-8 border-b bg-slate-50/50 flex flex-col lg:flex-row justify-between items-center gap-6">
                    <h2 className="font-black text-xl uppercase text-slate-800 flex items-center gap-4">
                      <Layers size={24} className="text-blue-600" /> Pending Analysis ({files.length} Berkas)
                    </h2>
                    <button 
                      onClick={processAllFiles} 
                      disabled={isProcessing} 
                      className="w-full lg:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-10 py-5 rounded-3xl text-sm font-black flex items-center justify-center gap-4 uppercase disabled:opacity-50 hover:shadow-2xl hover:shadow-blue-600/30 transition-all hover:-translate-y-1 active:translate-y-0"
                    >
                      {isProcessing ? <Loader2 className="animate-spin" size={20} /> : <Sparkles size={20} />} 
                      {isProcessing ? 'Processing AI...' : 'Start Intelligence Audit'}
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {files.map(f => (
                      <div key={f.id} className="px-10 py-8 flex items-center gap-8 group hover:bg-slate-50 transition-all">
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center shadow-sm transition-colors ${f.status === 'completed' ? 'bg-green-100 text-green-600' : f.status === 'error' ? 'bg-red-100 text-red-600' : 'bg-slate-100 text-slate-400'}`}>
                           {f.status === 'processing' ? <Loader2 className="animate-spin" size={28} /> : <FileText size={32} />}
                        </div>
                        <div className="flex-1">
                           <p className="font-black text-lg text-slate-800 truncate">{f.fileName}</p>
                           <div className="flex items-center gap-3 mt-1.5">
                              <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg ${f.status === 'completed' ? 'bg-green-50 text-green-600' : f.status === 'error' ? 'bg-red-50 text-red-600' : 'bg-slate-200 text-slate-500'}`}>
                                 {f.status}
                              </span>
                              {f.extractedDocs && <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest bg-blue-50 px-3 py-1 rounded-lg">{f.extractedDocs.length} Docs Detected</span>}
                           </div>
                        </div>
                        <button onClick={() => setFiles(prev => prev.filter(x => x.id !== f.id))} disabled={isProcessing} className="p-4 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-all">
                          <Trash2 size={24} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <div className="bg-white rounded-[40px] border border-slate-200 shadow-xl overflow-hidden">
                <div className="p-10 border-b bg-slate-50/50 flex flex-col lg:flex-row justify-between items-center gap-6 no-print">
                   <div className="relative w-full lg:w-96">
                      <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                      <input 
                        type="text" 
                        placeholder="Search invoices, vendors..." 
                        className="pl-16 pr-8 py-5 bg-white border-2 border-slate-100 rounded-3xl text-sm outline-none w-full focus:border-blue-500 transition-all font-bold placeholder:text-slate-300"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                      />
                   </div>
                   <div className="flex items-center gap-4 text-slate-400 font-bold text-xs uppercase tracking-widest">
                      <span>Found {filteredDashboardDocs.length} Records</span>
                   </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-950 text-white text-[10px] font-black uppercase tracking-[0.2em]">
                      <tr>
                        <th className="px-10 py-10 w-20 text-center"></th>
                        <th className="px-10 py-10">Document Identity</th>
                        <th className="px-10 py-10">Entity Name</th>
                        <th className="px-10 py-10 text-right">Tax (PPN)</th>
                        <th className="px-10 py-10 text-right">Settlement</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(filteredDashboardDocs || []).map((doc, idx) => {
                        const isExpanded = expandedDashboardDocs[doc.documentNumber];
                        return (
                          <React.Fragment key={idx}>
                            <tr onClick={() => toggleDashboardDoc(doc.documentNumber)} className={`cursor-pointer transition-all duration-300 hover:bg-slate-50 group ${isExpanded ? 'bg-slate-50/50' : ''}`}>
                              <td className="px-10 py-10 text-center no-print">
                                 <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isExpanded ? 'bg-blue-600 text-white rotate-90' : 'bg-slate-100 text-slate-400'}`}>
                                    <ChevronRight size={18} />
                                 </div>
                              </td>
                              <td className="px-10 py-10">
                                <div className="font-black text-slate-900 text-lg">#{doc.documentNumber}</div>
                                <div className="text-[10px] font-black text-blue-500 uppercase mt-1 flex items-center gap-2">
                                   <Hash size={10} /> NSFP: {doc.taxInvoiceNumber || 'INTERNAL'}
                                </div>
                              </td>
                              <td className="px-10 py-10 text-slate-600 font-black uppercase text-xs">{doc.vendorName}</td>
                              <td className="px-10 py-10 text-right font-black text-green-600">{formatCurrency(doc.taxAmount || 0)}</td>
                              <td className="px-10 py-10 text-right font-black text-slate-950 text-lg">{formatCurrency(doc.totalAmount)}</td>
                            </tr>
                            {isExpanded && (
                              <tr className="bg-slate-50/30">
                                <td colSpan={5} className="px-10 lg:px-20 py-12">
                                  <div className="bg-white rounded-[40px] border-2 border-slate-200 overflow-hidden shadow-2xl">
                                     <div className="bg-slate-950 px-10 py-6 border-b flex items-center justify-between">
                                        <span className="text-[11px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
                                           <Calculator size={16} className="text-blue-400" /> Granular Tax Breakdown
                                        </span>
                                        <div className="flex items-center gap-4">
                                           <span className="text-[10px] font-black text-slate-500 uppercase">Document Date: {doc.date}</span>
                                        </div>
                                     </div>
                                     <table className="w-full text-xs">
                                        <thead className="bg-slate-50 text-[10px] font-black uppercase text-slate-400 border-b">
                                           <tr>
                                              <th className="px-10 py-6">Description</th>
                                              <th className="px-6 py-6 text-center">Qty</th>
                                              <th className="px-10 py-6 text-right">Gross (Base)</th>
                                              <th className="px-10 py-6 text-right bg-red-50/50 text-red-600 border-x border-red-50">Disc (-)</th>
                                              <th className="px-10 py-6 text-right bg-green-50/50 text-green-700 border-x border-green-50">VAT 12% (+)</th>
                                              <th className="px-10 py-6 text-right font-bold">Line Net</th>
                                           </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                           {(doc.items || []).map((item, i) => (
                                              <tr key={i} className="hover:bg-slate-50 transition-colors">
                                                 <td className="px-10 py-6 font-bold text-slate-900 uppercase">{item.description}</td>
                                                 <td className="px-6 py-6 text-center font-black text-slate-500">{item.quantity}</td>
                                                 <td className="px-10 py-6 text-right text-slate-500 font-medium">{formatCurrency(item.quantity * item.unitPrice)}</td>
                                                 <td className="px-10 py-6 text-right bg-red-50/20 border-x border-red-50">
                                                    <div className="flex flex-col items-end">
                                                       <span className="text-red-600 font-black">-{formatCurrency(item.discountAmount || 0)}</span>
                                                    </div>
                                                 </td>
                                                 <td className="px-10 py-6 text-right bg-green-50/20 border-x border-green-50">
                                                    <div className="flex flex-col items-end">
                                                       <span className="text-green-700 font-black">{formatCurrency(item.taxAmount || 0)}</span>
                                                    </div>
                                                 </td>
                                                 <td className="px-10 py-6 text-right font-black text-slate-950 text-sm">{formatCurrency(item.totalPrice)}</td>
                                              </tr>
                                           ))}
                                        </tbody>
                                        <tfoot className="bg-slate-950 text-white">
                                           <tr>
                                              <td colSpan={5} className="px-10 py-8 text-right font-black uppercase text-[11px] tracking-widest text-slate-400">Total Settlement Value</td>
                                              <td className="px-10 py-8 text-right font-black text-xl bg-blue-600">{formatCurrency(doc.totalAmount)}</td>
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
            </div>
          )}

          {view === 'reconciliation' && (
            <div className="space-y-12 max-w-6xl mx-auto animate-in fade-in slide-in-from-bottom-6 duration-1000">
              <div className="no-print bg-gradient-to-br from-slate-900 to-slate-950 p-12 rounded-[48px] text-white flex flex-col lg:flex-row items-center justify-between gap-10 shadow-3xl">
                 <div className="flex items-center gap-8">
                    <div className="bg-blue-600 p-6 rounded-[32px] shadow-2xl shadow-blue-500/40 transform rotate-3"><Activity size={40} /></div>
                    <div>
                       <h2 className="text-3xl font-black uppercase tracking-tighter">Audit Intelligence</h2>
                       <p className="text-slate-400 text-sm font-bold uppercase tracking-widest mt-2">Deep cross-matching across all extracted bundles</p>
                    </div>
                 </div>
                 <div className="flex items-center gap-10 border-l border-white/10 pl-10 hidden lg:flex">
                    <div className="text-center">
                       <p className="text-slate-500 font-black text-[10px] uppercase tracking-widest mb-1">Status Grup</p>
                       <p className="text-2xl font-black">{reconResults.length} Units</p>
                    </div>
                    <div className="text-center">
                       <p className="text-slate-500 font-black text-[10px] uppercase tracking-widest mb-1">Alerts</p>
                       <p className={`text-2xl font-black ${stats.alertsCount > 0 ? 'text-red-500' : 'text-green-500'}`}>{stats.alertsCount} Issues</p>
                    </div>
                 </div>
              </div>

              {(reconResults || []).map((result, idx) => (
                <div key={idx} className={`bg-white rounded-[48px] border-2 shadow-2xl overflow-hidden group transition-all duration-500 ${result.isMatch ? 'border-slate-100 hover:border-blue-200' : 'border-red-100'}`}>
                  <div 
                    onClick={() => toggleGroup(result.groupKey)} 
                    className={`p-10 lg:p-14 flex flex-col lg:flex-row items-center justify-between cursor-pointer gap-10 ${!result.isMatch ? 'bg-red-50/30' : 'bg-slate-50/20'}`}
                  >
                    <div className="flex items-center gap-10 w-full lg:w-auto">
                      <div className={`p-8 rounded-[36px] shadow-2xl transition-transform group-hover:scale-110 ${result.isMatch ? 'bg-slate-950 text-white' : 'bg-red-600 text-white animate-pulse'}`}>
                        {result.isMatch ? <Stamp size={42} /> : <AlertTriangle size={42} />}
                      </div>
                      <div className="flex-1">
                        <div className="flex flex-wrap items-center gap-5">
                           <h3 className="font-black text-3xl text-slate-900 uppercase tracking-tighter">
                             {result.taxNumberRef ? `Ref: ${result.taxNumberRef}` : `Group: ${result.groupKey}`}
                           </h3>
                           {!result.isMatch ? (
                             <span className="bg-red-600 text-white text-[10px] font-black px-5 py-2 rounded-full uppercase flex items-center gap-2 tracking-widest">
                               <AlertCircle size={14} /> Critical Variance
                             </span>
                           ) : (
                             <span className="bg-green-600 text-white text-[10px] font-black px-5 py-2 rounded-full uppercase flex items-center gap-2 tracking-widest">
                               <CheckCircle2 size={14} /> Audit Match
                             </span>
                           )}
                        </div>
                        <p className="text-[11px] font-black uppercase text-slate-400 mt-3 flex items-center gap-2 tracking-widest">
                           <Clock size={12} /> Timestamped: {result.checkedAt}
                        </p>
                      </div>
                    </div>
                    <div className="w-16 h-16 rounded-3xl bg-white border border-slate-100 flex items-center justify-center text-slate-300 group-hover:text-blue-500 transition-all no-print">
                        <ChevronRight size={28} className={`transition-transform duration-500 ${expandedGroups[result.groupKey] ? 'rotate-90' : ''}`} />
                    </div>
                  </div>
                  
                  {expandedGroups[result.groupKey] && (
                    <div className="p-10 lg:p-16 space-y-16 animate-in fade-in slide-in-from-top-4 duration-700">
                      
                      {!result.isMatch && (result.discrepancies || []).length > 0 && (
                        <div className="bg-red-50 border-2 border-red-100 rounded-[40px] p-10 space-y-6">
                           <div className="flex items-center gap-4 text-red-600 font-black text-lg uppercase tracking-tighter">
                              <AlertCircle size={28} /> Anomaly Summary
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {(result.discrepancies || []).map((msg, mIdx) => (
                                 <div key={mIdx} className="flex gap-5 text-red-900 text-sm items-start bg-white p-6 rounded-[32px] border border-red-50 shadow-sm">
                                    <div className="w-3 h-3 rounded-full mt-1 bg-red-600 shrink-0" />
                                    <span className="font-bold leading-relaxed uppercase italic">{msg}</span>
                                 </div>
                              ))}
                           </div>
                        </div>
                      )}

                      <div className="grid grid-cols-1 gap-12">
                        {(result.documents || []).map((doc, dIdx) => (
                          <div key={dIdx} className="space-y-8">
                             <div className="flex items-center justify-between px-4">
                                <div className="flex items-center gap-6">
                                   <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600"><Files size={28} /></div>
                                   <div>
                                      <h4 className="font-black text-slate-900 text-xl uppercase tracking-tighter">{doc.vendorName}</h4>
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID: {doc.documentNumber} • {doc.date}</p>
                                   </div>
                                </div>
                                <div className="text-right">
                                   <p className="text-2xl font-black tracking-tighter">{formatCurrency(doc.totalAmount)}</p>
                                </div>
                             </div>

                             <div className="overflow-hidden border-2 border-slate-50 rounded-[40px] shadow-sm bg-white">
                                <table className="w-full text-left text-xs">
                                   <thead className="bg-slate-950 text-white font-black uppercase tracking-widest">
                                      <tr>
                                         <th className="px-10 py-6">Audit Line Item</th>
                                         <th className="px-6 py-6 text-center">Qty</th>
                                         <th className="px-10 py-6 text-right bg-white/5">Gross Base</th>
                                         <th className="px-10 py-6 text-right text-red-400 bg-red-950/20">Disc (-)</th>
                                         <th className="px-10 py-6 text-right text-green-400 bg-green-950/20">VAT 12% (+)</th>
                                         <th className="px-10 py-6 text-right">Net Sub</th>
                                      </tr>
                                   </thead>
                                   <tbody className="divide-y divide-slate-100">
                                      {(doc.items || []).map((item, iIdx) => (
                                         <tr key={iIdx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-10 py-6 uppercase text-slate-900 font-bold">{item.description}</td>
                                            <td className="px-6 py-6 text-center font-black">{item.quantity}</td>
                                            <td className="px-10 py-6 text-right text-slate-400">{formatCurrency(item.quantity * item.unitPrice)}</td>
                                            <td className="px-10 py-6 text-right bg-red-50 text-red-700 font-black">-{formatCurrency(item.discountAmount || 0)}</td>
                                            <td className="px-10 py-6 text-right bg-green-50 text-green-700 font-black">{formatCurrency(item.taxAmount || 0)}</td>
                                            <td className="px-10 py-6 text-right font-black text-slate-900 text-sm">{formatCurrency(item.totalPrice)}</td>
                                         </tr>
                                      ))}
                                   </tbody>
                                </table>
                             </div>
                          </div>
                        ))}
                      </div>

                      <div className={`rounded-[48px] p-12 space-y-10 shadow-3xl ${result.isMatch ? 'bg-slate-950' : 'bg-red-950 shadow-red-900/30'}`}>
                        <div className="flex flex-col lg:flex-row items-center justify-between border-b border-white/10 pb-10 gap-6">
                           <h4 className="text-white text-xl font-black uppercase tracking-tighter flex items-center gap-5">
                             <ShieldCheck size={32} className={result.isMatch ? 'text-blue-500' : 'text-white'} /> Auditor Conclusion
                           </h4>
                           <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] bg-white/5 px-6 py-2 rounded-full border border-white/5">Verified by Intelligence Core</span>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
                           <div className="space-y-6">
                              {(result.analysisFindings || []).map((f, fIdx) => (
                                 <div key={fIdx} className="flex gap-6 text-slate-100 items-start group">
                                    <div className={`w-3 h-3 rounded-full mt-2 shrink-0 transition-transform group-hover:scale-150 ${result.isMatch ? 'bg-blue-500 shadow-lg shadow-blue-500/50' : 'bg-white'}`} />
                                    <span className="font-bold text-sm leading-relaxed uppercase italic tracking-tight">{f}</span>
                                 </div>
                              ))}
                           </div>
                           <div className="bg-white/5 rounded-[40px] p-10 border border-white/10 flex flex-col justify-center relative overflow-hidden group">
                              <div className="absolute top-0 right-0 p-6 text-white/5 transform rotate-12"><CreditCard size={120} /></div>
                              <p className="text-[11px] font-black text-slate-500 uppercase tracking-[0.3em] mb-4">Maximum Realized Value</p>
                              <div className="relative z-10">
                                 <p className="text-white font-black text-5xl tracking-tighter mb-2">
                                   {formatCurrency(Math.max(...(result.documents || []).map(d => d.totalAmount || 0), 0))}
                                 </p>
                                 <div className="flex items-center gap-2 text-green-500 text-[10px] font-black uppercase">
                                    <ArrowRight size={12} /> Validated for accounting entry
                                 </div>
                              </div>
                           </div>
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              ))}
              
              <div className="pt-32 pb-20 border-t border-slate-200 mt-20 text-center space-y-10 no-print">
                 <div className="mx-auto w-24 h-24 bg-slate-900 rounded-full flex items-center justify-center text-white mb-6">
                    <Sparkles size={40} />
                 </div>
                 <h3 className="text-4xl font-black text-slate-900 uppercase tracking-tighter italic">Official Validation Sheet</h3>
                 <p className="text-slate-500 max-w-2xl mx-auto font-bold uppercase tracking-widest text-[10px] leading-loose">
                    This report verifies synchronization across PO, Invoices, GR, and Tax Docs. 
                    A match status indicates 100% data integrity for financial processing.
                 </p>
                 <div className="flex justify-center gap-32 pt-20">
                    <div className="text-center group">
                       <div className="w-48 h-1 bg-slate-200 mb-6 group-hover:bg-blue-600 transition-colors" />
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lead Auditor Sign</p>
                    </div>
                    <div className="text-center group">
                       <div className="w-48 h-1 bg-slate-200 mb-6 group-hover:bg-blue-600 transition-colors" />
                       <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">AI Timestamp Verified</p>
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
