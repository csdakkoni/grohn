import React, { useState } from 'react';
import { Trash2, Plus, Edit, Filter, Phone, User, Building, Search } from 'lucide-react';
import ExportButtons from './ExportButtons';
import { exportToExcel, exportToPDF, handlePrint } from '../utils/exportUtils';

export default function CurrentAccountsModule({ accounts, sales = [], purchases = [], onAdd, onDelete }) {
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        type: 'Müşteri',
        contact: '',
        phone: ''
    });
    const [editingId, setEditingId] = useState(null);
    const [filters, setFilters] = useState({
        search: '',
        type: 'all'
    });

    const filteredAccounts = accounts.filter(a => {
        const matchesSearch = !filters.search ||
            (a.name && a.name.toLowerCase().includes(filters.search.toLowerCase())) ||
            (a.contact && a.contact.toLowerCase().includes(filters.search.toLowerCase()));

        const matchesType = filters.type === 'all' || a.type === filters.type || a.type === 'Her İkisi';
        return matchesSearch && matchesType;
    });

    const getExportData = () => filteredAccounts.map(a => ({
        'Firma': a.name,
        'Tip': a.type,
        'İlgili Kişi': a.contact,
        'Telefon': a.phone
    }));

    const handleExcel = () => exportToExcel(getExportData(), 'cari_hesaplar');

    const handlePDF = () => exportToPDF(
        'Cari Hesap Listesi',
        ['Firma', 'Tip', 'İlgili Kişi', 'Telefon'],
        filteredAccounts.map(a => [a.name, a.type, a.contact, a.phone]),
        'cari_hesaplar'
    );

    const handlePrintList = () => handlePrint(
        'Cari Hesap Listesi',
        ['Firma', 'Tip', 'İlgili Kişi', 'Telefon'],
        filteredAccounts.map(a => [a.name, a.type, a.contact, a.phone])
    );

    const [selectedAccount, setSelectedAccount] = useState(null);

    const handleSubmit = (e) => {
        e.preventDefault();
        onAdd({ ...formData, id: editingId });
        setFormData({ name: '', type: 'Müşteri', contact: '', phone: '' });
        setEditingId(null);
        setShowForm(false);
    };

    const handleEdit = (account) => {
        setFormData({
            name: account.name,
            type: account.type,
            contact: account.contact || '',
            phone: account.phone || ''
        });
        setEditingId(account.id);
        setShowForm(true);
    };

    const getAccountTransactions = (account) => {
        if (!account) return [];
        let transactions = [];

        if (account.type === 'Müşteri' || account.type === 'Her İkisi') {
            const accountSales = sales.filter(s => s.customer_name === account.name);
            transactions = [...transactions, ...accountSales.map(s => ({
                date: s.sale_date || s.created_at,
                type: 'Satış',
                description: `Satış #${s.id}`,
                amount: s.total_amount,
                currency: s.currency
            }))];
        }

        if (account.type === 'Tedarikçi' || account.type === 'Her İkisi') {
            const accountPurchases = purchases.filter(p => p.supplier_id === account.id);
            transactions = [...transactions, ...accountPurchases.map(p => ({
                date: p.created_at,
                type: 'Alım',
                description: `${p.item_name} (${p.qty} ${p.unit || 'br'})`,
                amount: p.total,
                currency: p.currency
            }))];
        }

        return transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Building className="h-6 w-6 text-indigo-600" /> Cari Hesaplar
                </h2>
                <div className="flex gap-2">
                    <ExportButtons onExcel={handleExcel} onPDF={handlePDF} onPrint={handlePrintList} />
                    <button
                        onClick={() => {
                            setFormData({ name: '', type: 'Müşteri', contact: '', phone: '' });
                            setEditingId(null);
                            setShowForm(true);
                        }}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Plus className="h-4 w-4" /> Yeni Cari
                    </button>
                </div>
            </div>

            {showForm && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
                    <h3 className="text-lg font-bold mb-4 text-slate-700">
                        {editingId ? 'Cari Düzenle' : 'Yeni Cari Ekle'}
                    </h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Firma Ünvanı</label>
                            <input
                                required
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Tip</label>
                            <select
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                                className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                            >
                                <option value="Müşteri">Müşteri</option>
                                <option value="Tedarikçi">Tedarikçi</option>
                                <option value="Her İkisi">Her İkisi</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">İlgili Kişi</label>
                            <input
                                type="text"
                                value={formData.contact}
                                onChange={e => setFormData({ ...formData, contact: e.target.value })}
                                className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Telefon</label>
                            <input
                                type="text"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                            />
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                            >
                                İptal
                            </button>
                            <button
                                type="submit"
                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium"
                            >
                                Kaydet
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* STANDARDIZED FILTER BAR */}
            <div className="bg-white p-4 rounded-xl shadow border border-slate-200 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Arama</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            value={filters.search}
                            onChange={e => setFilters({ ...filters, search: e.target.value })}
                            placeholder="Firma veya kişi adı..."
                            className="w-full pl-9 bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                </div>
                <div className="w-48">
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Hesap Tipi</label>
                    <select
                        value={filters.type}
                        onChange={e => setFilters({ ...filters, type: e.target.value })}
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                    >
                        <option value="all">Tümü</option>
                        <option value="Müşteri">Müşteri</option>
                        <option value="Tedarikçi">Tedarikçi</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">

                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-3 text-left">Firma Ünvanı</th>
                                <th className="px-6 py-3 text-left">Tip</th>
                                <th className="px-6 py-3 text-left">İlgili Kişi</th>
                                <th className="px-6 py-3 text-left">Telefon</th>
                                <th className="px-6 py-3 text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {filteredAccounts.map(account => (
                                <tr
                                    key={account.id}
                                    className="hover:bg-slate-50 transition-colors cursor-pointer"
                                    onClick={() => setSelectedAccount(account)}
                                >
                                    <td className="px-6 py-4 font-medium text-slate-800">{account.name}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${account.type === 'Müşteri' ? 'bg-green-100 text-green-700' :
                                            account.type === 'Tedarikçi' ? 'bg-blue-100 text-blue-700' :
                                                'bg-purple-100 text-purple-700'
                                            }`}>
                                            {account.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{account.contact}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{account.phone}</td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => handleEdit(account)}
                                            className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => onDelete(account.id)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {filteredAccounts.length === 0 && (
                                <tr>
                                    <td colSpan="5" className="px-6 py-8 text-center text-slate-400">
                                        Kayıt bulunamadı.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {/* TRANSACTION HISTORY MODAL (Preserved) */}
                {selectedAccount && (
                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setSelectedAccount(null)}>
                        <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                            <div className="p-6 border-b flex justify-between items-center bg-slate-50">
                                <div>
                                    <h3 className="text-xl font-bold text-slate-800">{selectedAccount.name}</h3>
                                    <div className="text-sm text-slate-500">{selectedAccount.type} • {selectedAccount.contact}</div>
                                </div>
                                <button onClick={() => setSelectedAccount(null)} className="text-slate-400 hover:text-slate-600">
                                    <Trash2 className="h-6 w-6 rotate-45" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                <table className="w-full">
                                    <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold sticky top-0">
                                        <tr>
                                            <th className="px-6 py-3 text-left">Tarih</th>
                                            <th className="px-6 py-3 text-left">İşlem</th>
                                            <th className="px-6 py-3 text-left">Açıklama</th>
                                            <th className="px-6 py-3 text-right">Tutar</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {getAccountTransactions(selectedAccount).map((t, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50">
                                                <td className="px-6 py-4 text-sm text-slate-600">
                                                    {new Date(t.date).toLocaleDateString('tr-TR')}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-bold ${t.type === 'Satış' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                                                        }`}>
                                                        {t.type}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-4 text-sm text-slate-600">{t.description}</td>
                                                <td className="px-6 py-4 text-right font-bold text-slate-700">
                                                    {t.amount?.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {t.currency}
                                                </td>
                                            </tr>
                                        ))}
                                        {getAccountTransactions(selectedAccount).length === 0 && (
                                            <tr><td colSpan="4" className="px-6 py-8 text-center text-slate-400">İşlem geçmişi yok.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
