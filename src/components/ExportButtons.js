import React from 'react';
import { FileSpreadsheet, Download, Printer } from 'lucide-react';

export default function ExportButtons({ onExcel, onPDF, onPrint }) {
    return (
        <div className="flex gap-2">
            {onExcel && (
                <button onClick={onExcel} className="bg-[#107c10] hover:bg-[#0b5a0b] text-white px-3 py-2 rounded-[6px] font-bold flex items-center gap-1 text-xs uppercase tracking-wide transition-colors shadow-sm" title="Excel İndir">
                    <FileSpreadsheet className="h-4 w-4" /> <span className="hidden sm:inline">Excel</span>
                </button>
            )}
            {onPDF && (
                <button onClick={onPDF} className="bg-[#d21e1e] hover:bg-[#b01616] text-white px-3 py-2 rounded-[6px] font-bold flex items-center gap-1 text-xs uppercase tracking-wide transition-colors shadow-sm" title="PDF İndir">
                    <Download className="h-4 w-4" /> <span className="hidden sm:inline">PDF</span>
                </button>
            )}
            {onPrint && (
                <button onClick={onPrint} className="bg-[#86868b] hover:bg-[#6e6e73] text-white px-3 py-2 rounded-[6px] font-bold flex items-center gap-1 text-xs uppercase tracking-wide transition-colors shadow-sm" title="Yazdır">
                    <Printer className="h-4 w-4" /> <span className="hidden sm:inline">Yazdır</span>
                </button>
            )}
        </div>
    );
}
