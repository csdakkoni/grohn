import React, { useState } from 'react';
import { Trash2, Plus, Edit, Filter, Phone, User, Building, Search } from 'lucide-react';
import ExportButtons from './ExportButtons';
import { exportToExcel, exportToPDF, handlePrint } from '../utils/exportUtils';

export default function CurrentAccountsModule({ accounts, sales = [], purchases = [], onAdd, onDelete, isIntegrated = false }) {
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
            {!isIntegrated && (
                <div className="flex justify-between items-center">
                    <h2 className="heading-industrial text-2xl flex items-center gap-2">
                        <Building className="h-6 w-6 text-[#0071e3]" /> Cari Hesaplar
                    </h2>
                    <div className="flex gap-2">
                        <ExportButtons onExcel={handleExcel} onPDF={handlePDF} onPrint={handlePrintList} />
                        <button
                            onClick={() => {
                                setFormData({ name: '', type: 'Müşteri', contact: '', phone: '' });
                                setEditingId(null);
                                setShowForm(true);
                            }}
                            className="btn-primary flex items-center gap-2"
                        >
                            <Plus className="h-4 w-4" /> Yeni Cari
                        </button>
                    </div>
                </div>
            )}

            {isIntegrated && (
                <div className="flex justify-end items-center gap-2">
                    <ExportButtons onExcel={handleExcel} onPDF={handlePDF} onPrint={handlePrintList} />
                    <button
                        onClick={() => {
                            setFormData({ name: '', type: 'Müşteri', contact: '', phone: '' });
                            setEditingId(null);
                            setShowForm(true);
                        }}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" /> Yeni Cari
                    </button>
                </div>
            )}

            {showForm && (
                <div className="card-industrial p-6 mb-6 animate-fade-in">
                    <h3 className="text-sm font-bold mb-4 text-[#1d1d1f] uppercase tracking-wide border-b border-[#d2d2d7] pb-2">
                        {editingId ? 'Cari Düzenle' : 'Yeni Cari Ekle'}
                    </h3>
                    <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label-industrial block">Firma Ünvanı</label>
                            <input
                                required
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="input-industrial"
                            />
                        </div>
                        <div>
                            <label className="label-industrial block">Tip</label>
                            <select
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                                className="select-industrial"
                            >
                                <option value="Müşteri">Müşteri</option>
                                <option value="Tedarikçi">Tedarikçi</option>
                                <option value="Her İkisi">Her İkisi</option>
                            </select>
                        </div>
                        <div>
                            <label className="label-industrial block">İlgili Kişi</label>
                            <input
                                type="text"
                                value={formData.contact}
                                onChange={e => setFormData({ ...formData, contact: e.target.value })}
                                className="input-industrial"
                            />
                        </div>
                        <div>
                            <label className="label-industrial block">Telefon</label>
                            <input
                                type="text"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                className="input-industrial"
                            />
                        </div>
                        <div className="md:col-span-2 flex justify-end gap-2 mt-2">
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
                                className="btn-secondary"
                            >
                                İptal
                            </button>
                            <button
                                type="submit"
                                className="btn-primary"
                            >
                                Kaydet
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* STANDARDIZED FILTER BAR */}
            <div className="card-industrial p-4 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="label-industrial block">Arama</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            value={filters.search}
                            onChange={e => setFilters({ ...filters, search: e.target.value })}
                            placeholder="Firma veya kişi adı..."
                            className="input-industrial pl-9"
                        />
                    </div>
                </div>
                <div className="w-48">
                    <label className="label-industrial block">Hesap Tipi</label>
                    <select
                        value={filters.type}
                        onChange={e => setFilters({ ...filters, type: e.target.value })}
                        className="select-industrial"
                    >
                        <option value="all">Tümü</option>
                        <option value="Müşteri">Müşteri</option>
                        <option value="Tedarikçi">Tedarikçi</option>
                    </select>
                </div>
            </div>

            <div className="card-industrial overflow-hidden">

                <div className="overflow-x-auto">
                    <table className="table-industrial">
                        <thead>
                            <tr>
                                <th className="text-left">Firma Ünvanı</th>
                                <th className="text-left">Tip</th>
                                <th className="text-left">İlgili Kişi</th>
                                <th className="text-left">Telefon</th>
                                <th className="text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#d2d2d7]">
                            {filteredAccounts.map(account => (
                                <tr
                                    key={account.id}
                                    className="hover:bg-[#f5f5f7] transition-colors cursor-pointer"
                                    onClick={() => setSelectedAccount(account)}
                                >
                                    <td className="font-medium text-[#1d1d1f]">{account.name}</td>
                                    <td>
                                        <span className={`badge-industrial ${account.type === 'Müşteri' ? 'badge-industrial-green' :
                                            account.type === 'Tedarikçi' ? 'badge-industrial-blue' :
                                                'badge-industrial-gray'
                                            }`}>
                                            {account.type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{account.contact}</td>
                                    <td className="px-6 py-4 text-sm text-slate-600">{account.phone}</td>
                                    <td className="px-6 py-4 text-right flex justify-end gap-2" onClick={e => e.stopPropagation()}>
                                        <button
                                            onClick={() => handleEdit(account)}
                                            className="p-1.5 text-[#0071e3] hover:text-[#0077ed] transition-colors"
                                            title="Düzenle"
                                        >
                                            <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                            onClick={() => onDelete(account.id)}
                                            className="p-1.5 text-gray-400 hover:text-[#d21e1e] transition-colors"
                                            title="Sil"
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
                    <div className="modal-overlay-industrial flex items-center justify-center z-50 p-4" onClick={() => setSelectedAccount(null)}>
                        <div className="modal-content-industrial w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                            <div className="modal-header-industrial flex justify-between items-center bg-[#f5f5f7]">
                                <div>
                                    <h3 className="text-sm font-bold text-[#1d1d1f] uppercase tracking-wide">{selectedAccount.name}</h3>
                                    <div className="text-[10px] text-[#86868b]">{selectedAccount.type} • {selectedAccount.contact}</div>
                                </div>
                                <button onClick={() => setSelectedAccount(null)} className="text-gray-400 hover:text-gray-600">
                                    <Trash2 className="h-5 w-5 rotate-45" />
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
