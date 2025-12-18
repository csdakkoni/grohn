import React from 'react';
import { FileSpreadsheet, Download, Printer } from 'lucide-react';

export default function ExportButtons({ onExcel, onPDF, onPrint }) {
    return (
        <div className="flex gap-2">
            {onExcel && (
                <button onClick={onExcel} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-1 text-sm transition-colors" title="Excel İndir">
                    <FileSpreadsheet className="h-4 w-4" /> <span className="hidden sm:inline">Excel</span>
                </button>
            )}
            {onPDF && (
                <button onClick={onPDF} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-1 text-sm transition-colors" title="PDF İndir">
                    <Download className="h-4 w-4" /> <span className="hidden sm:inline">PDF</span>
                </button>
            )}
            {onPrint && (
                <button onClick={onPrint} className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-1 text-sm transition-colors" title="Yazdır">
                    <Printer className="h-4 w-4" /> <span className="hidden sm:inline">Yazdır</span>
                </button>
            )}
        </div>
    );
}
