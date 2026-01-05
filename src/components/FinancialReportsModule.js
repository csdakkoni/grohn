import React, { useState, useMemo } from 'react';
import { DollarSign, Calendar, TrendingUp, TrendingDown, PieChart, BarChart2, Filter, Package, Users, ShoppingBag, Search, BarChart3 } from 'lucide-react';
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
            const saleRev = parseVal(s.total_amount);
            revenue += saleRev;

            // NEW: Use cost columns directly from sales table if available (p_total_production_cost was stored as total_production_cost in DB)
            if (s.total_production_cost && parseVal(s.total_production_cost) > 0) {
                cogs += parseVal(s.total_production_cost);
            } else {
                // FALLBACK: Link to ACTUAL PRODUCTION COST (Existing Logic)
                const prod = productions.find(p => p.id === s.production_id);
                if (prod) {
                    const batchTotalCost = (
                        parseVal(prod.raw_material_cost) +
                        parseVal(prod.packaging_cost) +
                        parseVal(prod.shipping_cost) +
                        parseVal(prod.overhead_cost) +
                        parseVal(prod.financing_cost)
                    );
                    const unitCostBatch = batchTotalCost / (parseVal(prod.quantity) || 1);

                    let unitCostInSaleCurrency = unitCostBatch;
                    if (prod.currency !== s.currency) {
                        const rateFrom = exchangeRates[prod.currency] || 1;
                        const rateTo = exchangeRates[s.currency] || 1;
                        unitCostInSaleCurrency = (unitCostBatch / rateFrom) * rateTo;
                    }
                    cogs += unitCostInSaleCurrency * parseVal(s.quantity);
                } else {
                    cogs += saleRev * 0.7; // Fallback to 70% if production record is missing
                }
            }
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
                const rateFrom = exchangeRates[p.currency] || 1;
                const rateTo = exchangeRates[currency] || 1;
                const rate = rateTo / rateFrom;
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
                'Lot No': s.lot_no || '-',
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
                    if (s.total_production_cost && parseVal(s.total_production_cost) > 0) {
                        return (parseVal(s.total_amount) - parseVal(s.total_production_cost)).toFixed(2);
                    }
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
                <h2 className="heading-industrial text-2xl flex items-center gap-2">
                    <TrendingUp className="h-6 w-6 text-[#0071e3]" /> RAPORLAR
                </h2>
                <div className="flex bg-[#e5e5ea] p-1 rounded-lg">
                    <button
                        onClick={() => setActiveTab('summary')}
                        className={`px-4 py-2 rounded-[6px] text-[11px] font-bold uppercase tracking-wider transition-all ${activeTab === 'summary' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                    >
                        Özet & Grafikler
                    </button>
                    <button
                        onClick={() => setActiveTab('purchasing_report')}
                        className={`px-4 py-2 rounded-[6px] text-[11px] font-bold uppercase tracking-wider transition-all ${activeTab === 'purchasing_report' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                    >
                        Satın Almalar
                    </button>
                    <button
                        onClick={() => setActiveTab('sales_report')}
                        className={`px-4 py-2 rounded-[6px] text-[11px] font-bold uppercase tracking-wider transition-all ${activeTab === 'sales_report' ? 'bg-white text-[#1d1d1f] shadow-sm' : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                    >
                        Satış Raporu
                    </button>
                </div>
            </div>

            {/* DATE & SEARCH FILTERS */}
            <div className="card-industrial p-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#86868b]" />
                    <input
                        type="text"
                        placeholder="Müşteri, Ürün veya Tedarikçi Ara..."
                        className="input-industrial pl-9"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>

                {/* Date Range */}
                <div className="flex flex-wrap gap-2 justify-end items-center">
                    <Filter className="h-4 w-4 text-[#86868b]" />
                    <span className="text-xs font-bold text-[#86868b] uppercase tracking-wide">Tarih:</span>
                    <select
                        className="select-industrial sm:w-auto"
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
                                className="input-industrial py-1 text-xs"
                            />
                            <span className="text-[#86868b]">-</span>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="input-industrial py-1 text-xs"
                            />
                        </div>
                    )}
                </div>
            </div>

            {activeTab === 'summary' && (
                <>
                    {/* P&L Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="card-industrial p-6 border-l-4 border-[#0071e3]">
                            <div className="text-[#86868b] text-[13px] font-bold uppercase tracking-wide mb-1">Toplam Gelir</div>
                            <div className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">{formatMoney(financials.revenue)}</div>
                            <div className="text-xs text-[#107c10] flex items-center mt-1 font-medium">
                                <TrendingUp className="h-3 w-3 mr-1" /> Satışlardan
                            </div>
                        </div>

                        <div className="card-industrial p-6 border-l-4 border-[#d21e1e]">
                            <div className="text-[#86868b] text-[13px] font-bold uppercase tracking-wide mb-1">SMM (Maliyet)</div>
                            <div className="text-3xl font-semibold text-[#1d1d1f] tracking-tight">{formatMoney(financials.cogs)}</div>
                            <div className="text-xs text-[#d21e1e] flex items-center mt-1 font-medium">
                                <TrendingDown className="h-3 w-3 mr-1" /> Üretim Maliyeti
                            </div>
                        </div>

                        <div className="card-industrial p-6 border-l-4 border-[#5e5ce6]">
                            <div className="text-[#86868b] text-[13px] font-bold uppercase tracking-wide mb-1">Brüt Kar</div>
                            <div className={`text-3xl font-semibold tracking-tight ${financials.grossProfit >= 0 ? 'text-[#107c10]' : 'text-[#d21e1e]'}`}>
                                {formatMoney(financials.grossProfit)}
                            </div>
                            <div className="text-xs text-[#86868b] mt-1 font-medium">
                                Marj: {financials.revenue > 0 ? ((financials.grossProfit / financials.revenue) * 100).toFixed(1) : 0}%
                            </div>
                        </div>

                        <div className="card-industrial p-6 border-l-4 border-[#107c10]">
                            <div className="text-[#86868b] text-[13px] font-bold uppercase tracking-wide mb-1">Net Kar</div>
                            <div className={`text-3xl font-semibold tracking-tight ${financials.netProfit >= 0 ? 'text-[#107c10]' : 'text-[#d21e1e]'}`}>
                                {formatMoney(financials.netProfit)}
                            </div>
                            <div className="text-xs text-[#86868b] mt-1 font-medium">
                                (Vergi öncesi)
                            </div>
                        </div>
                    </div>

                    {/* Charts Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Cost Breakdown Bar Chart */}
                        <div className="card-industrial p-6">
                            <h3 className="font-bold text-[#1d1d1f] mb-6 flex items-center gap-2 text-lg">
                                <PieChart className="h-5 w-5 text-[#0071e3]" /> Üretim Maliyet Dağılımı
                            </h3>

                            {costBreakdown.total > 0 ? (
                                <div className="space-y-4">
                                    {[
                                        { label: 'Hammadde', value: costBreakdown.raw, color: 'bg-[#0071e3]' },
                                        { label: 'Ambalaj', value: costBreakdown.pkg, color: 'bg-[#5e5ce6]' },
                                        { label: 'Nakliye', value: costBreakdown.ship, color: 'bg-[#ff9f0a]' },
                                        { label: 'Genel Gider', value: costBreakdown.overhead, color: 'bg-[#86868b]' },
                                        { label: 'Finansman', value: costBreakdown.finance, color: 'bg-[#d21e1e]' }
                                    ].map((item, idx) => {
                                        const percent = (item.value / costBreakdown.total) * 100;
                                        return (
                                            <div key={idx}>
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="text-[#86868b] font-medium">{item.label}</span>
                                                    <span className="text-[#1d1d1f] font-bold">{formatMoney(item.value)} ({percent.toFixed(1)}%)</span>
                                                </div>
                                                <div className="w-full bg-[#f5f5f7] rounded-full h-2.5">
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
                                <div className="text-center py-10 text-[#86868b]">
                                    Bu dönemde üretim verisi bulunamadı.
                                </div>
                            )}
                        </div>

                        {/* Profitability Analysis */}
                        <div className="card-industrial p-6">
                            <h3 className="font-bold text-[#1d1d1f] mb-6 flex items-center gap-2 text-lg">
                                <BarChart2 className="h-5 w-5 text-[#107c10]" /> Karlılık Analizi
                            </h3>

                            <div className="space-y-6">
                                <div className="p-4 bg-[#f2fcf5] rounded-[6px] border border-[#a8dab5]">
                                    <div className="text-sm text-[#107c10] font-bold mb-2">En Karlı Ürün (Birim Başına)</div>
                                    {/* Logic to find most profitable product */}
                                    {(() => {
                                        if (filteredData.productions.length === 0) return <div className="text-sm text-[#86868b]">-</div>;
                                        const sorted = [...filteredData.productions].sort((a, b) => (b.profit_amount || 0) - (a.profit_amount || 0));
                                        const top = sorted[0];
                                        return (
                                            <div>
                                                <div className="text-lg font-bold text-[#107c10]">{top.lot_number}</div>
                                                <div className="text-sm text-[#0b5c0b]">Kar: {parseVal(top.profit_amount).toFixed(2)} {top.currency}</div>
                                            </div>
                                        );
                                    })()}
                                </div>

                                <div className="p-4 bg-[#f5f5f7] rounded-[6px] border border-[#d2d2d7]">
                                    <div className="text-sm text-[#0071e3] font-bold mb-2">Ortalama Kar Marjı</div>
                                    {(() => {
                                        if (filteredData.productions.length === 0) return <div className="text-sm text-[#86868b]">-</div>;
                                        const totalMargin = filteredData.productions.reduce((sum, p) => sum + parseVal(p.profit_margin_percent), 0);
                                        const avg = totalMargin / filteredData.productions.length;
                                        return (
                                            <div className="text-2xl font-bold text-[#0071e3] tracking-tight">%{avg.toFixed(1)}</div>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}

            {activeTab === 'purchasing_report' && (
                <div className="card-industrial">
                    <div className="p-4 border-b border-[#d2d2d7] flex justify-between items-center bg-[#f5f5f7]">
                        <div className="space-y-1">
                            <h3 className="font-bold text-[#1d1d1f]">Satın Alma Raporu</h3>
                            <p className="text-xs text-[#86868b]">
                                {dateRange === 'all' ? 'Tüm Zamanlar' :
                                    dateRange === 'month' ? 'Bu Ay' :
                                        dateRange === 'year' ? 'Bu Yıl' :
                                            `${new Date(startDate).toLocaleDateString('tr-TR')} - ${new Date(endDate).toLocaleDateString('tr-TR')}`}
                            </p>
                        </div>
                        <button
                            onClick={exportPurchasingReport}
                            className="btn-primary-green flex items-center gap-2 text-xs"
                        >
                            <BarChart2 className="h-4 w-4" /> Excel'e Aktar
                        </button>
                    </div>

                    {/* SPENDING ANALYSIS SUMMARY */}
                    <div className="p-4 bg-white border-b border-[#d2d2d7] grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* 1. Category Breakdown */}
                        <div className="bg-[#f5f5f7] p-3 rounded-[6px] border border-[#d2d2d7]">
                            <h4 className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-2">Harcama Dağılımı (Kategori)</h4>
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
                                            <div key={cat} className="flex justify-between text-xs">
                                                <span className="text-[#86868b] font-medium">{cat}:</span>
                                                <span className="text-[#1d1d1f] font-mono">{parts.join(' + ')}</span>
                                            </div>
                                        );
                                    });
                                })()}
                            </div>
                        </div>

                        {/* 2. Quick Currency Stats */}
                        <div className="bg-[#f5f5f7] p-3 rounded-[6px] border border-[#d2d2d7] flex flex-col justify-center">
                            <h4 className="text-[10px] font-bold text-[#86868b] uppercase tracking-wider mb-2">Toplam Harcama</h4>
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
                                        <div key={cur} className="bg-[#e8f2ff] px-3 py-1 rounded-[4px] text-[#0071e3] font-bold text-xs border border-[#d0e6ff] font-mono">
                                            {val.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {cur}
                                        </div>
                                    ));
                                })()}
                            </div>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="table-industrial">
                            <thead>
                                <tr>
                                    <th>Tarih</th>
                                    <th>Tedarikçi</th>
                                    <th>Ürün / Açıklama</th>
                                    <th className="text-right">Miktar</th>
                                    <th className="text-center">Birim</th>
                                    <th className="text-right">Birim Fiyat</th>
                                    <th className="text-right">Vade</th>
                                    <th className="text-right">Toplam</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#d2d2d7]">
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
                                            <tr key={p.id} className="hover:bg-[#f5f5f7] transition-colors">
                                                <td className="p-4 text-[#1d1d1f]">{new Date(p.created_at).toLocaleDateString('tr-TR')}</td>
                                                <td className="p-4 font-medium text-[#1d1d1f]">{supplier?.name || '-'}</td>
                                                <td className="p-4 text-[#1d1d1f]">{p.item_name}</td>
                                                <td className="p-4 text-right font-mono text-[#86868b]">
                                                    {formattedQty}
                                                </td>
                                                <td className="p-4 text-center text-xs text-[#86868b] font-medium">
                                                    {unit}
                                                </td>
                                                <td className="p-4 text-right font-mono text-[#86868b]">
                                                    {parseFloat(p.price).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {p.currency}
                                                </td>
                                                <td className="p-4 text-right font-mono text-[#86868b]">
                                                    {p.payment_term || 0} Gün
                                                </td>
                                                <td className="p-4 text-right font-mono font-bold text-[#0071e3]">
                                                    {calculatedTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {p.currency}
                                                </td>
                                            </tr>
                                        );
                                    })
                                ) : (
                                    <tr>
                                        <td colSpan="8" className="p-8 text-center text-[#86868b]">
                                            Seçilen tarih aralığında ve arama kriterlerinde satın alma kaydı bulunamadı.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                            <tfoot className="bg-[#f5f5f7] font-bold text-[#1d1d1f] border-t-2 border-[#d2d2d7] text-xs">
                                <tr>
                                    <td colSpan="4" className="p-4 text-right align-top">Para Birimi Bazlı Toplamlar:</td>
                                    <td colSpan="4" className="p-4 bg-white">
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

                                                if (Object.keys(totals).length === 0) return <div className="text-[#86868b]">Veri yok</div>;

                                                return Object.entries(totals).map(([cur, val]) => (
                                                    <div key={cur} className="flex justify-between w-full max-w-xs border-b border-[#d2d2d7] pb-1 last:border-0 font-mono">
                                                        <span className="text-[#86868b] font-medium mr-4">Toplam {cur}:</span>
                                                        <span className="text-[#0071e3] text-sm">
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

                                // NEW: Use detailed cost from sales table if available
                                if (s.total_production_cost && parseVal(s.total_production_cost) > 0) {
                                    const costInTry = (parseVal(s.total_production_cost) / rate) * baseRate;
                                    totalCost += costInTry;
                                    totalProfit += (revenueInTry - costInTry);
                                } else {
                                    // FALLBACK: Old Batch Logic
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
                                        // If no cost info, assume 0 cost for profit calculation (optimistic fallback)
                                        totalProfit += revenueInTry;
                                    }
                                }
                            });

                            const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

                            return (
                                <>
                                    <div className="card-industrial p-4 border-l-4 border-[#0071e3]">
                                        <div className="text-[#86868b] text-[10px] font-bold uppercase tracking-wide mb-1">Toplam Satış (TRY)</div>
                                        <div className="text-2xl font-semibold text-[#1d1d1f] tracking-tight">{totalRevenue.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</div>
                                    </div>
                                    <div className="card-industrial p-4 border-l-4 border-[#d21e1e]">
                                        <div className="text-[#86868b] text-[10px] font-bold uppercase tracking-wide mb-1">Toplam Maliyet (TRY)</div>
                                        <div className="text-xl font-semibold text-[#1d1d1f] tracking-tight">{totalCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</div>
                                    </div>
                                    <div className="card-industrial p-4 border-l-4 border-[#107c10]">
                                        <div className="text-[#86868b] text-[10px] font-bold uppercase tracking-wide mb-1">Net Kar (TRY)</div>
                                        <div className="text-2xl font-bold text-[#107c10] tracking-tight">{totalProfit.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</div>
                                    </div>
                                    <div className="card-industrial p-4 border-l-4 border-[#5e5ce6]">
                                        <div className="text-[#86868b] text-[10px] font-bold uppercase tracking-wide mb-1">Ortalama Marj</div>
                                        <div className="text-2xl font-bold text-[#5e5ce6] tracking-tight">%{margin.toFixed(1)}</div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* MONTHLY TREND CHART (Simple CSS Bar Chart) */}
                    <div className="card-industrial p-6">
                        <h3 className="font-bold text-[#1d1d1f] mb-4 flex items-center gap-2 text-lg">
                            <BarChart2 className="h-5 w-5 text-[#0071e3]" /> Aylık Satış Trendi (Son 6 Ay)
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
                                            className="w-full bg-[#e8f2ff] rounded-t-sm hover:bg-[#d0e6ff] transition-all relative group-hover:shadow-lg"
                                            style={{ height: `${(val / maxVal) * 100}%` }}
                                        >
                                            {/* Tooltip */}
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-[#1d1d1f] text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-10 transition-opacity font-mono">
                                                {val.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-[#86868b] mt-1 rotate-0 font-medium">{m.split('-')[1]}</div>
                                    </div>
                                ));
                            })()}
                        </div>
                    </div>

                    <div className="card-industrial">
                        <div className="p-4 border-b border-[#d2d2d7] flex justify-between items-center bg-[#f5f5f7]">
                            <div className="space-y-1">
                                <h3 className="font-bold text-[#1d1d1f]">Satış Raporu</h3>
                                <p className="text-xs text-[#86868b]">
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
                                <label className="flex items-center gap-2 cursor-pointer text-sm text-[#1d1d1f] transition-all hover:opacity-80">
                                    <input
                                        type="checkbox"
                                        checked={showCostDetails}
                                        onChange={e => setShowCostDetails(e.target.checked)}
                                        className="rounded text-[#0071e3] focus:ring-[#0071e3]"
                                    />
                                    <span className="font-medium text-xs">Maliyet & Kar Göster</span>
                                </label>
                                <button
                                    onClick={exportSalesReport}
                                    className="btn-primary-green flex items-center gap-2 text-xs"
                                >
                                    <BarChart2 className="h-4 w-4" /> Excel'e Aktar
                                </button>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="table-industrial">
                                <thead>
                                    <tr>
                                        <th>Tarih</th>
                                        <th>Müşteri</th>
                                        <th>Ürün</th>
                                        <th>Lot No</th>
                                        <th className="text-right">Miktar</th>
                                        <th className="text-right">Birim Fiyat</th>
                                        <th className="text-right">Toplam</th>
                                        {showCostDetails && (
                                            <>
                                                <th className="text-right bg-[#f2f2f7]">Üretim Birim Mal.</th>
                                                <th className="text-right bg-[#f2f2f7]">Üretim Toplam Mal.</th>
                                                <th className="text-right bg-[#f2f2f7]">Kar</th>
                                            </>
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-[#d2d2d7]">
                                    {filteredData.sales.length > 0 ? (
                                        filteredData.sales.map(s => {
                                            // Calculate Cost & Profit for Row
                                            const prod = productions.find(p => p.id === s.production_id);
                                            let unitCost = 0;
                                            let totalCost = 0;
                                            let profit = 0;

                                            if (s.total_production_cost && parseVal(s.total_production_cost) > 0) {
                                                totalCost = parseVal(s.total_production_cost);
                                                unitCost = totalCost / parseVal(s.quantity || 1);
                                                profit = parseVal(s.total_amount) - totalCost;
                                            } else if (prod) {
                                                // Batch Fallback
                                                let prodTotal = (
                                                    (parseFloat(prod.raw_material_cost) || 0) +
                                                    (parseFloat(prod.packaging_cost) || 0) +
                                                    (parseFloat(prod.shipping_cost) || 0) +
                                                    (parseFloat(prod.overhead_cost) || 0) +
                                                    (parseFloat(prod.financing_cost) || 0)
                                                );
                                                unitCost = prodTotal / parseFloat(prod.quantity || 1);
                                                if (prod.currency !== s.currency) {
                                                    const costInBase = unitCost / (exchangeRates[prod.currency] || 1);
                                                    unitCost = costInBase * (exchangeRates[s.currency] || 1);
                                                }
                                                totalCost = unitCost * parseFloat(s.quantity);
                                                profit = parseFloat(s.total_amount) - totalCost;
                                            }

                                            return (
                                                <tr key={s.id} className="hover:bg-[#f5f5f7] transition-colors">
                                                    <td className="p-4 text-[#1d1d1f]">{new Date(s.sale_date).toLocaleDateString('tr-TR')}</td>
                                                    <td className="p-4 font-medium text-[#1d1d1f]">{s.customer_name}</td>
                                                    <td className="p-4 text-[#1d1d1f]">{s.product_name}</td>
                                                    <td className="p-4">
                                                        <span className="badge-industrial badge-industrial-blue">
                                                            {s.lot_no || '-'}
                                                        </span>
                                                    </td>
                                                    <td className="p-4 text-right font-mono text-[#86868b]">{s.quantity}</td>
                                                    <td className="p-4 text-right font-mono text-[#86868b]">
                                                        {parseFloat(s.unit_price).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {s.currency}
                                                    </td>
                                                    <td className="p-4 text-right font-mono font-bold text-[#107c10]">
                                                        {parseFloat(s.total_amount).toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {s.currency}
                                                    </td>
                                                    {showCostDetails && (
                                                        <td className="p-4 text-right font-mono text-[#86868b] bg-[#f9f9fa] border-l border-[#d2d2d7]">
                                                            <div className="text-xs">{unitCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {s.currency}</div>
                                                        </td>
                                                    )}
                                                    {showCostDetails && (
                                                        <td className="p-4 text-right font-mono text-[#86868b] bg-[#f9f9fa] border-l border-[#d2d2d7]">
                                                            <div className="font-bold">{totalCost.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {s.currency}</div>
                                                        </td>
                                                    )}
                                                    {showCostDetails && (
                                                        <td className={`p-4 text-right font-mono font-bold border-l border-[#d2d2d7] ${profit >= 0 ? 'text-[#107c10]' : 'text-[#d21e1e]'}`}>
                                                            {profit.toLocaleString('tr-TR', { minimumFractionDigits: 2 })} {s.currency}
                                                        </td>
                                                    )}
                                                </tr>
                                            )
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={showCostDetails ? "10" : "7"} className="p-8 text-center text-[#86868b]">
                                                Seçilen tarih aralığında ve arama kriterlerinde satış bulunamadı.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                                <tfoot className="bg-[#f5f5f7] border-t border-[#d2d2d7] font-bold text-[#1d1d1f]">
                                    {Object.entries((() => {
                                        const totals = {};
                                        filteredData.sales.forEach(s => {
                                            if (!totals[s.currency]) totals[s.currency] = 0;
                                            totals[s.currency] += parseFloat(s.total_amount);
                                        });
                                        return totals;
                                    })()).map(([currency, total]) => (
                                        <tr key={currency}>
                                            <td colSpan="5" className="p-4 text-right uppercase text-xs text-[#86868b] tracking-wider">
                                                Toplam {currency}:
                                            </td>
                                            <td className="p-4 text-right font-mono text-[#107c10]">
                                                {total.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {currency}
                                            </td>
                                            {showCostDetails && <td colSpan="3"></td>}
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
