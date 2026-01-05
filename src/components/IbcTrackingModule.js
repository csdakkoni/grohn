import React, { useState } from 'react';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import { Package, ArrowDownLeft, ArrowUpRight, History, Search, CheckCircle, FileText, Trash2 } from 'lucide-react';
import { drawCIHeader, drawCIFooter, drawCIMetadataGrid } from '../utils/pdfCIUtils';

export default function IbcTrackingModule({ accounts, ibcMovements, onIbcReturn, onDeleteMovement, globalSettings = {} }) {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [returnData, setReturnData] = useState({ quantity: '', notes: '' });

    // Calculate IBC balance per customer
    const customerBalances = accounts.map(customer => {
        const sent = ibcMovements
            .filter(m => m.customer_id === customer.id && m.type === 'Sent')
            .reduce((sum, m) => sum + m.quantity, 0);
        const returned = ibcMovements
            .filter(m => m.customer_id === customer.id && m.type === 'Returned')
            .reduce((sum, m) => sum + m.quantity, 0);

        return {
            ...customer,
            sent,
            returned,
            balance: sent - returned
        };
    }).filter(c => c.sent > 0 || c.returned > 0);

    const filteredBalances = customerBalances.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleReturnSubmit = async (e) => {
        e.preventDefault();
        if (!selectedCustomer) return;
        const qty = parseInt(returnData.quantity);
        if (qty <= 0) return alert('Miktar giriniz!');

        const success = await onIbcReturn(selectedCustomer.id, qty, returnData.notes);
        if (success) {
            setSelectedCustomer(null);
            setReturnData({ quantity: '', notes: '' });
        }
    };

    const exportIbcReport = (customer) => {
        const doc = new jsPDF();
        const movements = ibcMovements
            .filter(m => m.customer_id === customer.id)
            .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

        const dateStr = new Date().toLocaleDateString('tr-TR');
        const refNo = `IBC-${customer.id}-${Date.now().toString().slice(-6)}`;

        drawCIHeader(doc, 'IBC DEPOZİTO EKSTRESİ', customer.name, dateStr, refNo);

        let y = 40;
        y = drawCIMetadataGrid(doc, 14, y, [
            { label: 'Müşteri Adı', value: customer.name },
            { label: 'Toplam Gönderilen', value: `${customer.sent} Adet` },
            { label: 'Toplam İade Edilen', value: `${customer.returned} Adet` },
            { label: 'Güncel IBC Borcu', value: `${customer.balance} Adet` }
        ], 2);

        doc.autoTable({
            startY: y + 5,
            head: [['Tarih', 'İşlem Tipi', 'Miktar', 'Notlar']],
            body: movements.map(m => [
                new Date(m.created_at).toLocaleDateString('tr-TR'),
                m.type === 'Sent' ? 'SİSTEM ÇIKIŞI (DOLU)' : 'MÜŞTERİ İADESİ (BOŞ)',
                `${m.type === 'Sent' ? '+' : '-'}${m.quantity} Adet`,
                m.notes || '-'
            ]),
            styles: { fontSize: 8, font: 'helvetica', cellPadding: 3 },
            headStyles: { fillColor: [29, 29, 31], textColor: [255, 255, 255], fontStyle: 'bold' },
            alternateRowStyles: { fillColor: [245, 245, 247] },
            margin: { left: 14, right: 14 }
        });

        drawCIFooter(doc, globalSettings, 'GROHN IBC TRACKING v1.0');
        doc.save(`${customer.name.replace(/\s+/g, '_')}_IBC_Ekstresi.pdf`);
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="heading-industrial text-2xl flex items-center gap-2">
                    <Package className="h-7 w-7 text-indigo-600" />
                    IBC DEPOZİTO TAKİBİ
                </h2>
                <div className="relative w-full md:w-64">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                    <input
                        type="text"
                        placeholder="Müşteri ara..."
                        className="input-industrial pl-9"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Balance List */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="card-industrial overflow-hidden">
                        <table className="table-industrial">
                            <thead>
                                <tr>
                                    <th className="text-left">Müşteri</th>
                                    <th className="text-right">Gönderilen</th>
                                    <th className="text-right">İade Alınan</th>
                                    <th className="text-right">Mevcut Borç</th>
                                    <th className="text-center">İşlem</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredBalances.map(c => (
                                    <tr key={c.id}>
                                        <td className="font-medium text-slate-900">{c.name}</td>
                                        <td className="text-right text-amber-600 font-mono">+{c.sent}</td>
                                        <td className="text-right text-green-600 font-mono">-{c.returned}</td>
                                        <td className={`text-right font-mono font-bold ${c.balance > 0 ? 'text-red-500' : 'text-slate-400'}`}>
                                            {c.balance} Adet
                                        </td>
                                        <td className="text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    onClick={() => setSelectedCustomer(c)}
                                                    className="btn-industrial px-3 py-1 text-xs bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
                                                >
                                                    İade Al
                                                </button>
                                                <button
                                                    onClick={() => exportIbcReport(c)}
                                                    className="btn-industrial px-3 py-1 text-xs bg-slate-50 text-slate-700 hover:bg-slate-100 flex items-center gap-1"
                                                    title="PDF Ekstre İndir"
                                                >
                                                    <FileText className="h-3 w-3" /> Ekstre
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {filteredBalances.length === 0 && (
                                    <tr>
                                        <td colSpan="5" className="text-center py-8 text-slate-400">IBC kaydı bulunamadı.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Movement History */}
                    <div className="card-industrial p-4 space-y-4">
                        <h3 className="text-sm font-bold flex items-center gap-2 text-slate-700">
                            <History className="h-4 w-4" /> SON HAREKETLER
                        </h3>
                        <div className="space-y-2">
                            {ibcMovements.slice(0, 10).map(m => {
                                const customer = accounts.find(a => a.id === m.customer_id);
                                return (
                                    <div key={m.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg border border-slate-100">
                                        <div className="flex items-center gap-3">
                                            {m.type === 'Sent' ?
                                                <ArrowUpRight className="h-4 w-4 text-amber-500" /> :
                                                <ArrowDownLeft className="h-4 w-4 text-green-500" />
                                            }
                                            <div>
                                                <div className="text-xs font-bold text-slate-900">{customer?.name || 'Bilinmeyen'}</div>
                                                <div className="text-[10px] text-slate-500">{m.notes || (m.type === 'Sent' ? 'Sevkiyat' : 'İade')}</div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="text-right">
                                                <div className={`text-sm font-mono font-bold ${m.type === 'Sent' ? 'text-amber-600' : 'text-green-600'}`}>
                                                    {m.type === 'Sent' ? '+' : '-'}{m.quantity}
                                                </div>
                                                <div className="text-[9px] text-slate-400">{new Date(m.created_at).toLocaleDateString('tr-TR')}</div>
                                            </div>
                                            <button
                                                onClick={() => onDeleteMovement(m.id)}
                                                className="p-1.5 text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                                title="Hareketi Sil"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                {/* Return Form (Fixed Side) */}
                <div className="lg:col-span-1">
                    {selectedCustomer ? (
                        <div className="card-industrial p-6 sticky top-8 border-indigo-200 shadow-lg shadow-indigo-100">
                            <h3 className="text-sm font-bold text-indigo-900 uppercase tracking-wider mb-4">IBC İADE FORMU</h3>
                            <div className="mb-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                                <div className="text-[10px] text-indigo-600 font-bold uppercase">Müşteri</div>
                                <div className="text-sm font-bold text-indigo-900">{selectedCustomer.name}</div>
                                <div className="text-xs text-indigo-700 mt-1">Mevcut Borç: <strong>{selectedCustomer.balance} Adet</strong></div>
                            </div>
                            <form onSubmit={handleReturnSubmit} className="space-y-4">
                                <div>
                                    <label className="label-industrial">İade Miktarı (Adet)</label>
                                    <input
                                        type="number"
                                        required
                                        className="input-industrial"
                                        value={returnData.quantity}
                                        onChange={e => setReturnData({ ...returnData, quantity: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="label-industrial">Notlar</label>
                                    <textarea
                                        className="input-industrial h-24 text-xs"
                                        placeholder="İade sebebi, araç plakası vb..."
                                        value={returnData.notes}
                                        onChange={e => setReturnData({ ...returnData, notes: e.target.value })}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <button type="button" onClick={() => setSelectedCustomer(null)} className="btn-secondary flex-1">İptal</button>
                                    <button type="submit" className="btn-primary flex-1 flex items-center justify-center gap-2">
                                        <CheckCircle className="h-4 w-4" /> Kaydet
                                    </button>
                                </div>
                            </form>
                        </div>
                    ) : (
                        <div className="card-industrial p-8 flex flex-col items-center justify-center text-center opacity-50 border-dashed">
                            <Package className="h-12 w-12 text-slate-300 mb-4" />
                            <p className="text-sm text-slate-500">İade işlemi yapmak için listeden bir müşteri seçin.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
