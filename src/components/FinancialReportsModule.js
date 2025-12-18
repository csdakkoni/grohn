import React, { useState, useMemo } from 'react';
import { DollarSign, Calendar, TrendingUp, TrendingDown, PieChart, BarChart2, Filter, Package, Users, ShoppingBag, Search } from 'lucide-react';
import * as XLSX from 'xlsx';

export default function FinancialReportsModule({ sales, productions, purchases, inventory, accounts, exchangeRates = { USD: 1, EUR: 0.92, TRY: 34.50 } }) {
    const [activeTab, setActiveTab] = useState('summary'); // 'summary', 'purchasing_report', 'inventory', 'suppliers', 'sales'
    const [dateRange, setDateRange] = useState('month'); // 'month', 'year', 'all', 'custom'
    const [startDate, setStartDate] = useState(new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
    const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
    const [showCostDetails, setShowCostDetails] = useState(false); // Toggle for detailed cost columns
    const [currency, setCurrency] = useState('USD');
    const [searchTerm, setSearchTerm] = useState(''); // Global Search Term

    // Helper to parse numbers
    const parseVal = (val) => {
        if (!val) return 0;
        if (typeof val === 'number') return val;
        return parseFloat(val.toString().replace(',', '.')) || 0;
    };

    // Filter Data based on Date Range AND Search Term
    const filteredData = useMemo(() => {
        let start = new Date(0);
        let end = new Date();

        if (dateRange === 'month') {
            start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        } else if (dateRange === 'year') {
            start = new Date(new Date().getFullYear(), 0, 1);
        } else if (dateRange === 'custom') {
            start = new Date(startDate);
            end = new Date(endDate);
            end.setHours(23, 59, 59);
        } else if (dateRange === 'all') {
            start = new Date(0); // Epoch
            end = new Date(); // Now
        } else if (dateRange === 'last_month') {
            const now = new Date();
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0); // Last day of last month
        } else if (dateRange === 'last_3_months') {
            const now = new Date();
            start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
        } else if (dateRange === 'last_6_months') {
            const now = new Date();
            start = new Date(now.getFullYear(), now.getMonth() - 6, 1);
        }

        const search = searchTerm.toLowerCase();

        const fSales = sales.filter(s => {
            const d = new Date(s.sale_date || s.created_at);
            const matchesDate = d >= start && d <= end;
            const matchesSearch = !search ||
                (s.customer_name && s.customer_name.toLowerCase().includes(search)) ||
                (s.product_name && s.product_name.toLowerCase().includes(search));
            return matchesDate && matchesSearch;
        });

        const fProductions = productions.filter(p => {
            const d = new Date(p.production_date);
            const matchesDate = d >= start && d <= end && p.status === 'Completed';
            const matchesSearch = !search ||
                (p.lot_number && p.lot_number.toLowerCase().includes(search));
            // Could search recipe name if available in p
            return matchesDate && matchesSearch;
        });

        const fPurchases = purchases.filter(p => {
            const d = new Date(p.created_at);
            const matchesDate = d >= start && d <= end;
            const supplier = accounts.find(a => a.id === p.supplier_id);
            const matchesSearch = !search ||
                (p.item_name && p.item_name.toLowerCase().includes(search)) ||
                (supplier && supplier.name.toLowerCase().includes(search));
            return matchesDate && matchesSearch;
        });

        return { sales: fSales, productions: fProductions, purchases: fPurchases };
    }, [sales, productions, purchases, dateRange, startDate, endDate, searchTerm, accounts]);

    // --- REPORTS CALCULATIONS ---

    // 1. Financial Summary (P&L)
    const financials = useMemo(() => {
        let revenue = 0;
        let cogs = 0;

        filteredData.sales.forEach(s => {
            revenue += parseVal(s.total_amount); // Assuming normalized currency or simple sum for now
            // Simplified COGS logic: 70% of revenue if no direct link (placeholder)
            // In real app, link to production cost
            cogs += parseVal(s.total_amount) * 0.7;
        });

        const grossProfit = revenue - cogs;
        const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

        const netProfit = grossProfit; // Simplified for now
        return { revenue, cogs, grossProfit, margin, netProfit };
    }, [filteredData.sales]);

    // 2. Inventory Valuation
    const inventoryValuation = useMemo(() => {
        let totalValue = 0;
        const items = inventory.map(item => {
            const qty = item.lots?.reduce((sum, lot) => sum + parseVal(lot.qty), 0) || 0;
            const value = qty * parseVal(item.cost);
            totalValue += value;
            return { ...item, totalQty: qty, totalValue: value };
        }).sort((a, b) => b.totalValue - a.totalValue);
        return { totalValue, items };
    }, [inventory]);

    // 3. Supplier Performance
    const supplierPerformance = useMemo(() => {
        const stats = {};
        filteredData.purchases.forEach(p => {
            if (!stats[p.supplier_id]) {
                const supplier = accounts.find(a => a.id === p.supplier_id);
                stats[p.supplier_id] = {
                    name: supplier?.name || 'Bilinmeyen',
                    count: 0,
                    total: 0,
                    items: {}
                };
            }
            stats[p.supplier_id].count++;
            stats[p.supplier_id].total += parseVal(p.total);
        });
        return Object.values(stats).sort((a, b) => b.total - a.total);
    }, [filteredData.purchases, accounts]);

    // 4. Sales Analysis
    const salesAnalysis = useMemo(() => {
        const byCustomer = {};
        filteredData.sales.forEach(s => {
            const name = s.customer_name || 'Bilinmeyen';
            if (!byCustomer[name]) byCustomer[name] = { name, count: 0, total: 0 };
            byCustomer[name].count++;
            byCustomer[name].total += parseVal(s.total_amount);
        });
        return Object.values(byCustomer).sort((a, b) => b.total - a.total);
    }, [filteredData.sales]);

    // 5. Cost Breakdown (based on Productions in this period)
    const costBreakdown = useMemo(() => {
        let raw = 0;
        let pkg = 0;
        let ship = 0;
        let overhead = 0;
        let finance = 0;

        filteredData.productions.forEach(p => {
            let r = parseVal(p.raw_material_cost);
            let pk = parseVal(p.packaging_cost);
            let s = parseVal(p.shipping_cost);
            let o = parseVal(p.overhead_cost);
            let f = parseVal(p.financing_cost);

            // Currency conversion
            if (p.currency !== currency) {
                const rate = (p.currency === 'TRY' && currency === 'USD') ? 1 / 34.50 :
                    (p.currency === 'USD' && currency === 'TRY') ? 34.50 : 1;
                r *= rate; pk *= rate; s *= rate; o *= rate; f *= rate;
            }

            raw += r;
            pkg += pk;
            ship += s;
            overhead += o;
            finance += f;
        });

        const total = raw + pkg + ship + overhead + finance;
        return { raw, pkg, ship, overhead, finance, total };
    }, [filteredData.productions, currency]);

    const formatMoney = (amount) => {
        return amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
    };


    // --- EXPORTS ---
    const exportInventory = () => {
        const data = inventoryValuation.items.map(i => ({
            'Stok Adı': i.name,
            'Tip': i.type,
            'Miktar': i.totalQty,
            'Birim': i.unit,
            'Birim Maliyet': i.cost,
            'Toplam Değer': i.totalValue
        }));
        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Stok Degerleme');
        XLSX.writeFile(wb, 'stok_degerleme.xlsx');
    };

    const exportPurchasingReport = () => {
        const data = filteredData.purchases.map(p => {
            const supplier = accounts.find(a => a.id === p.supplier_id);
            const item = inventory.find(i => i.name === p.item_name);
            const unit = item?.unit || '';

            // Smart formatting based on unit
            let digits = 2;
            if (['adet', 'koli', 'paket'].includes(unit.toLowerCase())) {
                digits = 0;
            }


            return {
                'Tarih': new Date(p.created_at).toLocaleDateString('tr-TR'),
                'Tedarikçi': supplier?.name || '-',
                'Ürün': p.item_name || '-',
                'Miktar': parseFloat(parseFloat(p.qty).toFixed(digits)), // Round first then convert to number
                'Birim': unit,
                'Birim Fiyat': parseFloat(p.price),
                'Vade': parseFloat(p.payment_term || 0),
                'Toplam': parseFloat(parseFloat(p.qty).toFixed(digits)) * parseFloat(p.price), // Recalculate total based on rounded qty
                'Para Birimi': p.currency
            };
        });

        // Calculate Totals for Excel Footer
        const totals = {};
        filteredData.purchases.forEach(p => {
            const item = inventory.find(i => i.name === p.item_name);
            const unit = item?.unit || '';
            let digits = 2;
            if (['adet', 'koli', 'paket'].includes(unit?.toLowerCase() || '')) digits = 0;
            const total = parseFloat(parseFloat(p.qty).toFixed(digits)) * p.price;

            if (!totals[p.currency]) totals[p.currency] = 0;
            totals[p.currency] += total;
        });

        // Append empty row
        data.push({});

        // Append Total Rows
        Object.entries(totals).forEach(([cur, val]) => {
            data.push({
                'Tarih': '',
                'Tedarikçi': '', // Empty cells for spacing
                'Ürün': '',
                'Miktar': '',
                'Birim': '',
                'Birim Fiyat': '',
                'Vade': `TOPLAM ${cur}:`,
                'Toplam': parseFloat(val.toFixed(2)), // Ensure number format
                'Para Birimi': cur
            });
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Satin_Alma_Raporu');
        XLSX.writeFile(wb, 'satin_alma_raporu.xlsx');
    };

    const exportSalesReport = () => {
        const data = filteredData.sales.map(s => {
            return {
                'Tarih': new Date(s.sale_date).toLocaleDateString('tr-TR'),
                'Müşteri': s.customer_name || '-',
                'Ürün': s.product_name || '-',
                'Lot No': productions.find(p => p.id === s.production_id)?.lot_number || '-',
                'Miktar': parseFloat(s.quantity),
                'Birim': (() => {
                    const prod = productions.find(p => p.id === s.production_id);
                    if (prod && prod.unit) return prod.unit;
                    const item = inventory.find(i => i.name === s.product_name);
                    return item?.unit || 'Adet';
                })(),
                'Birim Fiyat': parseFloat(s.unit_price),
                'Toplam': parseFloat(s.total_amount),
                'Para Birimi': s.currency,
                'Ödeme Durumu': s.payment_status || 'Bekliyor',
                'Üretim Birim Maliyet': parseFloat((() => {
                    const prod = productions.find(p => p.id === s.production_id);
                    if (!prod) return 0;
                    let prodTotalCost = (
                        (parseFloat(prod.raw_material_cost) || 0) +
                        (parseFloat(prod.packaging_cost) || 0) +
                        (parseFloat(prod.shipping_cost) || 0) +
                        (parseFloat(prod.overhead_cost) || 0) +
                        (parseFloat(prod.financing_cost) || 0)
                    );
                    let unitCost = prodTotalCost / parseFloat(prod.quantity || 1);
                    if (prod.currency !== s.currency) {
                        const rateToUSD = exchangeRates[prod.currency] ? 1 / exchangeRates[prod.currency] : 1;
                        const costInBase = unitCost / (exchangeRates[prod.currency] || 1);
                        unitCost = costInBase * (exchangeRates[s.currency] || 1);
                    }
                    return unitCost.toFixed(2);
                })()),
                'Üretim Toplam Maliyet': parseFloat((() => {
                    const prod = productions.find(p => p.id === s.production_id);
                    if (!prod) return 0;
                    let prodTotalCost = (
                        (parseFloat(prod.raw_material_cost) || 0) +
                        (parseFloat(prod.packaging_cost) || 0) +
                        (parseFloat(prod.shipping_cost) || 0) +
                        (parseFloat(prod.overhead_cost) || 0) +
                        (parseFloat(prod.financing_cost) || 0)
                    );
                    let unitCost = prodTotalCost / parseFloat(prod.quantity || 1);
                    if (prod.currency !== s.currency) {
                        const costInBase = unitCost / (exchangeRates[prod.currency] || 1);
                        unitCost = costInBase * (exchangeRates[s.currency] || 1);
                    }
                    return (unitCost * parseFloat(s.quantity)).toFixed(2);
                })()),
                'Kar': parseFloat((() => {
                    const prod = productions.find(p => p.id === s.production_id);
                    if (!prod) return 0;
                    let prodTotalCost = (
                        (parseFloat(prod.raw_material_cost) || 0) +
                        (parseFloat(prod.packaging_cost) || 0) +
                        (parseFloat(prod.shipping_cost) || 0) +
                        (parseFloat(prod.overhead_cost) || 0) +
                        (parseFloat(prod.financing_cost) || 0)
                    );
                    let unitCost = prodTotalCost / parseFloat(prod.quantity || 1);
                    if (prod.currency !== s.currency) {
                        const costInBase = unitCost / (exchangeRates[prod.currency] || 1);
                        unitCost = costInBase * (exchangeRates[s.currency] || 1);
                    }
                    const totalCost = unitCost * parseFloat(s.quantity);
                    return (parseFloat(s.total_amount) - totalCost).toFixed(2);
                })())
            };
        });

        const totals = {};
        const profitTotals = {};
        filteredData.sales.forEach(s => {
            if (!totals[s.currency]) totals[s.currency] = 0;
            totals[s.currency] += parseFloat(s.total_amount);

            const prod = productions.find(p => p.id === s.production_id);
            if (prod) {
                let prodTotalCost = (
                    (parseFloat(prod.raw_material_cost) || 0) +
                    (parseFloat(prod.packaging_cost) || 0) +
                    (parseFloat(prod.shipping_cost) || 0) +
                    (parseFloat(prod.overhead_cost) || 0) +
                    (parseFloat(prod.financing_cost) || 0)
                );
                let unitCost = prodTotalCost / parseFloat(prod.quantity || 1);
                if (prod.currency !== s.currency) {
                    const costInBase = unitCost / (exchangeRates[prod.currency] || 1);
                    unitCost = costInBase * (exchangeRates[s.currency] || 1);
                }
                const totalCost = unitCost * parseFloat(s.quantity);
                const profit = parseFloat(s.total_amount) - totalCost;

                if (!profitTotals[s.currency]) profitTotals[s.currency] = 0;
                profitTotals[s.currency] += profit;
            }
        });

        data.push({
            'Tarih': '', 'Müşteri': '', 'Ürün': '', 'Lot No': '', 'Miktar': '', 'Birim': '', 'Birim Fiyat': '',
            'Toplam': '', 'Para Birimi': '', 'Ödeme Durumu': '',
            'Üretim Birim Maliyet': '', 'Üretim Toplam Maliyet': '', 'Kar': ''
        });

        Object.entries(totals).forEach(([cur, val]) => {
            data.push({
                'Tarih': '', 'Müşteri': '', 'Ürün': '', 'Lot No': '', 'Miktar': '', 'Birim': '', 'Birim Fiyat': '',
                'Toplam': parseFloat(val.toFixed(2)),
                'Para Birimi': `TOPLAM ${cur}`,
                'Ödeme Durumu': '',
                'Üretim Birim Maliyet': '',
                'Üretim Toplam Maliyet': '',
                'Kar': profitTotals[cur] ? parseFloat(profitTotals[cur].toFixed(2)) : 0
            });
        });

        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Satis_Raporu');
        XLSX.writeFile(wb, 'satis_raporu.xlsx');
    };

    return (
        <div className="space-y-6">
            {/* Header & Filters */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <TrendingUp className="h-6 w-6 text-indigo-600" /> Raporlar
                </h2>
                <div className="flex bg-slate-100 p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('summary')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'summary' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                        Özet & Grafikler
                    </button>
                    <button
                        onClick={() => setActiveTab('purchasing_report')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'purchasing_report' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                        Satın Almalar
                    </button>
                    <button
                        onClick={() => setActiveTab('sales_report')}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'sales_report' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-600 hover:text-slate-800'}`}
                    >
                        Satış Raporu
                    </button>
                </div>
            </div>

            {/* DATE & SEARCH FILTERS */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Müşteri, Ürün veya Tedarikçi Ara..."
                        className="w-full pl-9 bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Date Range */}
                <div className="flex flex-wrap gap-2 justify-end items-center">
                    <Filter className="h-4 w-4 text-slate-400" />
                    <span className="text-xs font-medium text-slate-500 uppercase">Tarih:</span>
                    <select
                        className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
                        value={dateRange}
                        onChange={e => setDateRange(e.target.value)}
                    >
                        <option value="month">Bu Ay</option>
                        <option value="last_month">Geçen Ay</option>
                        <option value="last_3_months">Son 3 Ay</option>
                        <option value="last_6_months">Son 6 Ay</option>
                        <option value="year">Bu Yıl</option>
                        <option value="all">Tüm Zamanlar</option>
                        <option value="custom">Özel Aralık</option>
                    </select>

                    {dateRange === 'custom' && (
                        <div className="flex gap-2 items-center">
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="border border-slate-300 rounded px-2 py-1 text-sm text-slate-600"
                            />
                            <span className="text-slate-400">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="border border-slate-300 rounded px-2 py-1 text-sm text-slate-600"
                            />
                        </div>
                    )}
                </div>
            </div>

            {activeTab === 'summary' && (
                <>
                    {/* P&L Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
                            <div className="text-slate-500 text-sm font-medium mb-1">Toplam Gelir</div>
                            <div className="text-2xl font-bold text-slate-800">{formatMoney(financials.revenue)}</div>
                            <div className="text-xs text-green-600 flex items-center mt-1">
                                <TrendingUp className="h-3 w-3 mr-1" /> Satışlardan
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-red-500">
                            <div className="text-slate-500 text-sm font-medium mb-1">SMM (Maliyet)</div>
                            <div className="text-2xl font-bold text-slate-800">{formatMoney(financials.cogs)}</div>
                            <div className="text-xs text-red-600 flex items-center mt-1">
                                <TrendingDown className="h-3 w-3 mr-1" /> Üretim Maliyeti
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-indigo-500">
                            <div className="text-slate-500 text-sm font-medium mb-1">Brüt Kar</div>
                            <div className={`text-2xl font-bold ${financials.grossProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatMoney(financials.grossProfit)}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                                Marj: {financials.revenue > 0 ? ((financials.grossProfit / financials.revenue) * 100).toFixed(1) : 0}%
                            </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
                            <div className="text-slate-500 text-sm font-medium mb-1">Net Kar</div>
                            <div className={`text-2xl font-bold ${financials.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {formatMoney(financials.netProfit)}
                            </div>
                            <div className="text-xs text-slate-400 mt-1">
                                (Vergi öncesi)
                            </div>
                        </div>
                    </div>

                    {/* Charts Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Cost Breakdown Bar Chart */}
                        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <PieChart className="h-5 w-5 text-indigo-600" /> Üretim Maliyet Dağılımı
                            </h3>

                            {costBreakdown.total > 0 ? (
                                <div className="space-y-4">
                                    {[
                                        { label: 'Hammadde', value: costBreakdown.raw, color: 'bg-blue-500' },
                                        { label: 'Ambalaj', value: costBreakdown.pkg, color: 'bg-purple-500' },
                                        { label: 'Nakliye', value: costBreakdown.ship, color: 'bg-orange-500' },
                                        { label: 'Genel Gider', value: costBreakdown.overhead, color: 'bg-slate-500' },
                                        { label: 'Finansman', value: costBreakdown.finance, color: 'bg-red-500' }
                                    ].map((item, idx) => {
                                        const percent = (item.value / costBreakdown.total) * 100;
                                        return (
                                            <div key={idx}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="text-slate-600 font-medium">{item.label}</span>
                                                    <span className="text-slate-800 font-bold">{formatMoney(item.value)} ({percent.toFixed(1)}%)</span>
                                                </div>
                                                <div className="w-full bg-slate-100 rounded-full h-2.5">
                                                    <div
                                                        className={`h-2.5 rounded-full ${item.color}`}
                                                        style={{ width: `${percent}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="text-center py-10 text-slate-400">
                                    Bu dönemde üretim verisi bulunamadı.
                                </div>
                            )}
                        </div>

                        {/* Profitability Analysis */}
                        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
                            <h3 className="font-bold text-slate-800 mb-6 flex items-center gap-2">
                                <BarChart2 className="h-5 w-5 text-green-600" /> Karlılık Analizi
                            </h3>

                            <div className="space-y-6">
                                <div className="p-4 bg-green-50 rounded-lg border border-green-100">
                                    <div className="text-sm text-green-800 font-bold mb-2">En Karlı Ürün (Birim Başına)</div>
                                    {/* Logic to find most profitable product */}
                                    {(() => {
                                        if (filteredData.productions.length === 0) return <div className="text-sm text-slate-500">-</div>;
                                        const sorted = [...filteredData.productions].sort((a, b) => (b.profit_amount || 0) - (a.profit_amount || 0));
                                        const top = sorted[0];
                                        return (
                                            <div>
                                                <div className="text-lg font-bold text-green-700">{top.lot_number}</div>
                                                <div className="text-sm text-green-600">Kar: {parseVal(top.profit_amount).toFixed(2)} {top.currency}</div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div className="p-4 bg-indigo-50 rounded-lg border border-indigo-100">
                                    <div className="text-sm text-indigo-800 font-bold mb-2">Ortalama Kar Marjı</div>
                                    {(() => {
                                        if (filteredData.productions.length === 0) return <div className="text-sm text-slate-500">-</div>;
                                        const totalMargin = filteredData.productions.reduce((sum, p) => sum + parseVal(p.profit_margin_percent), 0);
                                        const avg = totalMargin / filteredData.productions.length;
                                        return (
                                            <div className="text-2xl font-bold text-indigo-700">%{avg.toFixed(1)}</div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'purchasing_report' && (
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                    <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                        <div className="space-y-1">
                            <h3 className="font-bold text-slate-700">Satın Alma Raporu</h3>
                            <p className="text-xs text-slate-500">
                                {dateRange === 'all' ? 'Tüm Zamanlar' :
                                    dateRange === 'month' ? 'Bu Ay' :
                                        dateRange === 'year' ? 'Bu Yıl' :
                                            `${new Date(startDate).toLocaleDateString('tr-TR')} - ${new Date(endDate).toLocaleDateString('tr-TR')}`}
                            </p>
                        </div>
                        <button
                            onClick={exportPurchasingReport}
                            className="flex items-center gap-2 text-sm font-medium text-green-600 hover:bg-green-50 px-3 py-2 rounded-lg transition-colors"
                        >
                            <BarChart2 className="h-4 w-4" /> Excel'e Aktar
                        </button>
                    </div>

                    {/* SPENDING ANALYSIS SUMMARY */}
                    <div className="p-4 bg-slate-50 border-b border-slate-200 grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 1. Category Breakdown */}
                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Harcama Dağılımı (Kategori)</h4>
                            <div className="space-y-1">
                                {(() => {
                                    const cats = { 'Hammadde': {}, 'Ambalaj': {}, 'Diğer': {} };
                                    filteredData.purchases.forEach(p => {
                                        const item = inventory.find(i => i.name === p.item_name);
                                        const type = item?.type || 'Diğer';
                                        const catKey = ['Hammadde', 'Ambalaj'].includes(type) ? type : 'Diğer';

                                        // Calculate total consistent with row display
                                        const unit = item?.unit || '';
                                        let digits = 2;
                                        if (['adet', 'koli', 'paket'].includes(unit?.toLowerCase() || '')) digits = 0;
                                        const total = parseFloat(parseFloat(p.qty).toFixed(digits)) * p.price;

                                        if (!cats[catKey][p.currency]) cats[catKey][p.currency] = 0;
                                        cats[catKey][p.currency] += total;
                                    });

                                    return Object.entries(cats).map(([cat, curMap]) => {
                                        const parts = Object.entries(curMap).map(([cur, val]) =>
                                            `${val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${cur}`
                                        );
                                        if (parts.length === 0) return null;
                                        return (
                                            <div key={cat} className="flex justify-between text-sm">
                                                <span className="text-slate-600 font-medium">{cat}:</span>
                                                <span className="text-slate-800">{parts.join(' + ')}</span>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>

                        {/* 2. Quick Currency Stats */}
                        <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-col justify-center">
                            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Toplam Harcama</h4>
                            <div className="flex flex-wrap gap-3">
                                {(() => {
                                    const totals = {};
                                    filteredData.purchases.forEach(p => {
                                        const item = inventory.find(i => i.name === p.item_name);
                                        const unit = item?.unit || '';
                                        let digits = 2;
                                        if (['adet', 'koli', 'paket'].includes(unit?.toLowerCase() || '')) digits = 0;
                                        const total = parseFloat(parseFloat(p.qty).toFixed(digits)) * p.price;

                                        if (!totals[p.currency]) totals[p.currency] = 0;
                                        totals[p.currency] += total;
                                    });

                                    return Object.entries(totals).map(([cur, val]) => (
                                        <div key={cur} className="bg-indigo-50 px-3 py-1 rounded text-indigo-700 font-bold border border-indigo-100">
                                            {val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {cur}
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                                <tr>
                                    <th className="p-4">Tarih</th>
                                    <th className="p-4">Tedarikçi</th>
                                    <th className="p-4">Ürün / Açıklama</th>
                                    <th className="p-4 text-right">Miktar</th>
                                    <th className="p-4 text-center">Birim</th>
                                    <th className="p-4 text-right">Birim Fiyat</th>
                                    <th className="p-4 text-right">Vade</th>
                                    <th className="p-4 text-right">Toplam</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {filteredData.purchases.length > 0 ? (
                                    filteredData.purchases.map(p => {
                                        const supplier = accounts.find(a => a.id === p.supplier_id);
                                        const item = inventory.find(i => i.name === p.item_name);
                                        const unit = item?.unit || '';

                                        // Smart formatting based on unit
                                        let digits = 2;
                                        if (['adet', 'koli', 'paket'].includes(unit?.toLowerCase() || '')) {
                                            digits = 0;
                                        }
                                        const formattedQty = parseFloat(p.qty).toLocaleString('tr-TR', { minimumFractionDigits: 0, maximumFractionDigits: digits, useGrouping: false });

                                        // Recalculate total based on displayed quantity logic to fix "20.01 * 10 = 200.1" issue
                                        // We use the same rounding logic as formattedQty
                                        const roundedQty = parseFloat(parseFloat(p.qty).toFixed(digits));
                                        const calculatedTotal = roundedQty * p.price;

                                        return (
                                            <tr key={p.id} className="hover:bg-slate-50">
                                                <td className="p-4 text-slate-600">{new Date(p.created_at).toLocaleDateString('tr-TR')}</td>
                                                <td className="p-4 font-medium text-slate-900">{supplier?.name || '-'}</td>
                                                <td className="p-4 text-slate-800">{p.item_name}</td>
                                                <td className="p-4 text-right font-mono text-slate-600">
                                                    {formattedQty}
                                                </td>
                                                <td className="p-4 text-center text-xs text-slate-500 font-medium">
                                                    {unit}
                                                </td>
                                                <td className="p-4 text-right font-mono text-slate-600">
                                                    {parseFloat(p.price).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {p.currency}
                                                </td>
                                                <td className="p-4 text-right font-mono text-slate-600">
                                                    {p.payment_term || 0} Gün
                                                </td>
                                                <td className="p-4 text-right font-mono font-bold text-indigo-600">
                                                    {calculatedTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {p.currency}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="8" className="p-8 text-center text-slate-400">
                                            Seçilen tarih aralığında ve arama kriterlerinde satın alma kaydı bulunamadı.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-slate-100 font-bold text-slate-700 border-t-2 border-slate-300">
                                <tr>
                                    <td colSpan="4" className="p-4 text-right align-top">Para Birimi Bazlı Toplamlar:</td>
                                    <td colSpan="4" className="p-4 bg-slate-50">
                                        <div className="flex flex-col gap-2 items-end">
                                            {(() => {
                                                const totals = {};
                                                filteredData.purchases.forEach(p => {
                                                    const item = inventory.find(i => i.name === p.item_name);
                                                    const unit = item?.unit || '';
                                                    let digits = 2;
                                                    if (['adet', 'koli', 'paket'].includes(unit?.toLowerCase() || '')) digits = 0;
                                                    const total = parseFloat(parseFloat(p.qty).toFixed(digits)) * p.price;

                                                    if (!totals[p.currency]) totals[p.currency] = 0;
                                                    totals[p.currency] += total;
                                                });

                                                if (Object.keys(totals).length === 0) return <div className="text-slate-400">Veri yok</div>;

                                                return Object.entries(totals).map(([cur, val]) => (
                                                    <div key={cur} className="flex justify-between w-full max-w-xs border-b border-slate-200 pb-1 last:border-0">
                                                        <span className="text-slate-500 font-medium mr-4">Toplam {cur}:</span>
                                                        <span className="text-indigo-700 text-lg">
                                                            {val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </span>
                                                    </div>
                                                ));
                                            })()}
                                        </div>
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                </div>
            )}

            {activeTab === 'sales_report' && (
                <div className="space-y-6">
                    {/* KPI CARDS for Sales Report */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        {(() => {
                            // Calculate totals for currently filtered sales
                            let totalRevenue = 0;
                            let totalCost = 0;
                            let totalProfit = 0;

                            filteredData.sales.forEach(s => {
                                // Convert to BASE currency (using USD as base or TRY, here assume we sum in selected view or just sum raw if currency matches? 
                                // Better: Sum in specific currency or convert all to TRY for KPI.
                                // Let's convert ALL to TRY for the KPI cards to have a unified view.
                                const rate = exchangeRates[s.currency] || 1;
                                const baseRate = exchangeRates['TRY'] || 34.5; // Target is TRY
                                // Amount in USD (Base) = Amount / Rate
                                // Amount in TRY = Amount in USD * TRY_Rate

                                const revenueInTry = (parseFloat(s.total_amount) / rate) * baseRate;
                                totalRevenue += revenueInTry;

                                // Cost
                                const prod = productions.find(p => p.id === s.production_id);
                                if (prod) {
                                    let prodTotal = (
                                        (parseFloat(prod.raw_material_cost) || 0) +
                                        (parseFloat(prod.packaging_cost) || 0) +
                                        (parseFloat(prod.shipping_cost) || 0) +
                                        (parseFloat(prod.overhead_cost) || 0) +
                                        (parseFloat(prod.financing_cost) || 0)
                                    );
                                    let unitCost = prodTotal / parseFloat(prod.quantity || 1);

                                    const prodRate = exchangeRates[prod.currency] || 1;
                                    const costInTry = (unitCost * parseFloat(s.quantity) / prodRate) * baseRate;
                                    totalCost += costInTry;
                                    totalProfit += (revenueInTry - costInTry);
                                } else {
                                    // If no cost info, profit = revenue (technically wrong but robust fallback) or 0 cost
                                    totalProfit += revenueInTry;
                                }
                            });

                            const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

                            return (
                                <>
                                    <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-indigo-500">
                                        <div className="text-slate-500 text-xs font-bold uppercase">Toplam Satış (TRY)</div>
                                        <div className="text-2xl font-bold text-slate-800">{totalRevenue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-red-500">
                                        <div className="text-slate-500 text-xs font-bold uppercase">Toplam Maliyet (TRY)</div>
                                        <div className="text-xl font-bold text-slate-700">{totalCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-green-500">
                                        <div className="text-slate-500 text-xs font-bold uppercase">Net Kar (TRY)</div>
                                        <div className="text-2xl font-bold text-green-600">{totalProfit.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</div>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl shadow-sm border-l-4 border-blue-400">
                                        <div className="text-slate-500 text-xs font-bold uppercase">Ortalama Marj</div>
                                        <div className="text-2xl font-bold text-blue-600">%{margin.toFixed(1)}</div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* MONTHLY TREND CHART (Simple CSS Bar Chart) */}
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <BarChart2 className="h-5 w-5 text-indigo-600" /> Aylık Satış Trendi (Son 6 Ay)
                        </h3>
                        <div className="flex items-end gap-2 h-40 pt-4 pb-2">
                            {(() => {
                                // Group by Month
                                const months = {};
                                // Init last 6 months
                                for (let i = 5; i >= 0; i--) {
                                    const d = new Date();
                                    d.setMonth(d.getMonth() - i);
                                    const key = d.toISOString().slice(0, 7); // YYYY-MM
                                    months[key] = 0;
                                }

                                sales.forEach(s => {
                                    const key = s.sale_date.slice(0, 7);
                                    if (months[key] !== undefined) {
                                        const rate = exchangeRates[s.currency] || 1;
                                        const baseRate = exchangeRates['TRY'] || 34.5;
                                        months[key] += (parseFloat(s.total_amount) / rate) * baseRate;
                                    }
                                });

                                const maxVal = Math.max(...Object.values(months), 1);

                                return Object.entries(months).map(([m, val]) => (
                                    <div key={m} className="flex-1 flex flex-col items-center group relative">
                                        <div
                                            className="w-full bg-indigo-100 dark:bg-indigo-900 rounded-t-sm hover:bg-indigo-200 transition-all relative group-hover:shadow-lg"
                                            style={{ height: `${(val / maxVal) * 100}%` }}
                                        >
                                            {/* Tooltip */}
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-800 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10">
                                                {val.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-1 rotate-0">{m.split('-')[1]}</div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>

                    <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                        <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
                            <div className="space-y-1">
                                <h3 className="font-bold text-slate-700">Satış Raporu</h3>
                                <p className="text-xs text-slate-500">
                                    {dateRange === 'all' ? 'Tüm Zamanlar' :
                                        dateRange === 'month' ? 'Bu Ay' :
                                            dateRange === 'last_month' ? 'Geçen Ay' :
                                                dateRange === 'last_3_months' ? 'Son 3 Ay' :
                                                    dateRange === 'last_6_months' ? 'Son 6 Ay' :
                                                        dateRange === 'year' ? 'Bu Yıl' :
                                                            `${new Date(startDate).toLocaleDateString('tr-TR')} - ${new Date(endDate).toLocaleDateString('tr-TR')}`}
                                </p>
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-600 hover:text-indigo-600 transition-colors">
                                    <input
                                        type="checkbox"
                                        checked={showCostDetails}
                                        onChange={e => setShowCostDetails(e.target.checked)}
                                        className="rounded text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="font-medium">Maliyet & Kar Göster</span>
                                </label>
                                <button
                                    onClick={exportSalesReport}
                                    className="flex items-center gap-2 text-sm font-medium text-green-600 hover:bg-green-50 px-3 py-2 rounded-lg transition-colors"
                                >
                                    <BarChart2 className="h-4 w-4" /> Excel'e Aktar
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-sm text-left">
                                <thead className="bg-slate-50 text-slate-600 font-bold uppercase text-xs">
                                    <tr>
                                        <th className="p-4">Tarih</th>
                                        <th className="p-4">Müşteri</th>
                                        <th className="p-4">Ürün</th>
                                        <th className="p-4">Lot No</th>
                                        <th className="p-4 text-right">Miktar</th>
                                        <th className="p-4 text-right">Birim Fiyat</th>
                                        <th className="p-4 text-right">Toplam</th>
                                        {showCostDetails && (
                                            <>
                                                <th className="p-4 text-right bg-slate-100">Üretim Birim Mal.</th>
                                                <th className="p-4 text-right bg-slate-100">Üretim Toplam Mal.</th>
                                                <th className="p-4 text-right bg-slate-100">Kar</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {filteredData.sales.length > 0 ? (
                                        filteredData.sales.map(s => {
                                            // Calculate Cost & Profit for Row
                                            const prod = productions.find(p => p.id === s.production_id);
                                            let unitCost = 0;
                                            let totalCost = 0;
                                            let profit = 0;

                                            if (prod) {
                                                let prodTotal = (
                                                    (parseFloat(prod.raw_material_cost) || 0) +
                                                    (parseFloat(prod.packaging_cost) || 0) +
                                                    (parseFloat(prod.shipping_cost) || 0) +
                                                    (parseFloat(prod.overhead_cost) || 0) +
                                                    (parseFloat(prod.financing_cost) || 0)
                                                );
                                                unitCost = prodTotal / parseFloat(prod.quantity || 1);
                                                // Convert
                                                if (prod.currency !== s.currency) {
                                                    const costInBase = unitCost / (exchangeRates[prod.currency] || 1);
                                                    unitCost = costInBase * (exchangeRates[s.currency] || 1);
                                                }
                                                totalCost = unitCost * parseFloat(s.quantity);
                                                profit = parseFloat(s.total_amount) - totalCost;
                                            }

                                            return (
                                                <tr key={s.id} className="hover:bg-slate-50">
                                                    <td className="p-4 text-slate-600">{new Date(s.sale_date).toLocaleDateString('tr-TR')}</td>
                                                    <td className="p-4 font-medium text-slate-900">{s.customer_name}</td>
                                                    <td className="p-4 text-slate-800">{s.product_name}</td>
                                                    <td className="p-4 font-mono text-xs text-slate-500">{prod?.lot_number || '-'}</td>
                                                    <td className="p-4 text-right font-mono text-slate-600">{s.quantity}</td>
                                                    <td className="p-4 text-right font-mono text-slate-600">
                                                        {parseFloat(s.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {s.currency}
                                                    </td>
                                                    <td className="p-4 text-right font-mono font-bold text-green-600">
                                                        {parseFloat(s.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {s.currency}
                                                    </td>
                                                    {showCostDetails && (
                                                        <td className="p-4 text-right font-mono text-slate-500 bg-slate-50 border-l border-slate-100">
                                                            <div className="text-xs">{unitCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {s.currency}</div>
                                                        </td>
                                                    )}
                                                    {showCostDetails && (
                                                        <td className="p-4 text-right font-mono text-slate-500 bg-slate-50 border-l border-slate-100">
                                                            <div className="font-bold">{totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {s.currency}</div>
                                                        </td>
                                                    )}
                                                    {showCostDetails && (
                                                        <td className={`p-4 text-right font-mono font-bold border-l border-slate-100 ${profit >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                            {profit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {s.currency}
                                                        </td>
                                                    )}
                                                </tr>
                                            )
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={showCostDetails ? "10" : "7"} className="p-8 text-center text-slate-400">
                                                Seçilen tarih aralığında ve arama kriterlerinde satış bulunamadı.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-slate-50 border-t border-slate-200 font-bold text-slate-800">
                                    {Object.entries((() => {
                                        const totals = {};
                                        filteredData.sales.forEach(s => {
                                            if (!totals[s.currency]) totals[s.currency] = 0;
                                            totals[s.currency] += parseFloat(s.total_amount);
                                        });
                                        return totals;
                                    })()).map(([currency, total]) => (
                                        <tr key={currency}>
                                            <td colSpan="5" className="p-4 text-right uppercase text-xs text-slate-500 tracking-wider">
                                                Toplam {currency}:
                                            </td>
                                            <td className="p-4 text-right font-mono text-green-700">
                                                {total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                                            </td>
                                            {showCostDetails && <td colSpan="2"></td>}
                                        </tr>
                                    ))}
                                </tfoot>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
