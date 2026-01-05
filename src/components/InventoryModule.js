import React, { useState } from 'react';
import { Package, Search, Trash2, Edit2, Plus, Filter, AlertCircle, Download } from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function InventoryModule({ inventory, onRefresh, isIntegrated = false }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState('All');
    const [editingItem, setEditingItem] = useState(null);
    const [isDeleting, setIsDeleting] = useState(null);
    const [showAddModal, setShowAddModal] = useState(false);

    const filteredInventory = inventory.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (item.product_code && item.product_code.toLowerCase().includes(searchTerm.toLowerCase()));
        const matchesType = typeFilter === 'All' || item.type === typeFilter;
        return matchesSearch && matchesType;
    });

    const handleDelete = async (id) => {
        if (!window.confirm('Bu stok kartını silmek istediğinize emin misiniz? Eğer bu ürüne bağlı LOT veya Reçete varsa silme işlemi başarısız olacaktır.')) return;

        setIsDeleting(id);
        try {
            const { error } = await supabase.from('inventory').delete().eq('id', id);
            if (error) {
                if (error.code === '23503') {
                    alert('Bu ürün silinemez! Çünkü bu ürüne bağlı LOT kayıtları, Satınalmalar veya Reçeteler bulunmaktadır. Önce bağlı kayıtları silmelisiniz.');
                } else {
                    throw error;
                }
            } else {
                onRefresh();
            }
        } catch (error) {
            console.error('Silme hatası:', error);
            alert('Hata oluştu: ' + error.message);
        } finally {
            setIsDeleting(null);
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase.from('inventory').update({
                name: editingItem.name,
                unit: editingItem.unit,
                cost: parseFloat(editingItem.cost) || 0,
                currency: editingItem.currency,
                payment_term: parseInt(editingItem.payment_term) || 0,
                track_stock: editingItem.track_stock,
                critical_stock: parseFloat(editingItem.critical_stock) || 0,
                density: parseFloat(editingItem.density) || 1.0
            }).eq('id', editingItem.id);

            if (error) throw error;
            setEditingItem(null);
            onRefresh();
        } catch (error) {
            console.error('Güncelleme hatası:', error);
            alert('Hata: ' + error.message);
        }
    };

    const exportToExcel = () => {
        // Placeholder for Excel export logic
        alert('Excel\'e aktarma özelliği yakında eklenecektir!');
    };

    return (
        <div className="space-y-6">
            {!isIntegrated && (
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <h2 className="heading-industrial text-2xl flex items-center gap-2">
                        <Package className="h-7 w-7 text-indigo-600" />
                        STOK VE ENVANTER YÖNETİMİ
                    </h2>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="btn-industrial px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-700 flex items-center gap-2"
                        >
                            <Plus className="h-4 w-4" /> Yeni Stok Kartı
                        </button>
                        <button
                            onClick={exportToExcel}
                            className="btn-industrial px-4 py-2 border border-slate-700 text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                        >
                            <Download className="h-4 w-4" /> Excel'e Aktar
                        </button>
                    </div>
                </div>
            )}

            {isIntegrated && (
                <div className="flex justify-end">
                    <button
                        onClick={() => setShowAddModal(true)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" /> Yeni Stok Kartı
                    </button>
                </div>
            )}

            {/* Filter Bar */}
            <div className="bg-slate-900/50 backdrop-blur rounded-xl border border-slate-800 p-4">
                <div className="flex flex-wrap gap-4">
                    <div className="relative flex-1 min-w-[200px]">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                        <input
                            type="text"
                            placeholder="Ürün adı veya kod ara..."
                            className="w-full pl-10 pr-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                    <select
                        className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 transition-all appearance-none"
                        value={typeFilter}
                        onChange={(e) => setTypeFilter(e.target.value)}
                    >
                        <option value="All">Tüm Kategoriler</option>
                        <option value="Raw Material">Hammadde</option>
                        <option value="Packaging">Ambalaj</option>
                        <option value="Finished Good">Mamul</option>
                        <option value="Asset">Demirbaş</option>
                    </select>
                </div>
                <div className="flex items-center gap-2 text-[10px] text-gray-500 font-medium bg-gray-50 px-3 py-2 rounded border border-gray-100 mt-4">
                    <AlertCircle className="h-3 w-3 text-amber-500" />
                    Silinen kayıtlar Master Data'dan kalıcı olarak kaldırılır.
                </div>
            </div>

            {/* Table */}
            <div className="card-industrial overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table-industrial">
                        <thead>
                            <tr>
                                <th className="text-left w-1/4">Kod / İsim</th>
                                <th className="text-left w-1/6">Tip</th>
                                <th className="text-right w-1/6">Maliyet</th>
                                <th className="text-right w-1/6">Vade (Gün)</th>
                                <th className="text-center w-1/12">Stok Takibi</th>
                                <th className="text-right w-1/6">İşlem</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredInventory.map(item => (
                                <tr key={item.id}>
                                    <td>
                                        <div className="font-medium text-[#1d1d1f]">{item.name}</div>
                                        <div className="text-[10px] text-gray-400 font-mono mt-0.5">{item.product_code || `ID: ${item.id}`}</div>
                                    </td>
                                    <td>
                                        <span className={`badge-industrial ${item.type === 'Hammadde' ? 'badge-industrial-blue' :
                                            item.type === 'Ambalaj' ? 'badge-industrial-gray' :
                                                'badge-industrial-green'
                                            }`}>
                                            {item.type}
                                        </span>
                                    </td>
                                    <td className="text-right font-mono">
                                        {item.cost ? `${item.cost} ${item.currency}` : '-'}
                                    </td>
                                    <td className="text-right font-mono">
                                        {item.payment_term || 0}
                                    </td>
                                    <td className="text-center">
                                        {item.track_stock ?
                                            <span className="text-green-600 font-bold text-[10px]">✔</span> :
                                            <span className="text-gray-300 text-[10px]">-</span>
                                        }
                                    </td>
                                    <td className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => setEditingItem(item)}
                                                className="text-blue-600 hover:text-blue-800 transition-colors"
                                                title="Düzenle"
                                            >
                                                <Edit2 className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(item.id)}
                                                disabled={isDeleting === item.id}
                                                className="text-red-500 hover:text-red-700 transition-colors"
                                                title="Sil"
                                            >
                                                <Trash2 className={`h-4 w-4 ${isDeleting === item.id ? 'animate-pulse' : ''}`} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit Modal */}
            {editingItem && (
                <div className="modal-overlay-industrial flex items-center justify-center p-4">
                    <div className="modal-content-industrial w-full max-w-md">
                        <div className="modal-header-industrial">
                            <h3 className="text-sm font-bold text-[#1d1d1f] uppercase tracking-wide">Kart Düzenle</h3>
                            <button onClick={() => setEditingItem(null)} className="text-gray-400 hover:text-gray-600 transition-colors">×</button>
                        </div>
                        <form onSubmit={handleUpdate}>
                            <div className="modal-body-industrial">
                                <div>
                                    <label className="label-industrial block">Ürün Adı</label>
                                    <input
                                        required
                                        value={editingItem.name}
                                        onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
                                        className="input-industrial"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label-industrial block">Birim Maliyet</label>
                                        <input
                                            type="number" step="0.0001"
                                            value={editingItem.cost}
                                            onChange={e => setEditingItem({ ...editingItem, cost: e.target.value })}
                                            className="input-industrial"
                                        />
                                    </div>
                                    <div>
                                        <label className="label-industrial block">Vade (Gün)</label>
                                        <input
                                            type="number"
                                            value={editingItem.payment_term}
                                            onChange={e => setEditingItem({ ...editingItem, payment_term: e.target.value })}
                                            className="input-industrial"
                                        />
                                    </div>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="label-industrial block">Stok Takibi</label>
                                        <select
                                            value={editingItem.track_stock ? 'true' : 'false'}
                                            onChange={e => setEditingItem({ ...editingItem, track_stock: e.target.value === 'true' })}
                                            className="select-industrial"
                                        >
                                            <option value="true">Aktif</option>
                                            <option value="false">Pasif</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="label-industrial block">Özgül Ağırlık</label>
                                        <input
                                            type="number" step="0.01"
                                            value={editingItem.density}
                                            onChange={e => setEditingItem({ ...editingItem, density: e.target.value })}
                                            className="input-industrial"
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="modal-footer-industrial">
                                <button type="button" onClick={() => setEditingItem(null)} className="btn-secondary">İptal</button>
                                <button type="submit" className="btn-primary">Güncelle</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
