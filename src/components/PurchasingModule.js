import React, { useState } from 'react';
import { Trash2, Plus, ShoppingBag, Package, Filter, Search, Briefcase, Pencil } from 'lucide-react';
import ExportButtons from './ExportButtons';
import { exportToExcel, exportToPDF, handlePrint } from '../utils/exportUtils';

export default function PurchasingModule({ purchases, inventory, suppliers, onPurchase, onDelete, onUpdate, isIntegrated = false }) {
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        supplierId: '',
        isNewItem: false,
        itemId: '',
        newItemName: '',
        newItemType: 'Hammadde',
        newItemUnit: 'kg',
        qty: '',
        price: '',
        currency: 'USD',
        termDays: 30,
        lotNo: '',
        capacityValue: '',
        capacityUnit: 'L',
        tareWeight: '',
        purchaseUnit: 'kg',
        isInfinite: false
    });

    const [filters, setFilters] = useState({
        search: '',
        supplierId: 'all',
        startDate: '',
        endDate: ''
    });

    const handleSubmit = (e) => {
        e.preventDefault();
        const action = editingId ? onUpdate(editingId, formData) : onPurchase(formData);

        action.then(success => {
            if (success) {
                setShowForm(false);
                setEditingId(null);
                setFormData({
                    supplierId: '',
                    isNewItem: false,
                    itemId: '',
                    newItemName: '',
                    newItemType: 'Hammadde',
                    newItemUnit: 'kg',
                    qty: '',
                    price: '',
                    currency: 'USD',
                    termDays: 30,
                    lotNo: '',
                    capacityValue: '',
                    capacityUnit: 'L',
                    tareWeight: '',
                    purchaseUnit: 'kg',
                    isInfinite: false
                });
            }
        });
    };

    const handleEdit = (p) => {
        setEditingId(p.id);
        const item = inventory.find(i => i.name === p.item_name);
        setFormData({
            supplierId: p.supplier_id,
            isNewItem: false,
            itemId: item?.id || '',
            newItemName: '',
            newItemType: p.item_type || item?.type || 'Hammadde',
            newItemUnit: p.unit || item?.unit || 'kg',
            qty: p.qty,
            price: p.price,
            currency: p.currency,
            termDays: p.payment_term || 30,
            lotNo: p.lot_no,
            capacityValue: '',
            capacityUnit: 'L',
            tareWeight: '',
            purchaseUnit: p.unit || 'kg',
            isInfinite: false
        });
        setShowForm(true);
    };

    const filteredPurchases = purchases.filter(p => {
        const supplierName = suppliers.find(s => s.id === p.supplier_id)?.name || '';
        const matchesSearch = !filters.search ||
            (p.item_name && p.item_name.toLowerCase().includes(filters.search.toLowerCase())) ||
            (p.lot_no && p.lot_no.toLowerCase().includes(filters.search.toLowerCase())) ||
            (supplierName && supplierName.toLowerCase().includes(filters.search.toLowerCase()));

        const matchesSupplier = filters.supplierId === 'all' || p.supplier_id.toString() === filters.supplierId;

        let matchesDate = true;
        if (filters.startDate) matchesDate = matchesDate && new Date(p.created_at) >= new Date(filters.startDate);
        if (filters.endDate) matchesDate = matchesDate && new Date(p.created_at) <= new Date(filters.endDate + 'T23:59:59');

        return matchesSearch && matchesSupplier && matchesDate;
    });

    const getExportData = () => filteredPurchases.map(p => ({
        'Tarih': new Date(p.created_at).toLocaleDateString('tr-TR'),
        'Tedarikçi': suppliers.find(s => s.id === p.supplier_id)?.name || '-',
        'Tip': p.item_type || '-',
        'Ürün': p.item_name,
        'LOT NO': p.lot_no || '-',
        'Miktar': p.qty,
        'Birim': p.unit || 'kg',
        'Fiyat': `${p.price} ${p.currency}`,
        'Toplam': `${p.total} ${p.currency}`
    }));

    const handleExcel = () => exportToExcel(getExportData(), 'satinalma_listesi');

    const handlePDF = () => exportToPDF(
        'Satınalma Listesi',
        ['Tarih', 'Tedarikçi', 'Tip', 'Ürün', 'LOT NO', 'Miktar', 'Birim', 'Fiyat', 'Toplam'],
        filteredPurchases.map(p => [
            new Date(p.created_at).toLocaleDateString('tr-TR'),
            suppliers.find(s => s.id === p.supplier_id)?.name || '-',
            p.item_type || '-',
            p.item_name,
            p.lot_no || '-',
            p.qty,
            p.unit || 'kg',
            `${p.price} ${p.currency}`,
            `${p.total} ${p.currency}`
        ]),
        'satinalma_listesi'
    );

    const handlePrintList = () => handlePrint(
        'Satınalma Listesi',
        ['Tarih', 'Tedarikçi', 'Tip', 'Ürün', 'LOT NO', 'Miktar', 'Birim', 'Fiyat', 'Toplam'],
        filteredPurchases.map(p => [
            new Date(p.created_at).toLocaleDateString('tr-TR'),
            suppliers.find(s => s.id === p.supplier_id)?.name || '-',
            p.item_type || '-',
            p.item_name,
            p.lot_no || '-',
            p.qty,
            p.unit || 'kg',
            `${p.price} ${p.currency}`,
            `${p.total} ${p.currency}`
        ])
    );

    const [selectedPurchase, setSelectedPurchase] = useState(null);

    return (
        <div className="space-y-6">
            {!isIntegrated && (
                <div className="flex justify-between items-center">
                    <h2 className="heading-industrial text-2xl flex items-center gap-2 text-slate-800">
                        <ShoppingBag className="h-6 w-6 text-[#0071e3]" /> Satınalma
                    </h2>
                    <div className="flex gap-2">
                        <ExportButtons onExcel={handleExcel} onPDF={handlePDF} onPrint={handlePrintList} />
                        <button
                            onClick={() => setShowForm(true)}
                            className="btn-primary flex items-center gap-2"
                        >
                            <Plus className="h-4 w-4" /> Yeni Alım
                        </button>
                    </div>
                </div>
            )}

            {isIntegrated && (
                <div className="flex justify-end items-center gap-2">
                    <ExportButtons onExcel={handleExcel} onPDF={handlePDF} onPrint={handlePrintList} />
                    <button
                        onClick={() => setShowForm(true)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" /> Yeni Alım
                    </button>
                </div>
            )}

            {/* NEW PURCHASE FORM MODAL */}
            {showForm && (
                <div className="modal-overlay-industrial flex items-center justify-center p-4">
                    <div className="modal-content-industrial w-full max-w-4xl">
                        <div className="modal-header-industrial">
                            <h3 className="text-sm font-bold text-[#1d1d1f] uppercase tracking-wide">
                                {editingId ? 'Alımı Düzenle' : 'Yeni Alım Girişi'}
                            </h3>
                            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="text-gray-400 hover:text-gray-600 transition-colors">×</button>
                        </div>
                        <form onSubmit={handleSubmit}>
                            <div className="modal-body-industrial max-h-[70vh] overflow-y-auto">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                    <div className="md:col-span-3 pb-3 border-b border-gray-100">
                                        <div className="flex gap-6">
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.isInfinite}
                                                    onChange={e => setFormData({ ...formData, isInfinite: e.target.checked })}
                                                    className="w-4 h-4 text-[#0071e3] rounded border-[#d2d2d7] focus:ring-[#0071e3]"
                                                />
                                                <span className="text-sm font-medium text-[#1d1d1f] group-hover:text-[#0071e3] transition-colors">Limitsiz Stok (Hizmet/Sarf)</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.isNewItem}
                                                    onChange={e => setFormData({ ...formData, isNewItem: e.target.checked })}
                                                    className="w-4 h-4 text-[#0071e3] rounded border-[#d2d2d7] focus:ring-[#0071e3]"
                                                />
                                                <span className="text-sm font-medium text-[#1d1d1f] group-hover:text-[#0071e3] transition-colors">Yeni Kart Tanımla</span>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Fields */}
                                    <div>
                                        <label className="label-industrial block">Tedarikçi</label>
                                        <select
                                            required
                                            value={formData.supplierId}
                                            onChange={e => setFormData({ ...formData, supplierId: e.target.value })}
                                            className="select-industrial"
                                        >
                                            <option value="">Seçiniz...</option>
                                            {suppliers.filter(s => s.type !== 'Müşteri').map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Logic for Item Selection / Creation */}
                                    <div className="md:col-span-2">
                                        {formData.isNewItem ? (
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="label-industrial block">Yeni Ürün Adı</label>
                                                    <input required value={formData.newItemName} onChange={e => setFormData({ ...formData, newItemName: e.target.value })} className="input-industrial" />
                                                </div>
                                                <div>
                                                    <label className="label-industrial block">Tip</label>
                                                    <select value={formData.newItemType} onChange={e => setFormData({ ...formData, newItemType: e.target.value })} className="select-industrial">
                                                        <option value="Hammadde">Hammadde</option>
                                                        <option value="Ambalaj">Ambalaj</option>
                                                        <option value="Mamul">Mamul</option>
                                                    </select>
                                                </div>
                                            </div>
                                        ) : (
                                            <div>
                                                <label className="label-industrial block">Stok Kartı</label>
                                                <select
                                                    required
                                                    value={formData.itemId}
                                                    onChange={e => {
                                                        const item = inventory.find(i => i.id === parseInt(e.target.value));
                                                        setFormData({
                                                            ...formData,
                                                            itemId: e.target.value,
                                                            purchaseUnit: item ? item.unit : 'kg'
                                                        });
                                                    }}
                                                    className="select-industrial"
                                                >
                                                    <option value="">Seçiniz...</option>
                                                    {inventory.map(i => (
                                                        <option key={i.id} value={i.id}>{i.product_code || i.id} - {i.name} ({i.type})</option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="label-industrial block">LOT NO</label>
                                        <input value={formData.lotNo} onChange={e => setFormData({ ...formData, lotNo: e.target.value })} className="input-industrial" placeholder="LOT No giriniz (Opsiyonel)..." />
                                    </div>
                                    <div>
                                        <label className="label-industrial block">Miktar</label>
                                        <div className="flex gap-2">
                                            <input required={!formData.isInfinite} type="number" step="0.01" value={formData.qty} onChange={e => setFormData({ ...formData, qty: e.target.value })} className="input-industrial" />
                                            <select value={formData.isNewItem ? formData.newItemUnit : formData.purchaseUnit} onChange={e => setFormData({ ...formData, [formData.isNewItem ? 'newItemUnit' : 'purchaseUnit']: e.target.value })} className="select-industrial w-24">
                                                <option value="kg">kg</option>
                                                <option value="L">L</option>
                                                <option value="adet">Adet</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label-industrial block">Birim Fiyat</label>
                                        <div className="flex gap-2">
                                            <input required={!formData.isInfinite} type="number" step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="input-industrial" />
                                            <select value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })} className="select-industrial w-24">
                                                <option value="USD">USD</option>
                                                <option value="EUR">EUR</option>
                                                <option value="TRY">TRY</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="label-industrial block">Vade (Gün)</label>
                                        <input type="number" value={formData.termDays} onChange={e => setFormData({ ...formData, termDays: e.target.value })} className="input-industrial" />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer-industrial">
                                <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="btn-secondary">İptal</button>
                                <button type="submit" className="btn-primary">
                                    {editingId ? 'Güncelle' : (formData.isInfinite ? 'Tanımla' : 'Kaydet')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* STANDARDIZED FILTER BAR */}
            <div className="card-industrial p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-1">
                    <label className="label-industrial block">Arama</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            value={filters.search}
                            onChange={e => setFilters({ ...filters, search: e.target.value })}
                            placeholder="Ürün, LOT veya Tedarikçi..."
                            className="input-industrial pl-9"
                        />
                    </div>
                </div>
                <div>
                    <label className="label-industrial block">Tedarikçi</label>
                    <select
                        value={filters.supplierId}
                        onChange={e => setFilters({ ...filters, supplierId: e.target.value })}
                        className="select-industrial"
                    >
                        <option value="all">Tümü</option>
                        {suppliers.filter(s => s.type !== 'Müşteri').map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex gap-2 md:col-span-2">
                    <div className="flex-1">
                        <label className="label-industrial block">Başlangıç Tarihi</label>
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                            className="input-industrial"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="label-industrial block">Bitiş Tarihi</label>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                            className="input-industrial"
                        />
                    </div>
                </div>
            </div>
            {/* Purchasing Table */}
            <div className="card-industrial overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table-industrial">
                        <thead>
                            <tr>
                                <th className="text-left">Tarih</th>
                                <th className="text-left">Tedarikçi</th>
                                <th className="text-left">Tip</th>
                                <th className="text-left">Ürün</th>
                                <th className="text-left">LOT NO</th>
                                <th className="text-right">Miktar</th>
                                <th className="text-left">Birim</th>
                                <th className="text-right">Birim Fiyat</th>
                                <th className="text-right">Tutar</th>
                                <th className="text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredPurchases.map(p => {
                                const supplier = suppliers.find(s => s.id === p.supplier_id);
                                // Fallback: search in inventory if p.item_type is missing
                                const derivedItemType = p.item_type || inventory.find(i => i.name === p.item_name)?.type;
                                return (
                                    <tr key={p.id} className="hover:bg-slate-50 border-b border-slate-100 transition-colors">
                                        <td className="text-gray-600 font-mono text-[11px] py-4">
                                            {new Date(p.created_at).toLocaleDateString('tr-TR')}
                                        </td>
                                        <td>
                                            <div className="font-medium text-[#1d1d1f]">{supplier?.name || 'Bilinmeyen'}</div>
                                        </td>
                                        <td>
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium ${derivedItemType === 'Hammadde' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                                                derivedItemType === 'Ambalaj' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                                                    'bg-purple-50 text-purple-700 border border-purple-100'
                                                }`}>
                                                {derivedItemType || '-'}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="font-medium text-gray-700">{p.item_name || 'Ürün'}</div>
                                        </td>
                                        <td>
                                            {p.lot_no ? (
                                                <span className="font-mono text-[11px] text-gray-600 bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
                                                    {p.lot_no}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="text-right font-mono text-gray-700">
                                            {p.qty}
                                        </td>
                                        <td className="font-medium text-gray-500">
                                            {p.unit || 'kg'}
                                        </td>
                                        <td className="text-right font-mono text-gray-600">
                                            {p.price} {p.currency}
                                        </td>
                                        <td className="text-right font-mono font-bold text-[#1d1d1f]">
                                            {p.total} {p.currency}
                                        </td>
                                        <td className="text-right flex justify-end gap-1" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => handleEdit(p)}
                                                className="p-1.5 text-gray-400 hover:text-[#0071e3] transition-colors"
                                                title="Düzenle"
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => onDelete(p.id)}
                                                className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"
                                                title="Sil"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredPurchases.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="px-6 py-8 text-center text-slate-400">
                                        Kriterlere uygun kayıt bulunamadı.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* PURCHASE DETAIL MODAL */}
            {selectedPurchase && (
                <div className="modal-overlay-industrial flex items-center justify-center p-4" onClick={() => setSelectedPurchase(null)}>
                    <div className="modal-content-industrial w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                        <div className="modal-header-industrial">
                            <h3 className="text-sm font-bold text-[#1d1d1f] uppercase tracking-wide">Alım Detayı</h3>
                            <button onClick={() => setSelectedPurchase(null)} className="text-gray-400 hover:text-gray-600 transition-colors">×</button>
                        </div>
                        {/* Detail content reused safely */}
                        <div className="modal-body-industrial space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="label-industrial block">Tarih</label><div className="text-[#1d1d1f] font-mono text-sm">{new Date(selectedPurchase.created_at).toLocaleString('tr-TR')}</div></div>
                                <div><label className="label-industrial block">LOT No</label><div className="text-[#1d1d1f] font-mono text-sm font-bold">{selectedPurchase.lot_no}</div></div>
                                <div><label className="label-industrial block">Miktar</label><div className="text-[#1d1d1f] text-sm font-medium">{selectedPurchase.qty} {selectedPurchase.unit}</div></div>
                                <div><label className="label-industrial block">Toplam Tutar</label><div className="text-[#0071e3] font-bold text-lg">{selectedPurchase.total?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {selectedPurchase.currency}</div></div>
                            </div>
                            <hr className="border-gray-100" />
                            <div><h4 className="heading-industrial text-xs mb-3 flex items-center gap-2"><Package className="h-4 w-4" /> Tedarikçi Bilgileri</h4>
                                {(() => {
                                    const sup = suppliers.find(s => s.id === selectedPurchase.supplier_id);
                                    return sup ? <div className="bg-[#f5f5f7] p-3 rounded-[4px] border border-[#d2d2d7] grid grid-cols-2 gap-2 text-sm"><div><span className="text-[#86868b] text-[10px] font-bold uppercase block">Firma</span> {sup.name}</div><div><span className="text-[#86868b] text-[10px] font-bold uppercase block">İlgili</span> {sup.contact}</div></div> : <div className="text-[#86868b] italic text-xs">Bulunamadı</div>;
                                })()}
                            </div>
                        </div>
                        <div className="modal-footer-industrial">
                            <button onClick={() => setSelectedPurchase(null)} className="btn-secondary">Kapat</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
