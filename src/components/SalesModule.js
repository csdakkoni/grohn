import React, { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Search, Calendar, User, Package, DollarSign, Filter, FileText, Trash2, CheckCircle, X, TrendingUp, Info } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function SalesModule({
    sales = [],
    inventory = [],
    accounts = [],
    productions = [],
    recipes = [],
    globalSettings = {},
    onSale,
    onDeleteSale,
    onUpdateSale,
    exchangeRates = {},
    isIntegrated = false
}) {
    const [showForm, setShowForm] = useState(false);
    const [editingSale, setEditingSale] = useState(null);
    const [formData, setFormData] = useState({
        customerId: '',
        productionId: '',
        quantity: '',
        unitPrice: '',
        currency: 'USD',
        paymentTerm: 30,
        shippingCost: 0,
        shippingCurrency: 'USD',
        overheadPerKg: globalSettings.global_overhead_rate || 0.2,
        overheadCurrency: 'USD',
        packagingId: '',
        saleDate: new Date().toISOString().split('T')[0],
        notes: '',
        interestRate: globalSettings.monthly_interest_rate || 4.5
    });

    const [calcResult, setCalcResult] = useState({
        totalCost: 0,
        unitCost: 0,
        profit: 0,
        margin: 0
    });

    const [filters, setFilters] = useState({
        search: '',
        customer: '',
        dateStart: '',
        dateEnd: ''
    });

    // --- Helper for Currencies ---
    const toUSD = (amount, currency) => {
        if (!currency || currency === 'USD') return amount;
        const rate = exchangeRates[currency];
        return rate ? amount / rate : amount;
    };

    const fromUSD = (amountUSD, targetCurrency) => {
        if (!targetCurrency || targetCurrency === 'USD') return amountUSD;
        const rate = exchangeRates[targetCurrency];
        return rate ? amountUSD * rate : amountUSD;
    };

    // --- Price Memory ---
    useEffect(() => {
        if (formData.customerId && formData.productionId) {
            const prod = productions.find(p => p.id === parseInt(formData.productionId));
            if (!prod) return;

            const prevSale = sales
                .filter(s => s.customer_id === parseInt(formData.customerId) && s.product_name === prod.product_name)
                .sort((a, b) => new Date(b.sale_date) - new Date(a.sale_date))[0];

            if (prevSale) {
                setFormData(prev => ({
                    ...prev,
                    unitPrice: prevSale.unit_price,
                    currency: prevSale.currency
                }));
            }
        }
    }, [formData.customerId, formData.productionId, productions, sales]);

    useEffect(() => {
        const calculate = () => {
            const qty = parseFloat(formData.quantity) || 0;
            const price = parseFloat(formData.unitPrice) || 0;
            const term = parseFloat(formData.paymentTerm) || 0;
            const prod = productions.find(p => p.id === parseInt(formData.productionId));
            const targetCurr = formData.currency;

            if (!prod || !qty) {
                setCalcResult({ totalCost: 0, unitCost: 0, profit: 0, margin: 0 });
                return;
            }

            // --- FOUNDATION BASE COST (Excluding Financing) ---
            const prodCurr = prod.currency || 'USD';
            const qtyScale = qty / (parseFloat(prod.quantity) || 1);

            const baseRM_USD = toUSD(parseFloat(prod.raw_material_cost) || 0, prodCurr) * qtyScale;
            const baseOtherProdUSD = toUSD(
                (parseFloat(prod.packaging_cost) || 0) +
                (parseFloat(prod.shipping_cost) || 0) +
                (parseFloat(prod.overhead_cost) || 0),
                prodCurr
            ) * qtyScale;

            // --- ADDITIONAL SALES COSTS ---
            const intRate = (globalSettings.monthly_interest_rate || 4.0) / 100 / 30;

            // Shipping = Total, Overhead = $/kg
            const saleShipUSD = toUSD(parseFloat(formData.shippingCost) || 0, formData.shippingCurrency);
            const saleOverheadUSD = toUSD(parseFloat(formData.overheadPerKg) || 0, formData.overheadCurrency) * qty;

            const totalOtherCostsUSD = baseOtherProdUSD + saleShipUSD + saleOverheadUSD;

            // --- FINANCING CALCULATION (SPLIT) ---
            const rawAvgTerm = parseFloat(prod.raw_material_avg_term) || 0;

            // RM net term financing
            const rmFinancingUSD = baseRM_USD * Math.max(0, term - rawAvgTerm) * intRate;
            // Upfront costs finance for the full term
            const upfrontFinancingUSD = totalOtherCostsUSD * term * intRate;

            const totalFinUSD = rmFinancingUSD + upfrontFinancingUSD;
            const totalCostUSD = baseRM_USD + totalOtherCostsUSD + totalFinUSD;

            const totalRevUSD = toUSD(qty * price, targetCurr);
            const profitUSD = totalRevUSD - totalCostUSD;

            setCalcResult({
                totalCost: fromUSD(totalCostUSD, targetCurr),
                unitCost: fromUSD(totalCostUSD / qty, targetCurr),
                profit: fromUSD(profitUSD, targetCurr),
                // [MARGIN FIX] Margin = Profit / Revenue
                margin: totalRevUSD > 0 ? (profitUSD / totalRevUSD) * 100 : 0,

                // Breakdowns for DB
                rawMaterialCost: fromUSD(baseRM_USD, targetCurr),
                packagingCost: fromUSD(toUSD(parseFloat(prod.packaging_cost) || 0, prodCurr) * qtyScale, targetCurr),
                shippingCost: fromUSD(saleShipUSD + (toUSD(parseFloat(prod.shipping_cost) || 0, prodCurr) * qtyScale), targetCurr),
                overheadCost: fromUSD(saleOverheadUSD + (toUSD(parseFloat(prod.overhead_cost) || 0, prodCurr) * qtyScale), targetCurr),
                financingCost: fromUSD(totalFinUSD, targetCurr)
            });
        };
        calculate();
    }, [formData, productions, globalSettings, exchangeRates]);

    const customers = accounts.filter(a => a.type === 'Müşteri' || a.type === 'Her İkisi');

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            if (editingSale) {
                await onUpdateSale(editingSale.id, {
                    ...formData,
                    ...calcResult,
                    overheadCost: (parseFloat(formData.overheadPerKg) || 0) * (parseFloat(formData.quantity) || 0)
                });
            } else {
                await onSale({
                    ...formData,
                    ...calcResult,
                    overheadCost: (parseFloat(formData.overheadPerKg) || 0) * (parseFloat(formData.quantity) || 0)
                });
            }
            closeForm();
        } catch (error) {
            console.error(error);
        }
    };

    const handleEdit = (sale) => {
        setEditingSale(sale);
        setFormData({
            customerId: sale.customer_id,
            productionId: sale.production_id,
            quantity: sale.quantity,
            unitPrice: sale.unit_price,
            currency: sale.currency,
            paymentTerm: sale.payment_term,
            shippingCost: sale.shipping_cost || 0,
            shippingCurrency: sale.currency,
            overheadPerKg: sale.overhead_cost / sale.quantity || 0,
            overheadCurrency: sale.currency,
            packagingId: '',
            saleDate: sale.sale_date,
            notes: sale.notes || ''
        });
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingSale(null);
        setFormData({
            customerId: '',
            productionId: '',
            quantity: '',
            unitPrice: '',
            currency: 'USD',
            paymentTerm: 30,
            shippingCost: 0,
            shippingCurrency: 'USD',
            overheadPerKg: globalSettings.global_overhead_rate || 0.2,
            overheadCurrency: 'USD',
            packagingId: '',
            saleDate: new Date().toISOString().split('T')[0],
            notes: ''
        });
    };

    const filteredSales = sales.filter(s => {
        const searchMatch = !filters.search ||
            (s.customer_name && s.customer_name.toLowerCase().includes(filters.search.toLowerCase())) ||
            (s.product_name && s.product_name.toLowerCase().includes(filters.search.toLowerCase())) ||
            (s.lot_number && s.lot_number.toLowerCase().includes(filters.search.toLowerCase()));

        const dropdownCustomerMatch = !filters.customer ||
            s.customer_name === customers.find(c => c.id === parseInt(filters.customer))?.name;

        const dateMatch = (!filters.dateStart || s.sale_date >= filters.dateStart) &&
            (!filters.dateEnd || s.sale_date <= filters.dateEnd);

        return searchMatch && dateMatch && dropdownCustomerMatch;
    });

    return (
        <div className="space-y-6 animate-fade-in text-slate-800">
            {!isIntegrated && (
                <div className="flex justify-between items-center">
                    <h2 className="heading-industrial text-2xl flex items-center gap-2 text-slate-800">
                        <ShoppingCart className="h-6 w-6 text-[#107c10]" /> Satış
                    </h2>
                    <button
                        onClick={() => setShowForm(true)}
                        className="btn-primary-green flex items-center gap-2 shadow-sm"
                    >
                        <Plus className="h-5 w-5" /> Yeni Satış Kaydı
                    </button>
                </div>
            )}

            {isIntegrated && (
                <div className="flex justify-end items-center mb-2">
                    <button
                        onClick={() => setShowForm(true)}
                        className="btn-primary-green flex items-center gap-2 shadow-sm"
                    >
                        <Plus className="h-5 w-5" /> Yeni Satış Kaydı
                    </button>
                </div>
            )}

            {/* FILTER BAR */}
            <div className="card-industrial p-4 grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                <div className="md:col-span-1">
                    <label className="label-industrial block">Arama</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                            placeholder="Müşteri, Ürün veya LOT..."
                            className="input-industrial pl-9"
                            value={filters.search}
                            onChange={e => setFilters({ ...filters, search: e.target.value })}
                        />
                    </div>
                </div>
                <div>
                    <label className="label-industrial block">Müşteri</label>
                    <select
                        className="select-industrial"
                        value={filters.customer}
                        onChange={e => setFilters({ ...filters, customer: e.target.value })}
                    >
                        <option value="">Tümü</option>
                        {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                </div>
                <div className="flex gap-2 md:col-span-2">
                    <div className="flex-1">
                        <label className="label-industrial block">Başlangıç</label>
                        <input
                            type="date"
                            className="input-industrial"
                            value={filters.dateStart}
                            onChange={e => setFilters({ ...filters, dateStart: e.target.value })}
                        />
                    </div>
                    <div className="flex-1">
                        <label className="label-industrial block">Bitiş</label>
                        <input
                            type="date"
                            className="input-industrial"
                            value={filters.dateEnd}
                            onChange={e => setFilters({ ...filters, dateEnd: e.target.value })}
                        />
                    </div>
                </div>
            </div>

            {/* FORM MODAL */}
            {showForm && (
                <div className="modal-overlay-industrial flex items-center justify-center z-50 p-4">
                    <div className="modal-content-industrial w-full max-w-2xl overflow-hidden animate-fade-in">
                        <div className="modal-header-industrial flex justify-between items-center">
                            <h3 className="font-bold text-[#1d1d1f] flex items-center gap-2 uppercase tracking-wide text-sm">
                                {editingSale ? (
                                    <><FileText className="h-4 w-4 text-[#0071e3]" /> Satış Kaydı Güncelle</>
                                ) : (
                                    <><Plus className="h-4 w-4 text-[#0071e3]" /> Yeni Satış Kaydı</>
                                )}
                            </h3>
                            <button onClick={closeForm} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSubmit} className="modal-body-industrial grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[80vh] overflow-y-auto">
                            <div className="md:col-span-2">
                                <label className="label-industrial block">Müşteri</label>
                                <select
                                    required
                                    className="select-industrial"
                                    value={formData.customerId}
                                    onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                                >
                                    <option value="">Seçiniz...</option>
                                    {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                            </div>

                            <div className="md:col-span-2">
                                <label className="label-industrial block">Satılacak Ürün / Parti (LOT)</label>
                                <select
                                    required
                                    disabled={!!editingSale}
                                    className={`select-industrial font-mono text-xs ${editingSale ? 'bg-gray-100 cursor-not-allowed opacity-75' : ''}`}
                                    value={formData.productionId}
                                    onChange={e => {
                                        const prodId = e.target.value;
                                        const prod = productions.find(p => p.id === parseInt(prodId));
                                        setFormData(prev => ({
                                            ...prev,
                                            productionId: prodId,
                                            // Default to production's packaging when selecting a LOT
                                            packagingId: prod?.packaging_id || prev.packagingId
                                        }));
                                    }}
                                >
                                    <option value="">Seçiniz...</option>
                                    {productions.map(p => {
                                        let currentStock = 0;
                                        inventory.forEach(item => {
                                            if (item.lots) {
                                                const lotQty = item.lots
                                                    .filter(l => l.lot_no === p.lot_number)
                                                    .reduce((sum, l) => sum + (parseFloat(l.qty) || 0), 0);
                                                currentStock += lotQty;
                                            }
                                        });
                                        if (currentStock <= 0.01) return null;
                                        return <option key={p.id} value={p.id}>{p.product_name} - LOT: {p.lot_number} ({currentStock} kg)</option>;
                                    })}
                                </select>
                            </div>

                            <div>
                                <label className="label-industrial block">Satış Miktarı (kg)</label>
                                <input
                                    required type="number" step="0.01"
                                    className="input-industrial"
                                    value={formData.quantity}
                                    onChange={e => setFormData({ ...formData, quantity: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="label-industrial block">Birim Fiyat</label>
                                <div className="flex gap-2">
                                    <input
                                        required type="number" step="0.01"
                                        className="input-industrial flex-1"
                                        value={formData.unitPrice}
                                        onChange={e => setFormData({ ...formData, unitPrice: e.target.value })}
                                    />
                                    <select
                                        className="select-industrial w-24"
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
                                <label className="label-industrial block">Ambalaj</label>
                                <select
                                    required
                                    className="select-industrial text-xs"
                                    value={formData.packagingId}
                                    onChange={e => setFormData({ ...formData, packagingId: e.target.value })}
                                >
                                    <option value="">Seçiniz...</option>
                                    {inventory.filter(i => i.type === 'Ambalaj').map(i => (
                                        <option key={i.id} value={i.id}>{i.name} ({i.capacity_value} {i.capacity_unit})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="label-industrial block">Nakliye (Toplam)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number" step="0.01"
                                        className="input-industrial flex-1"
                                        value={formData.shippingCost}
                                        onChange={e => setFormData({ ...formData, shippingCost: e.target.value })}
                                    />
                                    <select
                                        className="select-industrial w-24"
                                        value={formData.shippingCurrency}
                                        onChange={e => setFormData({ ...formData, shippingCurrency: e.target.value })}
                                    >
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="TRY">TRY</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="label-industrial block">Genel Gider (kg başı)</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number" step="0.001"
                                        className="input-industrial flex-1"
                                        value={formData.overheadPerKg}
                                        onChange={e => setFormData({ ...formData, overheadPerKg: e.target.value })}
                                    />
                                    <select
                                        className="select-industrial w-24"
                                        value={formData.overheadCurrency}
                                        onChange={e => setFormData({ ...formData, overheadCurrency: e.target.value })}
                                    >
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="TRY">TRY</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="label-industrial block">Faiz Oranı (Aylık %)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="input-industrial"
                                    value={formData.interestRate}
                                    onChange={e => setFormData({ ...formData, interestRate: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="label-industrial block">Vade (Gün)</label>
                                <input
                                    type="number"
                                    className="input-industrial"
                                    value={formData.paymentTerm}
                                    onChange={e => setFormData({ ...formData, paymentTerm: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="label-industrial block">Satış Tarihi</label>
                                <input
                                    type="date" required
                                    className="input-industrial"
                                    value={formData.saleDate}
                                    onChange={e => setFormData({ ...formData, saleDate: e.target.value })}
                                />
                            </div>

                            {/* LIVE CALCULATION SUMMARY */}
                            <div className="md:col-span-2 bg-[#f5f5f7] rounded-[6px] p-4 text-[#1d1d1f] border border-[#d2d2d7] space-y-3">
                                <div className="flex justify-between items-center pb-2 border-b border-[#d2d2d7]">
                                    <span className="text-xs font-bold text-[#86868b] uppercase tracking-wide">Finansal Özet (Tahmini)</span>
                                    <TrendingUp size={14} className="text-green-600" />
                                </div>
                                <div className="grid grid-cols-3 gap-4">
                                    <div className="bg-white p-3 rounded-[4px] border border-[#d2d2d7]">
                                        <div className="text-[10px] text-[#86868b] font-bold uppercase mb-1 tracking-wider">TOPLAM MALİYET</div>
                                        <div className="text-base font-bold font-mono text-[#1d1d1f]">
                                            {calcResult.totalCost.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} {formData.currency}
                                        </div>
                                        <div className="text-[9px] text-[#86868b]">({calcResult.unitCost.toFixed(3)} {formData.currency}/kg)</div>
                                    </div>
                                    <div className="bg-white p-3 rounded-[4px] border border-[#d2d2d7]">
                                        <div className="text-[10px] text-[#86868b] font-bold uppercase mb-1 tracking-wider">TAHMİNİ KÂR</div>
                                        <div className={`text-base font-bold font-mono ${calcResult.profit >= 0 ? 'text-[#107c10]' : 'text-[#d21e1e]'}`}>
                                            {calcResult.profit.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} {formData.currency}
                                        </div>
                                    </div>
                                    <div className="bg-white p-3 rounded-[4px] border border-[#d2d2d7]">
                                        <div className="text-[10px] text-[#86868b] font-bold uppercase mb-1 tracking-wider">KÂR MARJI</div>
                                        <div className={`text-base font-bold font-mono ${calcResult.margin >= 20 ? 'text-[#107c10]' : calcResult.margin > 10 ? 'text-[#e67e22]' : 'text-[#d21e1e]'}`}>
                                            %{calcResult.margin.toFixed(1)}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-[#86868b] border-t border-[#d2d2d7] pt-2">
                                    <Info size={12} />
                                    <span>Maliyet; hammadde, ambalaj, nakliye ve vade finansmanını içerir.</span>
                                </div>
                            </div>

                            <div className="modal-footer-industrial md:col-span-2">
                                <button type="button" onClick={closeForm} className="btn-secondary">İptal</button>
                                <button type="submit" className="btn-primary-green flex items-center gap-2">
                                    <CheckCircle size={18} /> {editingSale ? 'Güncelle' : 'Satışı Kaydet'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* SALES LIST */}
            <div className="rounded-[6px] border border-[#d2d2d7] overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                    <table className="table-industrial">
                        <thead>
                            <tr>
                                <th className="text-left py-3 px-4">Tarih</th>
                                <th className="text-left py-3 px-4">Müşteri</th>
                                <th className="text-left py-3 px-4">Ürün Kodu</th>
                                <th className="text-left py-3 px-4">Ürün Adı</th>
                                <th className="text-left py-3 px-4">LOT No</th>
                                <th className="text-right py-3 px-4">Miktar (kg)</th>
                                <th className="text-right py-3 px-4">Birim Fiyat</th>
                                <th className="text-right py-3 px-4">Toplam</th>
                                <th className="text-right py-3 px-4">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-[#d2d2d7]">
                            {filteredSales.map(sale => (
                                <tr key={sale.id} className="hover:bg-[#f5f5f7] transition-colors">
                                    <td className="px-4 py-3 text-[#1d1d1f] font-medium">{new Date(sale.sale_date).toLocaleDateString('tr-TR')}</td>
                                    <td className="px-4 py-3 text-[#1d1d1f]">{sale.customer_name}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className="badge-industrial badge-industrial-gray font-mono">
                                            {inventory.find(i => i.name === sale.product_name)?.product_code || 'CODE-???'}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-[#1d1d1f] font-medium">{sale.product_name}</td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <span className="badge-industrial badge-industrial-blue font-mono">
                                            {sale.lot_number}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right font-mono font-bold text-[#1d1d1f] whitespace-nowrap">{sale.quantity}</td>
                                    <td className="px-4 py-3 text-right font-mono text-[#86868b] whitespace-nowrap">{sale.unit_price} {sale.currency}</td>
                                    <td className="px-4 py-3 text-right font-bold text-[#0071e3] font-mono whitespace-nowrap">
                                        {(sale.quantity * sale.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {sale.currency}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        <div className="flex justify-end gap-1">
                                            <button
                                                onClick={() => handleEdit(sale)}
                                                className="p-1 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                                title="Düzenle"
                                            >
                                                <FileText className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => onDeleteSale(sale.id)}
                                                className="p-1 text-red-600 hover:bg-red-50 rounded transition-colors"
                                                title="Sil"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
