import React, { useState } from 'react';
import { ShoppingCart, Plus, Search, Calendar, User, Package, DollarSign, Filter, FileText, Trash2, CheckCircle, X } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { preparePDFWithFont } from '../utils/exportUtils';

export default function SalesModule({ sales = [], inventory = [], accounts = [], productions = [], onSale }) {
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        customerId: '',
        productionId: '',
        quantity: '',
        unitPrice: '',
        currency: 'USD',
        paymentTerm: 30,
        saleDate: new Date().toISOString().split('T')[0],
        notes: ''
    });

    const [filters, setFilters] = useState({
        search: '',
        customer: '',
        dateStart: '',
        dateEnd: ''
    });

    // Helper to get product details from production ID
    const getProductionDetails = (prodId) => {
        const prod = productions.find(p => p.id === parseInt(prodId));
        if (!prod) return null;
        return prod;
    };

    const customers = accounts.filter(a => a.type === 'Müşteri' || a.type === 'Her İkisi');

    // Filter productions that have remaining stock (simplified: just list all approved productions for now)
    const availableProductions = productions;

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            await onSale(formData);
            setShowForm(false);
            setFormData({
                customerId: '',
                productionId: '',
                quantity: '',
                unitPrice: '',
                currency: 'USD',
                paymentTerm: 30,
                saleDate: new Date().toISOString().split('T')[0],
                notes: ''
            });
        } catch (error) {
            console.error(error);
        }
    };

    // Filter Sales
    const filteredSales = sales.filter(s => {
        const searchMatch = !filters.search ||
            (s.customer_name && s.customer_name.toLowerCase().includes(filters.search.toLowerCase())) ||
            (s.product_name && s.product_name.toLowerCase().includes(filters.search.toLowerCase())) ||
            (s.lot_no && s.lot_no.toLowerCase().includes(filters.search.toLowerCase()));

        const customerMatch = !filters.customer || s.customer_name === filters.customer; // Ideally ID, but sales view gives name usually. Let's check matching.
        // Actually, passed 'sales' usually comes from a view or join. 
        // If we want exact match, we might need ID. Let's assume customer_name matches the dropdown value (name) or we filter by string.
        // Better: Dropdown value is Name if ID is not available in 'sales' object easily displayed.
        // Looking at App.js fetch, sales comes from `sales_view` or similar. Let's check if we can match by name for now as it's safer without ID in view.

        const dateMatch = (!filters.dateStart || s.sale_date >= filters.dateStart) &&
            (!filters.dateEnd || s.sale_date <= filters.dateEnd);

        // If s.customer_name is used in dropdown value
        const dropdownCustomerMatch = !filters.customer || s.customer_name === customers.find(c => c.id === parseInt(filters.customer))?.name;

        return searchMatch && dateMatch && dropdownCustomerMatch;
    });

    return (
        <div className="space-y-6 animate-fade-in text-slate-800">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                    <ShoppingCart className="h-6 w-6 text-green-600" /> Satış Yönetimi
                </h2>
                <button
                    onClick={() => setShowForm(true)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                    <Plus className="h-5 w-5" /> Yeni Satış Yap
                </button>
            </div>

            {/* FILTER BAR */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-1">
                    <label className="text-xs font-bold text-slate-500 uppercase">Arama</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            placeholder="Müşteri, Ürün veya LOT..."
                            className="pl-9 w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-green-500"
                            value={filters.search}
                            onChange={e => setFilters({ ...filters, search: e.target.value })}
                        />
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-500 uppercase">Müşteri</label>
                    <select
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-green-500"
                        value={filters.customer}
                        onChange={e => setFilters({ ...filters, customer: e.target.value })}
                    >
                        <option value="">Tümü</option>
                        {customers.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                        ))}
                    </select>
                </div>

                <div className="flex gap-2 md:col-span-2">
                    <div className="flex-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Başlangıç</label>
                        <input
                            type="date"
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-green-500 text-sm"
                            value={filters.dateStart}
                            onChange={e => setFilters({ ...filters, dateStart: e.target.value })}
                        />
                    </div>
                    <div className="flex-1">
                        <label className="text-xs font-bold text-slate-500 uppercase">Bitiş</label>
                        <input
                            type="date"
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-green-500 text-sm"
                            value={filters.dateEnd}
                            onChange={e => setFilters({ ...filters, dateEnd: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            {/* FORM MODAL */}
            {showForm && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 animate-fade-in">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
                        <div className="bg-slate-50 p-4 border-b flex justify-between items-center">
                            <h3 className="font-bold text-slate-800 flex items-center gap-2">
                                <Plus className="h-5 w-5 text-green-600" /> Yeni Satış Kaydı
                            </h3>
                            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-slate-700 mb-1">Müşteri</label>
                                <select
                                    required
                                    className="w-full p-2 border-2 border-slate-200 rounded-lg focus:border-green-500 outline-none"
                                    value={formData.customerId}
                                    onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                                >
                                    <option value="">Seçiniz...</option>
                                    {customers.map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-slate-700 mb-1">Satılacak Ürün / Parti (LOT)</label>
                                <select
                                    required
                                    className="w-full p-2 border-2 border-slate-200 rounded-lg focus:border-green-500 outline-none font-mono text-sm"
                                    value={formData.productionId}
                                    onChange={e => setFormData({ ...formData, productionId: e.target.value })}
                                >
                                    <option value="">Seçiniz...</option>
                                    {availableProductions.map(p => {
                                        // Calculate Real Stock from Inventory Lots
                                        let currentStock = 0;
                                        inventory.forEach(item => {
                                            if (item.lots) {
                                                // Sum all lots with this lot number (in case of splits, though usually one)
                                                const lotQty = item.lots
                                                    .filter(l => l.lot_no === p.lot_number)
                                                    .reduce((sum, l) => sum + (parseFloat(l.qty) || 0), 0);
                                                currentStock += lotQty;
                                            }
                                        });

                                        if (currentStock <= 0.01) return null; // Don't show out-of-stock items

                                        return (
                                            <option key={p.id} value={p.id}>
                                                {p.product_name || 'Ürün'} - LOT: {p.lot_number} (Mevcut: {currentStock} kg)
                                            </option>
                                        );
                                    })}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Satış Miktarı</label>
                                <input
                                    required
                                    type="number"
                                    step="0.01"
                                    className="w-full p-2 border-2 border-slate-200 rounded-lg focus:border-green-500 outline-none"
                                    value={formData.quantity}
                                    onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Birim Fiyat</label>
                                <div className="flex gap-2">
                                    <input
                                        required
                                        type="number"
                                        step="0.01"
                                        className="w-full p-2 border-2 border-slate-200 rounded-lg focus:border-green-500 outline-none"
                                        value={formData.unitPrice}
                                        onChange={e => setFormData({ ...formData, unitPrice: e.target.value })}
                                    />
                                    <select
                                        className="w-24 p-2 border-2 border-slate-200 rounded-lg focus:border-green-500 outline-none bg-slate-50"
                                        value={formData.currency}
                                        onChange={e => setFormData({ ...formData, currency: e.target.value })}
                                    >
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="TRY">TRY</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Vade (Gün)</label>
                                <input
                                    type="number"
                                    className="w-full p-2 border-2 border-slate-200 rounded-lg focus:border-green-500 outline-none"
                                    value={formData.paymentTerm}
                                    onChange={e => setFormData({ ...formData, paymentTerm: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Satış Tarihi</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full p-2 border-2 border-slate-200 rounded-lg focus:border-green-500 outline-none"
                                    value={formData.saleDate}
                                    onChange={e => setFormData({ ...formData, saleDate: e.target.value })}
                                />
                            </div>

                            <div className="md:col-span-2">
                                <label className="block text-sm font-bold text-slate-700 mb-1">Notlar</label>
                                <textarea
                                    className="w-full p-2 border-2 border-slate-200 rounded-lg focus:border-green-500 outline-none"
                                    rows="2"
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                />
                            </div>

                            <div className="md:col-span-2 border-t pt-4 flex justify-end gap-2 mt-2">
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="px-6 py-2 rounded-lg text-slate-600 hover:bg-slate-100 font-medium transition-colors"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="px-8 py-2 rounded-lg bg-green-600 text-white hover:bg-green-700 font-bold shadow-lg transition-transform active:scale-95 flex items-center gap-2"
                                >
                                    <CheckCircle size={18} /> Satışı Tamamla
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* LIST */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden min-h-[400px]">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-slate-100 text-slate-600 font-bold uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">Tarih</th>
                                <th className="px-6 py-4">Müşteri</th>
                                <th className="px-6 py-4">Ürün / LOT</th>
                                <th className="px-6 py-4 text-right">Miktar</th>
                                <th className="px-6 py-4 text-right">Birim Fiyat</th>
                                <th className="px-6 py-4 text-right">Toplam Tutar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredSales.length === 0 ? (
                                <tr><td colSpan="6" className="text-center py-8 text-slate-400">Kriterlere uygun kayıt bulunamadı.</td></tr>
                            ) : (
                                filteredSales.map(sale => (
                                    <tr key={sale.id} className="hover:bg-green-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-slate-500">
                                            {new Date(sale.sale_date || sale.created_at).toLocaleDateString('tr-TR')}
                                        </td>
                                        <td className="px-6 py-4 font-bold text-slate-700">
                                            {accounts.find(a => a.id === sale.customer_id)?.name || '-'}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-slate-800">{sale.product_name}</div>
                                            <div className="text-xs text-slate-500 font-mono">LOT: {sale.lot_number || sale.lot_no || '-'}</div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-slate-600">
                                            {sale.quantity}
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-slate-600">
                                            {sale.unit_price} {sale.currency}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-green-600 font-mono">
                                            {sale.total_amount?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {sale.currency}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
