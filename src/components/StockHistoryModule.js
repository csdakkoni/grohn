import React, { useState, useEffect } from 'react';
import { History, Filter, ArrowUpRight, ArrowDownLeft, RefreshCw, Search, Trash2 } from 'lucide-react';
import { supabase } from '../supabaseClient';

import ExportButtons from './ExportButtons';
import { exportToExcel, exportToPDF, handlePrint } from '../utils/exportUtils';

export default function StockHistoryModule({ inventory, accounts = [], onDeleteMovement, isIntegrated = false }) {
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

    const getAccountName = (id) => {
        if (!id) return '-';
        const account = accounts.find(a => String(a.id) === String(id));
        return account ? account.name : '-';
    };

    const getExportData = () => displayedMovements.map(m => ({
        'Tarih': new Date(m.created_at).toLocaleString('tr-TR'),
        'Ürün': `${m.inventory?.product_code || m.inventory?.id || ''} - ${m.inventory?.name || '-'}`,
        'İlgili Cari': m.supplier_id ? getAccountName(m.supplier_id) : (m.customer_id ? getAccountName(m.customer_id) : '-'),
        'İşlem': m.reason,
        'Miktar': m.amount || m.change_amount,
        'Birim': m.inventory?.unit || '-',
        'Birim Fiyat': m.price ? `${m.price} ${m.currency || ''}` : '-',
        'Toplam': m.total_amount ? `${m.total_amount} ${m.currency || ''}` : '-',
        'Stok Bakiyesi': m.current_stock,
        'LOT NO': m.lot_no || '-',
        'Notlar': m.notes || '-'
    }));

    const handleExcel = () => exportToExcel(getExportData(), 'stok_hareketleri');

    const handlePDF = () => exportToPDF(
        'Stok Hareketleri',
        ['Tarih', 'Ürün', 'İşlem', 'İlgili Cari', 'Miktar', 'LOT NO', 'Bakiye'],
        displayedMovements.map(m => [
            new Date(m.created_at).toLocaleString('tr-TR'),
            `${m.inventory?.product_code || m.inventory?.id || ''} - ${m.inventory?.name || '-'}`,
            m.reason,
            m.supplier_id ? getAccountName(m.supplier_id) : (m.customer_id ? getAccountName(m.customer_id) : '-'),
            `${m.amount || m.change_amount} ${m.inventory?.unit || ''}`,
            m.lot_no || '-',
            `${m.current_stock} ${m.inventory?.unit || ''}`
        ]),
        'stok_hareketleri'
    );

    const handlePrintList = () => handlePrint(
        'Stok Hareketleri',
        ['Tarih', 'Ürün', 'İşlem', 'Cari', 'Miktar', 'Birim Fiyat', 'Bakiye'],
        displayedMovements.map(m => [
            new Date(m.created_at).toLocaleString('tr-TR'),
            m.inventory?.name || '-',
            m.reason,
            m.reason === 'Purchase' ? getAccountName(m.supplier_id) : (m.reason === 'Sale' ? getAccountName(m.customer_id) : '-'),
            `${m.amount || m.change_amount} ${m.inventory?.unit || ''}`,
            m.price ? `${m.price} ${m.currency}` : '-',
            `${m.current_stock} ${m.inventory?.unit || ''}`
        ])
    );

    return (
        <div className="space-y-6">
            {!isIntegrated && (
                <div className="flex justify-between items-center">
                    <h2 className="heading-industrial text-2xl flex items-center gap-2">
                        <History className="h-7 w-7 text-indigo-600" />
                        STOK HAREKETLERİ
                    </h2>
                    <div className="flex gap-2">
                        <button onClick={fetchMovements} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                            <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                        <ExportButtons onExcel={handleExcel} onPDF={handlePDF} onPrint={handlePrintList} />
                    </div>
                </div>
            )}

            {isIntegrated && (
                <div className="flex justify-end items-center gap-2">
                    <button onClick={fetchMovements} className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg">
                        <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <ExportButtons onExcel={handleExcel} onPDF={handlePDF} onPrint={handlePrintList} />
                </div>
            )}

            {/* Standardized Filter Bar */}
            <div className="card-industrial p-4">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                    {/* Search */}
                    <div className="md:col-span-1">
                        <label className="label-industrial block">Arama</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Sonuçlarda ara..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="input-industrial pl-9"
                            />
                        </div>
                    </div>

                    {/* Product Filter */}
                    <div className="md:col-span-1">
                        <label className="label-industrial block">Ürün</label>
                        <select
                            value={filter.itemId}
                            onChange={e => setFilter({ ...filter, itemId: e.target.value })}
                            className="select-industrial"
                        >
                            <option value="">Tümü</option>
                            {inventory.map(i => (
                                <option key={i.id} value={i.id}>{i.product_code || i.id} - {i.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Type Filter */}
                    <div className="md:col-span-1">
                        <label className="label-industrial block">İşlem Tipi</label>
                        <select
                            value={filter.reason}
                            onChange={e => setFilter({ ...filter, reason: e.target.value })}
                            className="select-industrial"
                        >
                            <option value="">Tümü</option>
                            <option value="Purchase">Satınalma</option>
                            <option value="Production_Usage">Üretim (Hammadde Kullanımı)</option>
                            <option value="Production_Output">Üretim (Mamul Girişi)</option>
                            <option value="Production_Packaging">Üretim (Ambalaj/IBC Kullanımı)</option>
                            <option value="Sale">Satış</option>
                            <option value="Adjustment">Sayım Farkı</option>
                            <option value="Adjustment_Usage">Revizyon/Ek İlave</option>
                        </select>
                    </div>

                    {/* Date Range - Spanning 2 columns for 2 inputs */}
                    <div className="flex gap-2 md:col-span-2">
                        <div className="flex-1">
                            <label className="label-industrial block">Başlangıç</label>
                            <input
                                type="date"
                                value={filter.startDate}
                                onChange={e => setFilter({ ...filter, startDate: e.target.value })}
                                className="input-industrial"
                            />
                        </div>
                        <div className="flex-1">
                            <label className="label-industrial block">Bitiş</label>
                            <input
                                type="date"
                                value={filter.endDate}
                                onChange={e => setFilter({ ...filter, endDate: e.target.value })}
                                className="input-industrial"
                            />
                        </div>
                    </div>

                    {/* Apply Button */}
                    <div className="md:col-span-1">
                        <button
                            onClick={fetchMovements}
                            className="btn-primary w-full"
                        >
                            Filtrele
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="rounded-[6px] border border-[#d2d2d7] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="table-industrial">
                        <thead>
                            <tr>
                                <th className="text-left py-3 px-4">Tarih</th>
                                <th className="text-left py-3 px-4">İlgili Cari</th>
                                <th className="text-left py-3 px-4">Ürün</th>
                                <th className="text-left py-3 px-4">LOT NO</th>
                                <th className="text-right py-3 px-4">Miktar</th>
                                <th className="text-right py-3 px-4">Birim Fiyat</th>
                                <th className="text-right py-3 px-4">Tutar</th>
                                <th className="text-right py-3 px-4">Bakiye</th>
                                <th className="text-left py-3 px-4 text-center">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#d2d2d7]">
                            {displayedMovements.map(m => (
                                <tr key={m.id} className="hover:bg-[#f5f5f7] transition-colors">
                                    <td className="px-4 py-3 text-[#1d1d1f] text-xs font-mono">
                                        {new Date(m.created_at).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                    </td>
                                    <td className="px-4 py-3 text-[#1d1d1f] text-sm">
                                        {m.supplier_id ? (
                                            <span className="flex items-center gap-1 text-blue-700 font-medium">
                                                <ArrowUpRight className="h-3 w-3" /> {getAccountName(m.supplier_id)}
                                            </span>
                                        ) : m.customer_id ? (
                                            <span className="flex items-center gap-1 text-green-700 font-medium">
                                                <ArrowDownLeft className="h-3 w-3" /> {getAccountName(m.customer_id)}
                                            </span>
                                        ) : '-'}
                                    </td>
                                    <td className="px-4 py-3 font-medium text-[#1d1d1f] text-sm">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-[#86868b] font-mono leading-none mb-1">{m.inventory?.product_code || m.inventory?.id}</span>
                                            <span>{m.inventory?.name || '-'}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-xs font-mono text-[#86868b]">
                                        {m.lot_no || '-'}
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold text-sm font-mono ${Number(m.amount || m.change_amount) > 0 ? 'text-[#107c10]' : 'text-[#d21e1e]'
                                        }`}>
                                        {Number(m.amount || m.change_amount) > 0 ? '+' : ''}{Number(m.amount || m.change_amount).toFixed(2)} {m.inventory?.unit}
                                    </td>
                                    <td className="px-4 py-3 text-right text-xs font-mono text-gray-500">
                                        {m.price ? `${Number(m.price).toFixed(2)} ${m.currency}` : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right text-sm font-mono font-bold text-slate-800">
                                        {m.total_amount ? `${Number(m.total_amount).toFixed(2)} ${m.currency}` : '-'}
                                    </td>
                                    <td className="px-4 py-3 text-right text-[#1d1d1f] font-mono font-medium text-sm">
                                        {Number(m.current_stock).toFixed(2)} {m.inventory?.unit}
                                    </td>
                                    <td className="px-4 py-3 text-center">
                                        <div className="flex items-center justify-center gap-2">
                                            <span className={`badge-industrial text-[10px] ${Number(m.amount || m.change_amount) > 0 ? 'badge-industrial-green' : 'badge-industrial-red'
                                                }`}>
                                                {m.reason === 'Production_Packaging' ? 'PAKETLEME' :
                                                    m.reason === 'Production_Usage' ? 'SARFİYAT' :
                                                        m.reason === 'Production_Output' ? 'ÜRETİM' :
                                                            m.reason === 'Production_Plan' ? 'PLAN' :
                                                                m.reason === 'Purchase' ? 'ALIM' :
                                                                    m.reason === 'Sale' ? 'SATIŞ' :
                                                                        m.reason === 'Adjustment_Usage' ? 'REVİZYON' : m.reason?.toUpperCase()}
                                            </span>
                                            {onDeleteMovement && (
                                                <button
                                                    onClick={() => onDeleteMovement(m.id)}
                                                    className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                                                    title="Kaydı Sil"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {displayedMovements.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="px-4 py-8 text-center text-[#86868b]">
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
