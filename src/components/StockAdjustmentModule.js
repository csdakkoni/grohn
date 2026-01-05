import React, { useState } from 'react';
import { ClipboardCheck, Search, Info, CheckCircle, AlertTriangle } from 'lucide-react';

export default function StockAdjustmentModule({ inventory, getItemStock, onReconcile }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [adjustmentData, setAdjustmentData] = useState({}); // { itemId: { physical: '', notes: '' } }

    const filteredItems = inventory.filter(item =>
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.product_code && item.product_code.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleInputChange = (itemId, field, value) => {
        setAdjustmentData(prev => ({
            ...prev,
            [itemId]: {
                ...prev[itemId],
                [field]: value
            }
        }));
    };

    const handleAdjust = async (id) => {
        const data = adjustmentData[id];
        if (!data || data.physical === '') {
            alert('Lütfen fiziksel sayım miktarını giriniz.');
            return;
        }

        const success = await onReconcile(id, parseFloat(data.physical), data.notes);
        if (success) {
            // Clear input for this item
            setAdjustmentData(prev => {
                const newData = { ...prev };
                delete newData[id];
                return newData;
            });
        }
    };

    return (
        <div className="space-y-6 animate-fade-in text-slate-800">
            {/* Disclaimer / Info */}
            <div className="bg-[#fefce8] border border-[#fef08a] p-4 rounded-[6px] flex items-start gap-3">
                <Info className="h-5 w-5 text-[#854d0e] mt-0.5" />
                <div>
                    <h4 className="font-bold text-[#854d0e] text-sm">Stok Sayım ve Mutabakat</h4>
                    <p className="text-xs text-[#854d0e] mt-1">
                        Gerçekleşen fiziksel sayım miktarlarını buraya girerek sistem stoğunu düzeltebilirsiniz.
                        Sistem, mevcut stok ile girdiğiniz miktar arasındaki farkı otomatik olarak bir "Sayım Düzeltme" kaydı (LOT) olarak ekleyecektir.
                    </p>
                </div>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-md">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                <input
                    type="text"
                    placeholder="Mlzeme Adı veya Kod ile ara..."
                    className="input-industrial pl-9"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                />
            </div>

            {/* Adjustment Table */}
            <div className="rounded-[6px] border border-[#d2d2d7] overflow-hidden shadow-sm bg-white">
                <div className="overflow-x-auto">
                    <table className="table-industrial">
                        <thead>
                            <tr className="bg-[#f5f5f7]">
                                <th className="text-left py-3 px-4 w-1/3">Malzeme Kaydı</th>
                                <th className="text-right py-3 px-4">Sistem Stoğu</th>
                                <th className="text-center py-3 px-4 w-32">Fiziksel Sayım</th>
                                <th className="text-right py-3 px-4">Fark</th>
                                <th className="text-left py-3 px-4">Notlar / Sebep</th>
                                <th className="text-center py-3 px-4">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#d2d2d7]">
                            {filteredItems.map(item => {
                                const systemStock = getItemStock(item.id);
                                const currentData = adjustmentData[item.id] || { physical: '', notes: '' };
                                const physical = parseFloat(currentData.physical);
                                const diff = isNaN(physical) ? 0 : physical - systemStock;

                                return (
                                    <tr key={item.id} className="hover:bg-[#fafafa] transition-colors">
                                        <td className="px-4 py-4">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-slate-900">{item.name}</span>
                                                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">{item.product_code || item.id} | {item.type}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            <div className="font-mono font-bold text-slate-700">
                                                {systemStock.toFixed(2)} <span className="text-[10px] text-slate-400">{item.unit}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-4">
                                            <input
                                                type="number"
                                                step="0.01"
                                                className="input-industrial text-right font-mono font-bold bg-slate-50 border-indigo-200 focus:bg-white"
                                                placeholder="0.00"
                                                value={currentData.physical}
                                                onChange={e => handleInputChange(item.id, 'physical', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-4 py-4 text-right">
                                            {currentData.physical !== '' && (
                                                <div className={`font-mono font-bold ${diff > 0 ? 'text-green-600' : diff < 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                                    {diff > 0 ? '+' : ''}{diff.toFixed(2)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-4 py-4">
                                            <input
                                                type="text"
                                                className="input-industrial text-xs"
                                                placeholder="Düzeltme sebebi..."
                                                value={currentData.notes}
                                                onChange={e => handleInputChange(item.id, 'notes', e.target.value)}
                                            />
                                        </td>
                                        <td className="px-4 py-4 text-center">
                                            <button
                                                onClick={() => handleAdjust(item.id)}
                                                disabled={currentData.physical === ''}
                                                className={`p-2 rounded-full transition-all ${currentData.physical !== ''
                                                    ? 'text-indigo-600 hover:bg-indigo-50 border border-indigo-100 shadow-sm'
                                                    : 'text-slate-300 cursor-not-allowed grayscale'}`}
                                                title="Sistem Stoğunu Güncelle"
                                            >
                                                <CheckCircle className="h-5 w-5" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredItems.length === 0 && (
                                <tr>
                                    <td colSpan="6" className="py-12 text-center text-slate-400 italic">
                                        Aranan kriterlere uygun malzeme bulunamadı.
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
