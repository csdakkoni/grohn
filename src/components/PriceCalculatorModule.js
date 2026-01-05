import React, { useState, useEffect } from 'react';
import { Calculator, AlertCircle, FileText, Plus, Trash2, ShoppingCart, Save } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { turkishToEnglish, preparePDFWithFont } from '../utils/exportUtils';
import { drawCIHeader, drawCIFooter, drawCIMetadataGrid, drawCIWrappedText, CI_PALETTE } from '../utils/pdfCIUtils';
import { supabase } from '../supabaseClient';

export default function PriceCalculatorModule({ recipes, inventory, exchangeRates, globalSettings = {}, onRefresh, isIntegrated = false }) {
    const [form, setForm] = useState({
        recipeId: '',
        quantity: 1000,
        packagingId: '',
        shippingCost: 0,
        shippingCurrency: 'TRY',
        overheadPerKg: 0.2,
        overheadCurrency: 'USD',
        saleTermDays: 30,
        monthlyInterestRate: 4,
        profitMarginPercent: 20,
        currency: 'USD'
    });

    const [quoteBasket, setQuoteBasket] = useState([]);
    const [quoteForm, setQuoteForm] = useState({
        customerName: '',
        contactPerson: '',
        validityDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days default
        offerConditions: `1. Fiyatlarımıza KDV dahil değildir.\n2. Teslimat şekli: Fabrika Teslim (EXW)\n3. Ödeme vadesi fatura tarihinden itibaren geçerlidir.\n4. Bu teklif belirtilen tarihe kadar geçerlidir.`,
        showModal: false
    });

    const [results, setResults] = useState(null);

    const parseVal = (val) => {
        if (!val) return 0;
        return parseFloat(val.toString()) || 0;
    };

    // Helper to convert any currency to USD
    // Rate is "How many Units of Currency per 1 USD" (e.g. TRY: 34.50)
    const toUSD = (amount, currency) => {
        if (currency === 'USD') return amount;
        const rate = exchangeRates[currency]; // e.g. 34.50
        if (!rate) return amount;
        return amount / rate; // Correct: 34.50 TRY / 34.50 = 1 USD
    };

    // Helper to convert USD to target currency
    const fromUSD = (amountUSD, targetCurrency) => {
        if (targetCurrency === 'USD') return amountUSD;
        const rate = exchangeRates[targetCurrency];
        if (!rate) return amountUSD;
        return amountUSD * rate; // Correct: 1 USD * 34.50 = 34.50 TRY
    };

    const calculatePrice = () => {
        if (!form.recipeId) return;

        const recipe = recipes.find(r => r.id === parseInt(form.recipeId));
        if (!recipe) return;

        const quantity = parseVal(form.quantity) || 1000;
        const intRate = parseVal(form.monthlyInterestRate) / 100 / 30;
        const termDays = parseVal(form.saleTermDays);

        // 1. Raw Materials & Avg Term
        let totalRawMaterialUSD = 0;
        let payTermSum = 0;

        recipe.ingredients.forEach(ing => {
            const currentId = ing.itemId || ing.item_id;
            const item = inventory.find(i => i.id === parseInt(currentId));
            if (item) {
                const itemCostUSD = toUSD(item.cost || 0, item.currency);
                const weight = (parseFloat(ing.percentage) / 100) * quantity;
                const lineCostUSD = itemCostUSD * weight;
                totalRawMaterialUSD += lineCostUSD;
                payTermSum += lineCostUSD * (item.payment_term || 0);
            }
        });

        const avgRawTerm = totalRawMaterialUSD > 0 ? payTermSum / totalRawMaterialUSD : 0;

        // 2. Packaging (PROPORTIONAL for unit cost stability)
        let totalPackagingUSD = 0;
        if (form.packagingId) {
            const pkg = inventory.find(i => i.id === parseInt(form.packagingId));
            if (pkg) {
                const pkgUnitCostUSD = toUSD(pkg.cost || 0, pkg.currency);
                const capacity = parseFloat(pkg.capacity_value) || 1000;
                // [PROPORTIONAL] Weight-based cost
                totalPackagingUSD = (pkgUnitCostUSD / capacity) * quantity;
            }
        }

        // 3. Operational Costs (Shipping = Total, Overhead = $/kg)
        const totalShippingUSD = toUSD(parseVal(form.shippingCost), form.shippingCurrency);
        const totalOverheadUSD = toUSD(parseVal(form.overheadPerKg), form.overheadCurrency) * quantity;

        // 4. Split Financing
        // Raw materials benefit from supplier term
        const rmFinancingUSD = totalRawMaterialUSD * Math.max(0, termDays - avgRawTerm) * intRate;
        // Upfront costs (Pkg + Ship + Overhead) are financed for the full sale term
        const upfrontCostsUSD = totalPackagingUSD + totalShippingUSD + totalOverheadUSD;
        const upfrontFinancingUSD = upfrontCostsUSD * termDays * intRate;

        const totalFinancingUSD = rmFinancingUSD + upfrontFinancingUSD;

        // 5. Final Totals
        const baseProductionCostUSD = totalRawMaterialUSD + totalPackagingUSD + totalShippingUSD + totalOverheadUSD;
        const totalCostUSD = baseProductionCostUSD + totalFinancingUSD;
        const profitMargin = parseVal(form.profitMarginPercent) / 100;

        // [MARGIN FIX] Price = Cost / (1 - Margin)
        const totalPriceUSD = profitMargin >= 1 ? totalCostUSD * 2 : totalCostUSD / (1 - profitMargin);
        const unitPriceUSD = totalPriceUSD / quantity;

        // Convert Results to Target Currency
        const target = form.currency;
        setResults({
            currency: target,
            unitCost: fromUSD(totalCostUSD / quantity, target),
            unitPrice: fromUSD(totalPriceUSD / quantity, target),
            totalPrice: fromUSD(totalPriceUSD, target),
            breakdown: {
                rawMaterial: fromUSD(totalRawMaterialUSD, target),
                packaging: fromUSD(totalPackagingUSD, target),
                overhead: fromUSD(totalOverheadUSD, target),
                shipping: fromUSD(totalShippingUSD, target),
                financing: fromUSD(totalFinancingUSD, target),
                profit: fromUSD(totalPriceUSD - totalCostUSD, target)
            },
            formData: { ...form },
            productName: recipe.product_id ? inventory.find(i => i.id === recipe.product_id)?.name : 'Unknown'
        });
    };

    const [history, setHistory] = useState([]);

    const loadHistory = async () => {
        const { data, error } = await supabase
            .from('calculation_history')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);
        if (!error && data) setHistory(data);
    };

    useEffect(() => {
        loadHistory();
    }, []);

    const handleSaveToHistory = async () => {
        if (!results || !form.recipeId) return;

        const recipe = recipes.find(r => r.id === parseInt(form.recipeId));
        if (!recipe) return;

        try {
            const { error } = await supabase.from('calculation_history').insert({
                recipe_id: parseInt(form.recipeId),
                product_name: results.productName,
                quantity: parseVal(form.quantity),
                unit_cost: results.unitCost,
                unit_price: results.unitPrice,
                currency: results.currency,
                breakdown: results.breakdown,
                parameters: {
                    packaging_id: form.packagingId,
                    shipping_cost: form.shippingCost,
                    overhead_per_kg: form.overheadPerKg,
                    sale_term_days: form.saleTermDays,
                    monthly_interest_rate: form.monthlyInterestRate,
                    profit_margin_percent: form.profitMarginPercent
                }
            });

            if (error) throw error;

            alert('Hesaplama geçmişe başarıyla kaydedildi.');
            loadHistory();
        } catch (error) {
            console.error('Kaydetme hatası:', error);
            alert('Geçmişe kaydedilemedi: ' + error.message);
        }
    };

    const addToBasket = () => {
        if (!results) return;
        setQuoteBasket([...quoteBasket, { ...results, id: Date.now(), isManual: false }]);
        setResults(null); // Clear current result to encourage new calculation
    };

    const removeFromBasket = (id) => {
        setQuoteBasket(quoteBasket.filter(item => item.id !== id));
    };

    const handleGenerateQuote = async () => {
        if (quoteBasket.length === 0) return;

        const doc = await preparePDFWithFont();
        const fontName = doc.activeFont || 'helvetica';

        // Initial Header (Professional Layout)
        const docDate = new Date().toLocaleDateString('tr-TR');
        drawCIHeader(doc, 'TEKLİF FORMU', 'SATIŞ VE PAZARLAMA MERKEZİ', docDate, `OFF-${Date.now().toString().slice(-6)}`);
        const startY = 45;

        // Metadata Grid (Cleaned)
        const metaData = [
            { label: 'MÜŞTERİ', value: quoteForm.customerName || 'Sayın Yetkili' },
            { label: 'İLGİLİ KİŞİ', value: quoteForm.contactPerson || '-' },
            { label: 'GEÇERLİLİK TARİHİ', value: new Date(quoteForm.validityDate).toLocaleDateString('tr-TR') }
        ];
        let currY = drawCIMetadataGrid(doc, 14, startY, metaData, 2);
        currY += 5;

        // --- QUOTE TABLE ---
        const tableBody = quoteBasket.map(item => {
            const packaging = inventory.find(i => i.id === parseInt(item.formData.packagingId));
            const descDisplay = item.description ? item.description : (item.productName || '-');

            return [
                descDisplay,
                packaging?.name || 'Dökme',
                `${item.formData.saleTermDays} Gün`,
                `${item.unitPrice.toFixed(2)} ${item.currency}`,
            ];
        });

        autoTable(doc, {
            startY: currY,
            head: [['Ürün / Açıklama', 'Ambalaj', 'Vade', 'Birim Fiyat (kg)']],
            body: tableBody,
            theme: 'grid',
            headStyles: {
                fillColor: CI_PALETTE.pure_black,
                textColor: 255,
                font: fontName,
                fontStyle: 'bold',
                fontSize: 7,
                cellPadding: 3
            },
            bodyStyles: {
                font: fontName,
                fontSize: 8,
                cellPadding: 3,
                textColor: CI_PALETTE.pure_black
            },
            columnStyles: {
                0: { cellWidth: 'auto', fontStyle: 'bold' },
                1: { cellWidth: 35 },
                2: { cellWidth: 30, halign: 'center' },
                3: { cellWidth: 35, halign: 'right', fontStyle: 'bold' }
            },
            margin: { top: 40, bottom: 35 },
            didDrawPage: (data) => {
                const docDate = new Date().toLocaleDateString('tr-TR');
                drawCIHeader(doc, 'TEKLİF FORMU', 'SATIŞ VE PAZARLAMA MERKEZİ', docDate);
                drawCIFooter(doc, globalSettings, 'Ticari Modül v5.3.0');
            }
        });

        // --- CONDITIONS / SIGNATURES ---
        let finalY = doc.lastAutoTable.finalY + 15;

        // Space Check
        if (finalY > 230) {
            doc.addPage();
            const docDate = new Date().toLocaleDateString('tr-TR');
            drawCIHeader(doc, 'TEKLİF FORMU', 'SATIŞ VE PAZARLAMA MERKEZİ', docDate);
            drawCIFooter(doc, globalSettings, 'Ticari Modül v5.3.0');
            finalY = 45;
        }

        if (finalY < 240) {
            doc.setDrawColor(...CI_PALETTE.hairline_grey);
            doc.setLineWidth(0.05);
            doc.line(14, finalY, 196, finalY);

            currY = drawCIWrappedText(doc, 14, finalY + 6, 'TEKLİF ŞARTLARI VE NOTLAR', quoteForm.offerConditions || 'Standart satış koşulları geçerlidir.', 182);

            // Authorized Signature
            const sigY = currY + 15;
            if (sigY < 270) {
                doc.setDrawColor(...CI_PALETTE.hairline_grey);
                doc.line(136, sigY + 15, 196, sigY + 15);
                doc.setFont(fontName, 'bold');
                doc.setTextColor(...CI_PALETTE.neutral_grey);
                doc.text('YETKİLİ İMZA', 136, sigY);
            }
        }

        doc.save(`Fiyat_Teklifi_${quoteForm.customerName || 'Musteri'}.pdf`);
        setQuoteForm({ ...quoteForm, showModal: false });
    };

    const [activeTab, setActiveTab] = useState('calculator'); // 'calculator' | 'manual' | 'history'
    const [manualForm, setManualForm] = useState({
        productId: '',
        description: '', // New field instead of Qty
        unitPrice: 0,
        currency: 'USD',
        packagingId: '',
        saleTermDays: 30,
        shippingCost: 0,
        shippingCurrency: 'USD',
        overheadPerKg: 0.2,
        overheadCurrency: 'USD'
    });

    // ... (existing parseVal, toUSD, fromUSD, calculatePrice functions remain unchanged)

    const handleManualAdd = () => {
        if (!manualForm.productId && !manualForm.description) return; // Require either product or description
        if (!manualForm.unitPrice) return;

        const product = inventory.find(i => i.id === parseInt(manualForm.productId));
        const unitPrice = parseVal(manualForm.unitPrice);

        const newItem = {
            id: Date.now(),
            productName: product ? product.name : 'Bilinmeyen Ürün',
            description: manualForm.description, // User entered desc
            currency: manualForm.currency,
            unitPrice: unitPrice,
            totalPrice: 0, // Not applicable for price list offer
            breakdown: null,
            formData: {
                quantity: 0, // No quantity
                saleTermDays: manualForm.saleTermDays,
                packagingId: manualForm.packagingId,
                shippingCost: manualForm.shippingCost,
                shippingCurrency: manualForm.shippingCurrency,
                overheadPerKg: manualForm.overheadPerKg,
                overheadCurrency: manualForm.overheadCurrency
            },
            isManual: true
        };

        setQuoteBasket([...quoteBasket, newItem]);
        setManualForm({
            ...manualForm,
            productId: '',
            description: '',
            unitPrice: 0,
            shippingCost: 0,
            overheadPerKg: 0.2
        });
    };

    return (
        <div className="space-y-6">
            {!isIntegrated && (
                <h2 className="heading-industrial text-2xl flex items-center gap-2">
                    <Calculator className="h-6 w-6 text-[#0071e3]" /> Fiyat ve Teklif
                </h2>
            )}

            <div className="flex gap-4 border-b border-slate-200 mb-4">
                <button
                    onClick={() => setActiveTab('calculator')}
                    className={`pb-2 px-4 font-bold text-xs uppercase tracking-wider transition-all ${activeTab === 'calculator'
                        ? 'text-[#0071e3] border-b-2 border-[#0071e3]'
                        : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                >
                    Maliyet Hesapla
                </button>
                <button
                    onClick={() => setActiveTab('manual')}
                    className={`pb-2 px-4 font-bold text-xs uppercase tracking-wider transition-all ${activeTab === 'manual'
                        ? 'text-[#0071e3] border-b-2 border-[#0071e3]'
                        : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                >
                    Manuel Ekle
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`pb-2 px-4 font-bold text-xs uppercase tracking-wider transition-all ${activeTab === 'history'
                        ? 'text-[#0071e3] border-b-2 border-[#0071e3]'
                        : 'text-[#86868b] hover:text-[#1d1d1f]'}`}
                >
                    Geçmiş
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT SIDE: INPUTS */}
                <div className="lg:col-span-2 space-y-6">

                    {/* CALCULATOR TAB */}
                    {activeTab === 'calculator' && (
                        <>
                            <div className="card-industrial p-6">
                                <h3 className="heading-industrial text-sm mb-6">Maliyet Parametreleri</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    {/* Existing Calculator Inputs */}
                                    <div className="space-y-1">
                                        <label className="label-industrial">Reçete / Ürün</label>
                                        <select
                                            value={form.recipeId}
                                            onChange={e => setForm({ ...form, recipeId: e.target.value })}
                                            className="select-industrial"
                                        >
                                            <option value="">Seçiniz...</option>
                                            {recipes.map(r => {
                                                const product = inventory.find(i => i.id === r.product_id);
                                                return <option key={r.id} value={r.id}>{product?.name || 'Bilinmeyen'}</option>;
                                            })}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="label-industrial">Miktar (kg)</label>
                                        <input
                                            type="number"
                                            value={form.quantity}
                                            onChange={e => setForm({ ...form, quantity: e.target.value })}
                                            className="input-industrial"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="label-industrial">Ambalaj</label>
                                        <select
                                            value={form.packagingId}
                                            onChange={e => setForm({ ...form, packagingId: e.target.value })}
                                            className="select-industrial"
                                        >
                                            <option value="">Dökme (Ambalajsız)</option>
                                            {inventory.filter(i => i.type === 'Ambalaj').map(i => (
                                                <option key={i.id} value={i.id}>{i.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="label-industrial">Toplam Nakliye</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                step="0.001"
                                                value={form.shippingCost}
                                                onChange={e => setForm({ ...form, shippingCost: e.target.value })}
                                                className="input-industrial flex-1"
                                            />
                                            <select
                                                value={form.shippingCurrency}
                                                onChange={e => setForm({ ...form, shippingCurrency: e.target.value })}
                                                className="select-industrial w-24 bg-[#f5f5f7]"
                                            >
                                                <option value="TRY">TRY</option>
                                                <option value="USD">USD</option>
                                                <option value="EUR">EUR</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="label-industrial">Genel Gider (kg başı)</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={form.overheadPerKg}
                                                onChange={e => setForm({ ...form, overheadPerKg: e.target.value })}
                                                className="input-industrial flex-1"
                                            />
                                            <select
                                                value={form.overheadCurrency}
                                                onChange={e => setForm({ ...form, overheadCurrency: e.target.value })}
                                                className="select-industrial w-24 bg-[#f5f5f7]"
                                            >
                                                <option value="USD">USD</option>
                                                <option value="EUR">EUR</option>
                                                <option value="TRY">TRY</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="label-industrial">Satış Vadesi (Gün)</label>
                                        <input
                                            type="number"
                                            value={form.saleTermDays}
                                            onChange={e => setForm({ ...form, saleTermDays: e.target.value })}
                                            className="input-industrial"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="label-industrial">Aylık Faiz (%)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={form.monthlyInterestRate}
                                            onChange={e => setForm({ ...form, monthlyInterestRate: e.target.value })}
                                            className="input-industrial"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="label-industrial">Kar Marjı (%)</label>
                                        <input
                                            type="number"
                                            value={form.profitMarginPercent}
                                            onChange={e => setForm({ ...form, profitMarginPercent: e.target.value })}
                                            className="input-industrial"
                                        />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="label-industrial">Para Birimi</label>
                                        <select
                                            value={form.currency}
                                            onChange={e => setForm({ ...form, currency: e.target.value })}
                                            className="select-industrial"
                                        >
                                            <option value="USD">USD</option>
                                            <option value="EUR">EUR</option>
                                            <option value="TRY">TRY</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="mt-8 flex gap-3">
                                    <button
                                        onClick={calculatePrice}
                                        className="btn-primary w-full py-4 text-base shadow-md"
                                    >
                                        <Calculator className="h-5 w-5 mr-2" /> HESAPLA
                                    </button>
                                </div>
                            </div>

                            {/* RESULTS PREVIEW */}
                            {results && (
                                <div className="card-industrial p-6 border-2 border-[#d0e6ff] animate-fade-in space-y-6">
                                    <div className="flex justify-between items-center border-b border-[#d2d2d7] pb-3">
                                        <h3 className="text-lg font-bold text-[#1d1d1f]">Maliyet Özeti ({results.productName})</h3>
                                        <span className="badge-industrial badge-industrial-blue">Vade: {form.saleTermDays} Gün</span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="bg-[#f5f5f7] p-4 rounded-[6px] border border-[#d2d2d7]">
                                            <div className="text-[10px] font-bold text-[#86868b] uppercase mb-1 tracking-wider">Birim Maliyet</div>
                                            <div className="text-xl font-bold text-[#1d1d1f] font-mono">
                                                {results.unitCost.toFixed(2)} {results.currency} / kg
                                            </div>
                                        </div>
                                        <div className="bg-[#e8f2ff] p-4 rounded-[6px] border border-[#d0e6ff]">
                                            <div className="text-[10px] font-bold text-[#0071e3] uppercase mb-1 tracking-wider">Hedef Satış Fiyatı (kg)</div>
                                            <div className="text-xl font-bold text-[#0071e3] font-mono">
                                                {results.unitPrice.toFixed(2)} {results.currency} / kg
                                            </div>
                                        </div>
                                        <div className="bg-[#eafaef] p-4 rounded-[6px] border border-[#cff7d9]">
                                            <div className="text-[10px] font-bold text-[#107c10] uppercase mb-1 tracking-wider">Toplam Teklif</div>
                                            <div className="text-xl font-bold text-[#107c10] font-mono">
                                                {results.totalPrice.toFixed(2)} {results.currency}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex flex-col md:flex-row gap-3 pt-2">
                                        <button
                                            onClick={handleSaveToHistory}
                                            className="btn-secondary flex-1 py-3 justify-center"
                                        >
                                            <Save size={18} className="mr-2" /> Geçmişe Kaydet
                                        </button>
                                        <button
                                            onClick={addToBasket}
                                            className="btn-primary flex-1 py-3 justify-center shadow-md shadow-blue-200"
                                        >
                                            <Plus size={18} className="mr-2" /> Sepete Ekle
                                        </button>
                                    </div>

                                    <div className="bg-[#fffbe6] p-3 rounded-[6px] border border-[#fff1b8] flex gap-2">
                                        <span className="text-lg">ℹ️</span>
                                        <span className="text-[11px] text-[#b37feb] font-medium leading-tight pt-1">
                                            "Geçmişe Kaydet" butonuna bastığınızda, bu hesaplama sistem veritabanına kaydedilir ve 'Geçmiş' sekmesinden görüntülenebilir.
                                        </span>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* MANUAL TAB */}
                    {activeTab === 'manual' && (
                        <div className="card-industrial p-6 animate-fade-in">
                            <h3 className="heading-industrial text-sm mb-6">Hızlı Teklif Girişi</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <label className="label-industrial">Ürün Seçimi (Opsiyonel)</label>
                                    <select
                                        value={manualForm.productId}
                                        onChange={e => setManualForm({ ...manualForm, productId: e.target.value })}
                                        className="select-industrial"
                                    >
                                        <option value="">Seçiniz...</option>
                                        {/* Show all inventory */}
                                        {inventory.map(i => (
                                            <option key={i.id} value={i.id}>{i.name} ({i.type})</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="label-industrial">Ürün Açıklaması (Opsiyonel)</label>
                                    <input
                                        type="text"
                                        value={manualForm.description}
                                        onChange={e => setManualForm({ ...manualForm, description: e.target.value })}
                                        className="input-industrial"
                                        placeholder="Örn: %99 Saflık"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="label-industrial">Hedef Satış Fiyatı (kg)</label>
                                    <input
                                        type="number"
                                        value={manualForm.unitPrice}
                                        onChange={e => setManualForm({ ...manualForm, unitPrice: e.target.value })}
                                        className="input-industrial"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="label-industrial">Para Birimi</label>
                                    <select
                                        value={manualForm.currency}
                                        onChange={e => setManualForm({ ...manualForm, currency: e.target.value })}
                                        className="select-industrial"
                                    >
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="TRY">TRY</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="label-industrial">Ambalaj (Opsiyonel)</label>
                                    <select
                                        value={manualForm.packagingId}
                                        onChange={e => setManualForm({ ...manualForm, packagingId: e.target.value })}
                                        className="select-industrial"
                                    >
                                        <option value="">Dökme / Belirtilmemiş</option>
                                        {inventory.filter(i => i.type === 'Ambalaj').map(i => (
                                            <option key={i.id} value={i.id}>{i.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="label-industrial">Vade (Gün)</label>
                                    <input
                                        type="number"
                                        value={manualForm.saleTermDays}
                                        onChange={e => setManualForm({ ...manualForm, saleTermDays: e.target.value })}
                                        className="input-industrial"
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="label-industrial">Nakliye Maliyeti</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            value={manualForm.shippingCost}
                                            onChange={e => setManualForm({ ...manualForm, shippingCost: e.target.value })}
                                            className="input-industrial flex-1"
                                        />
                                        <select
                                            value={manualForm.shippingCurrency}
                                            onChange={e => setManualForm({ ...manualForm, shippingCurrency: e.target.value })}
                                            className="select-industrial w-24 bg-[#f5f5f7]"
                                        >
                                            <option value="USD">USD</option>
                                            <option value="EUR">EUR</option>
                                            <option value="TRY">TRY</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="label-industrial">Genel Gider (kg)</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="number"
                                            step="0.001"
                                            value={manualForm.overheadPerKg}
                                            onChange={e => setManualForm({ ...manualForm, overheadPerKg: e.target.value })}
                                            className="input-industrial flex-1"
                                        />
                                        <select
                                            value={manualForm.overheadCurrency}
                                            onChange={e => setManualForm({ ...manualForm, overheadCurrency: e.target.value })}
                                            className="select-industrial w-24 bg-[#f5f5f7]"
                                        >
                                            <option value="USD">USD</option>
                                            <option value="EUR">EUR</option>
                                            <option value="TRY">TRY</option>
                                        </select>
                                    </div>
                                </div>
                            </div>
                            <div className="mt-8">
                                <button
                                    onClick={handleManualAdd}
                                    className="btn-primary-green w-full py-3 flex items-center justify-center text-base"
                                >
                                    <Plus className="h-5 w-5 mr-2" /> Sepete Ekle
                                </button>
                            </div>
                        </div>
                    )}

                    {/* HISTORY TAB */}
                    {activeTab === 'history' && (
                        <div className="card-industrial p-6 animate-fade-in">
                            <h3 className="heading-industrial text-sm mb-6">Hesaplama Geçmişi</h3>
                            <div className="space-y-4">
                                {history.length === 0 ? (
                                    <div className="text-center py-10 text-[#86868b]">Henüz kaydedilmiş hesaplama bulunamadı.</div>
                                ) : (
                                    history.map(item => (
                                        <div key={item.id} className="p-4 bg-[#f5f5f7] rounded-[6px] border border-[#d2d2d7] hover:border-[#86868b] transition-colors">
                                            <div className="flex justify-between items-start mb-3">
                                                <div>
                                                    <div className="font-bold text-[#1d1d1f] text-base">{item.product_name}</div>
                                                    <div className="text-[11px] text-[#86868b] mt-0.5">{new Date(item.created_at).toLocaleString('tr-TR')}</div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="font-bold text-[#0071e3] text-lg font-mono">{item.unit_price.toFixed(2)} {item.currency}</div>
                                                    <div className="text-[11px] text-[#86868b]">Maliyet: {item.unit_cost.toFixed(2)} {item.currency}</div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-4 gap-2 text-[11px] font-medium text-[#1d1d1f] bg-white p-2 rounded-[4px] border border-[#d2d2d7]">
                                                <div>Miktar: {item.quantity} kg</div>
                                                <div>Vade: {item.parameters?.sale_term_days} Gün</div>
                                                <div>Nakliye: {item.parameters?.shipping_cost}</div>
                                                <div>Marj: %{item.parameters?.profit_margin_percent}</div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT SIDE: BASKET (Keep existing) */}
                <div className="space-y-6">
                    <div className="card-industrial p-6 h-full flex flex-col">
                        <h3 className="heading-industrial text-sm mb-6 flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5 text-[#86868b]" /> Teklif Sepeti
                        </h3>

                        <div className="flex-1 overflow-y-auto space-y-3 mb-6 max-h-[400px]">
                            {quoteBasket.length === 0 ? (
                                <div className="text-center text-[#86868b] py-8 text-sm">
                                    Sepetiniz boş.
                                </div>
                            ) : (
                                quoteBasket.map(item => (
                                    <div key={item.id} className="bg-[#f5f5f7] p-3 rounded-[6px] border border-[#d2d2d7] relative group">
                                        <div className="font-bold text-[#1d1d1f] text-sm">
                                            {item.productName}
                                            {item.description && <span className="text-[11px] font-normal text-[#86868b] block mt-0.5">{item.description}</span>}
                                        </div>
                                        {item.isManual && <span className="badge-industrial badge-industrial-grey mt-1 inline-block">Manuel</span>}
                                        <div className="text-sm font-medium text-[#1d1d1f] mt-1 font-mono">
                                            {item.unitPrice.toFixed(2)} {item.currency} <span className="text-[#86868b] font-sans text-xs">/ kg</span>
                                        </div>
                                        {item.totalPrice > 0 && ( // Only show total price if it's calculated (not manual price list)
                                            <div className="font-bold text-[#0071e3] mt-1 text-sm">
                                                Top: {item.totalPrice.toFixed(2)} {item.currency}
                                            </div>
                                        )}
                                        <button
                                            onClick={() => removeFromBasket(item.id)}
                                            className="absolute top-2 right-2 text-[#d21e1e] hover:text-red-700 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="border-t border-[#d2d2d7] pt-6 space-y-4">
                            <div className="space-y-1">
                                <label className="label-industrial">Müşteri Adı</label>
                                <input
                                    type="text"
                                    value={quoteForm.customerName}
                                    onChange={e => setQuoteForm({ ...quoteForm, customerName: e.target.value })}
                                    className="input-industrial"
                                    placeholder="Firma Adı"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="label-industrial">İlgili Kişi</label>
                                <input
                                    type="text"
                                    value={quoteForm.contactPerson}
                                    onChange={e => setQuoteForm({ ...quoteForm, contactPerson: e.target.value })}
                                    className="input-industrial"
                                    placeholder="Ad Soyad"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="label-industrial">Geçerlilik Tarihi</label>
                                <input
                                    type="date"
                                    value={quoteForm.validityDate}
                                    onChange={e => setQuoteForm({ ...quoteForm, validityDate: e.target.value })}
                                    className="input-industrial"
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="label-industrial">Teklif Şartları</label>
                                <textarea
                                    rows="4"
                                    value={quoteForm.offerConditions}
                                    onChange={e => setQuoteForm({ ...quoteForm, offerConditions: e.target.value })}
                                    className="input-industrial resize-none text-xs"
                                />
                            </div>
                            <button
                                onClick={handleGenerateQuote}
                                disabled={quoteBasket.length === 0}
                                className="btn-primary w-full py-3 justify-center text-base"
                            >
                                <FileText className="h-5 w-5 mr-2" /> PDF Teklif Oluştur
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
