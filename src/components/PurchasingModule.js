import React, { useState } from 'react';
import { Trash2, Plus, ShoppingBag, Package, Filter, Search } from 'lucide-react';
import ExportButtons from './ExportButtons';
import { exportToExcel, exportToPDF, handlePrint } from '../utils/exportUtils';

export default function PurchasingModule({ purchases, inventory, suppliers, onPurchase, onDelete }) {
    const [showForm, setShowForm] = useState(false);
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
        onPurchase(formData).then(success => {
            if (success) {
                setShowForm(false);
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
                    isInfinite: false
                });
            }
        });
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
        'Ürün': p.item_name,
        'Miktar': p.qty,
        'Fiyat': `${p.price} ${p.currency}`,
        'Toplam': `${p.total} ${p.currency}`
    }));

    const handleExcel = () => exportToExcel(getExportData(), 'satinalma_listesi');

    const handlePDF = () => exportToPDF(
        'Satınalma Listesi',
        ['Tarih', 'Tedarikçi', 'Ürün', 'Miktar', 'Fiyat', 'Toplam'],
        filteredPurchases.map(p => [
            new Date(p.created_at).toLocaleDateString('tr-TR'),
            suppliers.find(s => s.id === p.supplier_id)?.name || '-',
            p.item_name,
            p.qty,
            `${p.price} ${p.currency}`,
            `${p.total} ${p.currency}`
        ]),
        'satinalma_listesi'
    );

    const handlePrintList = () => handlePrint(
        'Satınalma Listesi',
        ['Tarih', 'Tedarikçi', 'Ürün', 'Miktar', 'Fiyat', 'Toplam'],
        filteredPurchases.map(p => [
            new Date(p.created_at).toLocaleDateString('tr-TR'),
            suppliers.find(s => s.id === p.supplier_id)?.name || '-',
            p.item_name,
            p.qty,
            `${p.price} ${p.currency}`,
            `${p.total} ${p.currency}`
        ])
    );

    const [selectedPurchase, setSelectedPurchase] = useState(null);

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <ShoppingBag className="h-6 w-6 text-indigo-600" /> Satınalma
                </h2>
                <div className="flex gap-2">
                    <ExportButtons onExcel={handleExcel} onPDF={handlePDF} onPrint={handlePrintList} />
                    <button
                        onClick={() => setShowForm(true)}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Plus className="h-4 w-4" /> Yeni Alım
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
                    <h3 className="text-lg font-bold mb-4 text-slate-700">Yeni Alım Kaydı</h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="md:col-span-1">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tedarikçi</label>
                            <select
                                required
                                value={formData.supplierId}
                                onChange={e => setFormData({ ...formData, supplierId: e.target.value })}
                                className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                            >
                                <option value="">Seçiniz...</option>
                                {suppliers.filter(s => s.type !== 'Müşteri').map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="md:col-span-2 flex gap-4 items-end">
                            <div className="flex-1">
                                <div className="flex gap-4 mb-2">
                                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                                        <input
                                            type="checkbox"
                                            checked={formData.isNewItem}
                                            onChange={e => setFormData({ ...formData, isNewItem: e.target.checked, newItemUnit: 'kg', isInfinite: false })}
                                            className="rounded text-indigo-600"
                                        />
                                        Yeni Stok Kartı Oluştur
                                    </label>

                                    {formData.isNewItem && (
                                        <label className="flex items-center gap-2 text-sm font-medium text-purple-700 bg-purple-50 px-2 rounded border border-purple-200">
                                            <input
                                                type="checkbox"
                                                checked={formData.isInfinite}
                                                onChange={e => setFormData({ ...formData, isInfinite: e.target.checked })}
                                                className="rounded text-purple-600"
                                            />
                                            Sonsuz Kaynak (Su vb.)
                                        </label>
                                    )}
                                </div>

                                {formData.isNewItem ? (
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            required
                                            placeholder="Stok Adı (Örn: Su)"
                                            value={formData.newItemName}
                                            onChange={e => setFormData({ ...formData, newItemName: e.target.value })}
                                            className="border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                        />
                                        <select
                                            value={formData.newItemType}
                                            onChange={e => setFormData({ ...formData, newItemType: e.target.value })}
                                            disabled={formData.isInfinite}
                                            className="border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                        >
                                            <option value="Hammadde">Hammadde</option>
                                            <option value="Ambalaj">Ambalaj</option>
                                        </select>
                                    </div>
                                ) : (
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
                                        className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                    >
                                        <option value="">Stok Seçiniz...</option>
                                        {inventory.map(i => (
                                            <option key={i.id} value={i.id}>{i.product_code || i.id} - {i.name} ({i.type})</option>
                                        ))}
                                    </select>
                                )}
                            </div>
                        </div>

                        {!formData.isInfinite && formData.isNewItem && formData.newItemType === 'Ambalaj' && (
                            <div className="md:col-span-3 grid grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg">
                                {/* Packaging specific fields - keep as is */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Kapasite</label>
                                    <input type="number" value={formData.capacityValue} onChange={e => setFormData({ ...formData, capacityValue: e.target.value })} className="w-full border-2 border-slate-200 rounded-lg p-2" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Birim</label>
                                    <select value={formData.capacityUnit} onChange={e => setFormData({ ...formData, capacityUnit: e.target.value })} className="w-full border-2 border-slate-200 rounded-lg p-2">
                                        <option value="L">Litre (L)</option>
                                        <option value="kg">Kilogram (kg)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Dara (kg)</label>
                                    <input type="number" value={formData.tareWeight} onChange={e => setFormData({ ...formData, tareWeight: e.target.value })} className="w-full border-2 border-slate-200 rounded-lg p-2" />
                                </div>
                            </div>
                        )}

                        {!formData.isInfinite && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Miktar</label>
                                    <div className="flex gap-2">
                                        <input required={!formData.isInfinite} type="number" step="0.01" value={formData.qty} onChange={e => setFormData({ ...formData, qty: e.target.value })} className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none" />
                                        <select value={formData.isNewItem ? formData.newItemUnit : formData.purchaseUnit} onChange={e => setFormData({ ...formData, [formData.isNewItem ? 'newItemUnit' : 'purchaseUnit']: e.target.value })} disabled={!formData.isNewItem} className={`border-2 border-slate-200 rounded-lg p-2 bg-slate-50 ${!formData.isNewItem ? 'opacity-70 cursor-not-allowed' : ''}`}>
                                            <option value="kg">kg</option>
                                            <option value="L">Litre (L)</option>
                                            <option value="adet">Adet</option>
                                            <option value="gr">Gram (gr)</option>
                                            <option value="ton">Ton</option>
                                            <option value="koli">Koli</option>
                                            <option value="paket">Paket</option>
                                            <option value="m">Metre (m)</option>
                                        </select>
                                    </div>
                                </div>
                                {/* ... (Other fields preserved) ... */}
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Birim Fiyat</label>
                                    <div className="flex gap-2">
                                        <input required={!formData.isInfinite} type="number" step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none" />
                                        <select value={formData.currency} onChange={e => setFormData({ ...formData, currency: e.target.value })} className="border-2 border-slate-200 rounded-lg p-2 bg-slate-50">
                                            <option value="USD">USD</option>
                                            <option value="EUR">EUR</option>
                                            <option value="TRY">TRY</option>
                                        </select>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Vade (Gün)</label>
                                    <input type="number" value={formData.termDays} onChange={e => setFormData({ ...formData, termDays: e.target.value })} className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none" />
                                </div>
                                {formData.isNewItem && (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">LOT No (Opsiyonel)</label>
                                        <input type="text" value={formData.lotNo} onChange={e => setFormData({ ...formData, lotNo: e.target.value })} placeholder="Opsiyonel" className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none" />
                                    </div>
                                )}
                            </>
                        )}


                        <div className="md:col-span-3 flex justify-end gap-2 mt-4">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">İptal</button>
                            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium">{formData.isInfinite ? 'Tanımla' : 'Kaydet'}</button>
                        </div>
                    </form>
                </div>
            )}

            {/* STANDARDIZED FILTER BAR */}
            <div className="bg-white p-4 rounded-xl shadow border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Arama</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            value={filters.search}
                            onChange={e => setFilters({ ...filters, search: e.target.value })}
                            placeholder="Ürün, LOT veya Tedarikçi..."
                            className="w-full pl-9 bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                </div>
                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Tedarikçi</label>
                    <select
                        value={filters.supplierId}
                        onChange={e => setFilters({ ...filters, supplierId: e.target.value })}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    >
                        <option value="all">Tümü</option>
                        {suppliers.filter(s => s.type !== 'Müşteri').map(s => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                </div>
                <div className="flex gap-2 md:col-span-2">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Başlangıç Tarihi</label>
                        <input
                            type="date"
                            value={filters.startDate}
                            onChange={e => setFilters({ ...filters, startDate: e.target.value })}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Bitiş Tarihi</label>
                        <input
                            type="date"
                            value={filters.endDate}
                            onChange={e => setFilters({ ...filters, endDate: e.target.value })}
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-3 text-left">Tarih</th>
                                <th className="px-6 py-3 text-left">Tedarikçi</th>
                                <th className="px-6 py-3 text-left">Ürün</th>
                                <th className="px-6 py-3 text-right">Miktar</th>
                                <th className="px-6 py-3 text-right">Fiyat</th>
                                <th className="px-6 py-3 text-right">Toplam</th>
                                <th className="px-6 py-3 text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {filteredPurchases.map(p => {
                                const supplier = suppliers.find(s => s.id === p.supplier_id)?.name || '-';
                                return (
                                    <tr
                                        key={p.id}
                                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                                        onClick={() => setSelectedPurchase(p)}
                                    >
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            {new Date(p.created_at).toLocaleDateString('tr-TR')}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-800">{supplier}</td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            <div>{p.item_name}</div>
                                            <div className="text-xs text-slate-400">
                                                {inventory.find(i => i.name === p.item_name)?.product_code || '-'} | LOT: {p.lot_no}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-medium">
                                            {p.qty}
                                        </td>
                                        <td className="px-6 py-4 text-right text-sm text-slate-600">
                                            {p.price} {p.currency}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-indigo-600">
                                            {p.total} {p.currency}
                                        </td>
                                        <td className="px-6 py-4 text-right" onClick={e => e.stopPropagation()}>
                                            <button
                                                onClick={() => onDelete(p.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedPurchase(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                        <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                            <h3 className="text-xl font-bold text-slate-800">Alım Detayı</h3>
                            <button onClick={() => setSelectedPurchase(null)} className="text-slate-400 hover:text-slate-600">
                                <Trash2 className="h-6 w-6 rotate-45" />
                            </button>
                        </div>
                        {/* Detail content reused safely */}
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div><label className="text-xs font-bold text-slate-400 uppercase">Tarih</label><div className="text-slate-800">{new Date(selectedPurchase.created_at).toLocaleString('tr-TR')}</div></div>
                                <div><label className="text-xs font-bold text-slate-400 uppercase">LOT No</label><div className="text-slate-800 font-mono">{selectedPurchase.lot_no}</div></div>
                                <div><label className="text-xs font-bold text-slate-400 uppercase">Miktar</label><div className="text-slate-800 font-medium">{selectedPurchase.qty}</div></div>
                                <div><label className="text-xs font-bold text-slate-400 uppercase">Toplam Tutar</label><div className="text-indigo-600 font-bold text-lg">{selectedPurchase.total?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {selectedPurchase.currency}</div></div>
                            </div>
                            <hr className="border-slate-100" />
                            <div><h4 className="font-bold text-slate-700 mb-2 flex items-center gap-2"><Package className="h-4 w-4" /> Tedarikçi Bilgileri</h4>
                                {(() => {
                                    const sup = suppliers.find(s => s.id === selectedPurchase.supplier_id);
                                    return sup ? <div className="bg-slate-50 p-3 rounded-lg grid grid-cols-2 gap-2 text-sm"><div><span className="text-slate-500">Firma:</span> {sup.name}</div><div><span className="text-slate-500">İlgili:</span> {sup.contact}</div></div> : <div className="text-slate-400">Bulunamadı</div>;
                                })()}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
