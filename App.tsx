
import React, { useState, useCallback, useMemo } from 'react';
import { 
  FileText, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  LayoutDashboard, 
  ClipboardList, 
  Search,
  ChevronRight,
  TrendingUp,
  Package,
  Receipt
} from 'lucide-react';
import { ProcessingFile, ExtractedData, ReconciliationResult } from './types';
import { fileToBase64, processDocument, reconcileDocuments } from './services/geminiService';

const App: React.FC = () => {
  const [files, setFiles] = useState<ProcessingFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [view, setView] = useState<'upload' | 'dashboard' | 'reconciliation'>('upload');
  const [reconResults, setReconResults] = useState<ReconciliationResult[]>([]);

  // Fixed: Explicitly typed 'file' in map to resolve 'unknown' type error for URL.createObjectURL.
  // Also replaced deprecated 'substr' with 'substring'.
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files) return;
    
    const newFiles = Array.from(event.target.files).map((file: File) => ({
      id: Math.random().toString(36).substring(2, 11),
      file,
      previewUrl: URL.createObjectURL(file),
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

        const base64 = await fileToBase64(updatedFiles[i].file);
        const data = await processDocument(base64, updatedFiles[i].file.type);
        
        updatedFiles[i].extractedData = data;
        updatedFiles[i].status = 'completed';
      } catch (error) {
        console.error(error);
        updatedFiles[i].status = 'error';
        updatedFiles[i].errorMessage = "Failed to process document. Please ensure it's a clear image or PDF.";
      }
      setFiles([...updatedFiles]);
    }

    const docs = updatedFiles
      .filter(f => f.status === 'completed' && f.extractedData)
      .map(f => f.extractedData!);

    if (docs.length > 0) {
      const results = await reconcileDocuments(docs);
      setReconResults(results);
    }
    
    setIsProcessing(false);
  };

  const removeFile = (id: string) => {
    setFiles(prev => prev.filter(f => f.id !== id));
  };

  const stats = useMemo(() => {
    const total = files.length;
    const completed = files.filter(f => f.status === 'completed').length;
    const discrepancies = reconResults.filter(r => !r.isMatch).length;
    const matched = reconResults.filter(r => r.isMatch).length;
    return { total, completed, discrepancies, matched };
  }, [files, reconResults]);

  return (
    <div className="flex min-h-screen bg-[#F8FAFC]">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col">
        <div className="p-6">
          <div className="flex items-center gap-2 text-blue-600 mb-8">
            <div className="bg-blue-600 text-white p-1.5 rounded-lg">
              <ClipboardList size={24} />
            </div>
            <span className="font-bold text-xl tracking-tight text-slate-800">DocuMatch AI</span>
          </div>

          <nav className="space-y-1">
            <button 
              onClick={() => setView('upload')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${view === 'upload' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <Upload size={18} />
              Upload Documents
            </button>
            <button 
              onClick={() => setView('dashboard')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${view === 'dashboard' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <LayoutDashboard size={18} />
              Dashboard
            </button>
            <button 
              onClick={() => setView('reconciliation')}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${view === 'reconciliation' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              <FileText size={18} />
              Reconciliation
            </button>
          </nav>
        </div>

        <div className="mt-auto p-6 border-t border-slate-100">
          <div className="bg-slate-900 rounded-2xl p-4 text-white">
            <p className="text-xs text-slate-400 mb-1">Current Plan</p>
            <p className="text-sm font-semibold mb-3">Enterprise AI</p>
            <div className="w-full bg-slate-700 h-1.5 rounded-full overflow-hidden">
              <div className="bg-blue-500 h-full w-3/4"></div>
            </div>
            <p className="text-[10px] text-slate-400 mt-2">750/1000 docs this month</p>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-8 sticky top-0 z-10">
          <h1 className="text-xl font-bold text-slate-800">
            {view === 'upload' && 'Upload & Process Documents'}
            {view === 'dashboard' && 'Operations Dashboard'}
            {view === 'reconciliation' && 'Reconciliation Analysis'}
          </h1>

          <div className="flex items-center gap-4">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search records..." 
                className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-blue-500 w-64 outline-none"
              />
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center text-blue-700 font-bold">
              JD
            </div>
          </div>
        </header>

        <div className="p-8 max-w-7xl mx-auto">
          {view === 'upload' && (
            <div className="space-y-8">
              {/* Dropzone area */}
              <div className="bg-white rounded-3xl border-2 border-dashed border-slate-200 p-12 text-center hover:border-blue-400 transition-colors cursor-pointer group relative">
                <input 
                  type="file" 
                  multiple 
                  onChange={handleFileSelect} 
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  accept="image/*,.pdf"
                />
                <div className="mx-auto w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600 mb-4 group-hover:scale-110 transition-transform">
                  <Upload size={32} />
                </div>
                <h3 className="text-lg font-semibold text-slate-800 mb-1">Click or drag files to upload</h3>
                <p className="text-slate-500 text-sm max-w-sm mx-auto">
                  Supports POs, Invoices, Delivery Notes, and Tax Receipts (PDF, JPG, PNG)
                </p>
              </div>

              {files.length > 0 && (
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <h2 className="font-semibold text-slate-800">Uploaded Files ({files.length})</h2>
                    <button 
                      onClick={processAllFiles}
                      disabled={isProcessing || files.every(f => f.status === 'completed')}
                      className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white px-6 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2"
                    >
                      {isProcessing ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                      {isProcessing ? 'Processing...' : 'Run Reconciliation'}
                    </button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {files.map((f) => (
                      <div key={f.id} className="p-4 flex items-center gap-4 hover:bg-slate-50 transition-colors">
                        <div className="w-12 h-16 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex-shrink-0">
                          {f.file.type.includes('image') ? (
                            <img src={f.previewUrl} alt="preview" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-slate-400">
                              <FileText size={24} />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-900 truncate">{f.file.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-xs text-slate-500">{(f.file.size / 1024).toFixed(1)} KB</span>
                            {f.extractedData && (
                              <span className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-bold">
                                {f.extractedData.documentType}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          {f.status === 'processing' && <Loader2 className="animate-spin text-blue-600" size={20} />}
                          {f.status === 'completed' && <CheckCircle2 className="text-green-500" size={20} />}
                          {f.status === 'error' && (
                            <div className="flex items-center gap-2 text-red-500">
                              <AlertCircle size={20} />
                              <span className="text-xs hidden sm:block">Extraction Failed</span>
                            </div>
                          )}
                          <button 
                            onClick={() => removeFile(f.id)}
                            className="text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <AlertCircle size={18} className="rotate-45" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {view === 'dashboard' && (
            <div className="space-y-8">
              {/* Stats Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                      <FileText size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Total Processed</p>
                      <h4 className="text-2xl font-bold text-slate-800">{stats.completed}</h4>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                    <TrendingUp size={14} />
                    <span>+12.5% from last month</span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-green-50 text-green-600 rounded-2xl">
                      <CheckCircle2 size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Perfectly Matched</p>
                      <h4 className="text-2xl font-bold text-slate-800">{stats.matched}</h4>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">Accuracy: {stats.completed > 0 ? Math.round((stats.matched / stats.completed) * 100) : 0}%</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
                      <AlertCircle size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Discrepancies</p>
                      <h4 className="text-2xl font-bold text-slate-800">{stats.discrepancies}</h4>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">Needs manual review</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-2xl">
                      <Receipt size={24} />
                    </div>
                    <div>
                      <p className="text-sm text-slate-500">Audit Health</p>
                      <h4 className="text-2xl font-bold text-slate-800">Excellent</h4>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">Based on recent 50 docs</p>
                </div>
              </div>

              {/* Recent Activity / Items */}
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                  <h3 className="font-bold text-slate-800">Recent Transactions</h3>
                  <button className="text-blue-600 text-sm font-semibold flex items-center gap-1">
                    View All <ChevronRight size={16} />
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-slate-50 text-slate-500 text-[10px] uppercase tracking-wider font-bold">
                      <tr>
                        <th className="px-6 py-4">Document</th>
                        <th className="px-6 py-4">Vendor / Customer</th>
                        <th className="px-6 py-4">Amount</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {files.filter(f => f.extractedData).map(f => (
                        <tr key={f.id} className="hover:bg-slate-50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-slate-800">{f.extractedData?.documentNumber}</div>
                            <div className="text-xs text-slate-500">{f.extractedData?.documentType}</div>
                          </td>
                          <td className="px-6 py-4">
                             <div className="text-slate-800">{f.extractedData?.vendorName || f.extractedData?.customerName || 'N/A'}</div>
                          </td>
                          <td className="px-6 py-4 font-medium text-slate-800">
                            {f.extractedData?.totalAmount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-50 text-green-600">Processed</span>
                          </td>
                          <td className="px-6 py-4">
                            <button className="text-slate-400 hover:text-blue-600 transition-colors">
                              <ChevronRight size={18} />
                            </button>
                          </td>
                        </tr>
                      ))}
                      {files.filter(f => f.extractedData).length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                             No data available. Upload documents to see results.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {view === 'reconciliation' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 gap-6">
                {reconResults.map((result, idx) => (
                  <div key={idx} className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className={`p-6 border-b flex items-center justify-between ${result.isMatch ? 'bg-green-50/50 border-green-100' : 'bg-red-50/50 border-red-100'}`}>
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-xl ${result.isMatch ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                          {result.isMatch ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-800">Ref: {result.groupKey}</h3>
                          <p className="text-xs text-slate-500">{result.documents.length} Linked Documents</p>
                        </div>
                      </div>
                      <span className={`px-4 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${result.isMatch ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                        {result.isMatch ? 'Fully Reconciled' : 'Discrepancy Detected'}
                      </span>
                    </div>

                    <div className="p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div>
                          <h4 className="text-xs font-bold uppercase text-slate-400 mb-4 tracking-wider">Document Chain</h4>
                          <div className="space-y-3">
                            {result.documents.map((doc, dIdx) => (
                              <div key={dIdx} className="flex items-center gap-4 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                                <div className="p-2 bg-white rounded-lg shadow-sm">
                                  {doc.documentType.includes('PO') ? <Package size={20} className="text-blue-500" /> : <Receipt size={20} className="text-orange-500" />}
                                </div>
                                <div className="flex-1">
                                  <div className="text-sm font-semibold text-slate-800">{doc.documentType}</div>
                                  <div className="text-xs text-slate-500">#{doc.documentNumber} • {doc.date}</div>
                                </div>
                                <div className="text-right">
                                  <div className="text-sm font-bold text-slate-800">{doc.totalAmount.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>

                        <div>
                          <h4 className="text-xs font-bold uppercase text-slate-400 mb-4 tracking-wider">Reconciliation Details</h4>
                          {result.discrepancies.length > 0 ? (
                            <div className="bg-red-50 border border-red-100 rounded-2xl p-5 space-y-3">
                              {result.discrepancies.map((msg, mIdx) => (
                                <div key={mIdx} className="flex gap-3 text-red-700 text-sm font-medium">
                                  <AlertCircle size={18} className="flex-shrink-0" />
                                  <span>{msg}</span>
                                </div>
                              ))}
                              <div className="pt-4 mt-4 border-t border-red-200">
                                <button className="bg-red-600 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-red-700 transition-colors">
                                  Flag for Review
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="bg-green-50 border border-green-100 rounded-2xl p-5">
                              <div className="flex gap-3 text-green-700 text-sm font-medium">
                                <CheckCircle2 size={18} className="flex-shrink-0" />
                                <span>All quantities and amounts match perfectly across the chain.</span>
                              </div>
                              <div className="mt-4 flex gap-2">
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">QA PASSED</span>
                                <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-bold">AUDIT READY</span>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}

                {reconResults.length === 0 && (
                  <div className="bg-white rounded-3xl border border-slate-200 p-20 text-center">
                    <div className="mx-auto w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-6">
                      <FileText size={40} />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800 mb-2">No Reconciliation Data</h3>
                    <p className="text-slate-500 max-w-sm mx-auto mb-8">
                      Upload and process multiple related documents (e.g. PO + Invoice) to see how they match up.
                    </p>
                    <button 
                      onClick={() => setView('upload')}
                      className="bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                    >
                      Start Processing
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default App;
