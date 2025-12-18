import React, { useState, useEffect } from 'react';
import { History, Filter, ArrowUpRight, ArrowDownLeft, RefreshCw, Search } from 'lucide-react';
import { supabase } from '../supabaseClient';

import ExportButtons from './ExportButtons';
import { exportToExcel, exportToPDF, handlePrint } from '../utils/exportUtils';

export default function StockHistoryModule({ inventory }) {
    const [movements, setMovements] = useState([]);
    const [loading, setLoading] = useState(false);

    // Server-side filters
    const [filter, setFilter] = useState({
        itemId: '',
        reason: '',
        startDate: '',
        endDate: ''
    });

    // Client-side search
    const [searchTerm, setSearchTerm] = useState('');

    const fetchMovements = async () => {
        setLoading(true);
        let query = supabase
            .from('stock_movements')
            .select(`
                *,
                inventory:inventory_id (name, unit, product_code)
            `)
            .order('created_at', { ascending: false });

        if (filter.itemId) query = query.eq('inventory_id', filter.itemId);
        if (filter.reason) query = query.eq('reason', filter.reason);
        if (filter.startDate) query = query.gte('created_at', filter.startDate);
        if (filter.endDate) query = query.lte('created_at', filter.endDate + 'T23:59:59');

        const { data, error } = await query;
        if (error) {
            console.error('Error fetching movements:', error);
        } else {
            setMovements(data || []);
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchMovements();
    }, []);

    // Filter displayed results
    const displayedMovements = movements.filter(m => {
        if (!searchTerm) return true;
        const lowerTerm = searchTerm.toLowerCase();
        const productName = m.inventory?.name?.toLowerCase() || '';
        const productCode = m.inventory?.product_code?.toLowerCase() || '';
        const notes = m.notes?.toLowerCase() || '';
        const reason = m.reason?.toLowerCase() || '';

        return productName.includes(lowerTerm) ||
            productCode.includes(lowerTerm) ||
            notes.includes(lowerTerm) ||
            reason.includes(lowerTerm);
    });

    const getExportData = () => displayedMovements.map(m => ({
        'Tarih': new Date(m.created_at).toLocaleString('tr-TR'),
        'Ürün': `${m.inventory?.product_code || m.inventory?.id || ''} - ${m.inventory?.name || '-'}`,
        'İşlem': m.reason,
        'Miktar': m.amount || m.change_amount,
        'Birim': m.inventory?.unit || '-',
        'Stok Bakiyesi': m.current_stock,
        'Notlar': m.notes || '-'
    }));

    const handleExcel = () => exportToExcel(getExportData(), 'stok_hareketleri');

    const handlePDF = () => exportToPDF(
        'Stok Hareketleri',
        ['Tarih', 'Ürün', 'İşlem', 'Miktar', 'Bakiye', 'Notlar'],
        displayedMovements.map(m => [
            new Date(m.created_at).toLocaleString('tr-TR'),
            `${m.inventory?.product_code || m.inventory?.id || ''} - ${m.inventory?.name || '-'}`,
            m.reason,
            `${m.amount || m.change_amount} ${m.inventory?.unit || ''}`,
            `${m.current_stock} ${m.inventory?.unit || ''}`,
            m.notes || '-'
        ]),
        'stok_hareketleri'
    );

    const handlePrintList = () => handlePrint(
        'Stok Hareketleri',
        ['Tarih', 'Ürün', 'İşlem', 'Miktar', 'Bakiye', 'Notlar'],
        displayedMovements.map(m => [
            new Date(m.created_at).toLocaleString('tr-TR'),
            m.inventory?.name || '-',
            m.reason,
            `${m.amount || m.change_amount} ${m.inventory?.unit || ''}`,
            `${m.current_stock} ${m.inventory?.unit || ''}`,
            m.notes || '-'
        ])
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <History className="h-6 w-6 text-indigo-600" /> Stok Hareketleri
                </h2>
                <div className="flex gap-2">
                    <button onClick={fetchMovements} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                        <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <ExportButtons onExcel={handleExcel} onPDF={handlePDF} onPrint={handlePrintList} />
                </div>
            </div>

            {/* Standardized Filter Bar */}
            <div className="bg-white p-4 rounded-xl shadow border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
                    {/* Search */}
                    <div className="md:col-span-1">
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Arama</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Sonuçlarda ara..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full pl-9 bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Product Filter */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Ürün</label>
                        <select
                            value={filter.itemId}
                            onChange={e => setFilter({ ...filter, itemId: e.target.value })}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                        >
                            <option value="">Tümü</option>
                            {inventory.map(i => (
                                <option key={i.id} value={i.id}>{i.product_code || i.id} - {i.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Type Filter */}
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">İşlem Tipi</label>
                        <select
                            value={filter.reason}
                            onChange={e => setFilter({ ...filter, reason: e.target.value })}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                        >
                            <option value="">Tümü</option>
                            <option value="Purchase">Satınalma</option>
                            <option value="Production_Usage">Üretim (Kullanım)</option>
                            <option value="Production_Output">Üretim (Çıktı)</option>
                            <option value="Sale">Satış</option>
                        </select>
                    </div>

                    {/* Date Range */}
                    <div className="flex gap-2 md:col-span-1">
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Başlangıç</label>
                            <input
                                type="date"
                                value={filter.startDate}
                                onChange={e => setFilter({ ...filter, startDate: e.target.value })}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Bitiş</label>
                            <input
                                type="date"
                                value={filter.endDate}
                                onChange={e => setFilter({ ...filter, endDate: e.target.value })}
                                className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                            />
                        </div>
                    </div>

                    {/* Apply Button */}
                    <div>
                        <button
                            onClick={fetchMovements}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                            Filtrele
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-3 text-left">Tarih</th>
                                <th className="px-6 py-3 text-left">Ürün</th>
                                <th className="px-6 py-3 text-left">İşlem</th>
                                <th className="px-6 py-3 text-right">Miktar</th>
                                <th className="px-6 py-3 text-right">Bakiye</th>
                                <th className="px-6 py-3 text-left">Notlar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {displayedMovements.map(m => (
                                <tr key={m.id} className="hover:bg-slate-50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-slate-600">
                                        {new Date(m.created_at).toLocaleString('tr-TR')}
                                    </td>
                                    <td className="px-6 py-4 font-medium text-slate-800">
                                        <span className="text-xs text-slate-400 font-mono mr-2">{m.inventory?.product_code || m.inventory?.id}</span>
                                        {m.inventory?.name || '-'}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${Number(m.amount || m.change_amount) > 0
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-red-100 text-red-700'
                                            }`}>
                                            {m.reason}
                                        </span>
                                    </td>
                                    <td className={`px-6 py-4 text-right font-bold ${Number(m.amount || m.change_amount) > 0 ? 'text-green-600' : 'text-red-600'
                                        }`}>
                                        {Number(m.amount || m.change_amount) > 0 ? '+' : ''}{Number(m.amount || m.change_amount).toFixed(2)} {m.inventory?.unit}
                                    </td>
                                    <td className="px-6 py-4 text-right text-slate-600 font-medium">
                                        {Number(m.current_stock).toFixed(2)} {m.inventory?.unit}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-500 truncate max-w-xs">
                                        {m.notes}
                                    </td>
                                </tr>
                            ))}
                            {displayedMovements.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="px-6 py-8 text-center text-slate-400">
                                        {(searchTerm || filter.itemId || filter.reason || filter.startDate) ? 'Kriterlere uygun hareket bulunamadı.' : 'Hareket bulunamadı.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
