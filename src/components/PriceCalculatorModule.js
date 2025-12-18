import React, { useState, useEffect } from 'react';
import { Calculator, AlertCircle, FileText, Plus, Trash2, ShoppingCart } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { turkishToEnglish, preparePDFWithFont } from '../utils/exportUtils';

export default function PriceCalculatorModule({ recipes, inventory, exchangeRates }) {
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

        // 1. Raw Material Cost (in USD)
        let rawMaterialCostUSD = 0;
        recipe.ingredients.forEach(ing => {
            const item = inventory.find(i => i.id === parseInt(ing.itemId));
            if (item) {
                const itemCostUSD = toUSD(item.cost || 0, item.currency);
                rawMaterialCostUSD += itemCostUSD * (parseFloat(ing.percentage) / 100);
            }
        });

        // 2. Packaging Cost
        let packagingCostUSD = 0;
        if (form.packagingId) {
            const pkg = inventory.find(i => i.id === parseInt(form.packagingId));
            if (pkg) {
                packagingCostUSD = toUSD(pkg.cost || 0, pkg.currency);
            }
        }

        // 3. Operational Costs
        const shippingUSD = toUSD(parseVal(form.shippingCost), form.shippingCurrency);
        const overheadPerKgUSD = toUSD(parseVal(form.overheadPerKg), form.overheadCurrency);

        const quantity = parseVal(form.quantity);
        const totalRawMaterialUSD = rawMaterialCostUSD * quantity;

        // Start Packaging Logic Fix
        let totalPackagingUSD = 0;
        if (form.packagingId) {
            const pkg = inventory.find(i => i.id === parseInt(form.packagingId));
            if (pkg) {
                const pkgUnitCostUSD = toUSD(pkg.cost || 0, pkg.currency);
                const capacity = parseFloat(pkg.capacity_value) || 1; // Default to 1 if not set to avoid infinity
                const packageCount = quantity / capacity;
                totalPackagingUSD = pkgUnitCostUSD * packageCount;
            }
        }
        // End Packaging Logic Fix

        const totalOverheadUSD = overheadPerKgUSD * quantity;
        const totalShippingUSD = shippingUSD;

        const totalProductionCostUSD = totalRawMaterialUSD + totalPackagingUSD + totalOverheadUSD + totalShippingUSD;
        const unitCostUSD = totalProductionCostUSD / quantity;

        // 4. Financing Cost
        const monthlyRate = parseVal(form.monthlyInterestRate) / 100;
        const termDays = parseVal(form.saleTermDays);
        const financingCostUSD = totalProductionCostUSD * (monthlyRate / 30) * termDays;

        // 5. Profit
        const profitMargin = parseVal(form.profitMarginPercent) / 100;
        const totalCostWithFinanceUSD = totalProductionCostUSD + financingCostUSD;
        const profitAmountUSD = totalCostWithFinanceUSD * profitMargin;

        const totalPriceUSD = totalCostWithFinanceUSD + profitAmountUSD;
        const unitPriceUSD = totalPriceUSD / quantity;

        // Convert Results to Target Currency
        const target = form.currency;
        setResults({
            currency: target,
            unitCost: fromUSD(unitCostUSD, target),
            unitPrice: fromUSD(unitPriceUSD, target),
            totalPrice: fromUSD(totalPriceUSD, target),
            breakdown: {
                rawMaterial: fromUSD(totalRawMaterialUSD, target),
                packaging: fromUSD(totalPackagingUSD, target),
                overhead: fromUSD(totalOverheadUSD, target),
                shipping: fromUSD(totalShippingUSD, target),
                financing: fromUSD(financingCostUSD, target),
                profit: fromUSD(profitAmountUSD, target)
            },
            // Store raw form data for basket
            formData: { ...form },
            productName: recipe.product_id ? inventory.find(i => i.id === recipe.product_id)?.name : 'Unknown'
        });
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

        // --- HEADER ---
        doc.setFillColor(44, 62, 80); // Dark Blue
        doc.rect(0, 0, 210, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont(fontName, 'bold');
        doc.text('FİYAT TEKLİFİ', 105, 20, null, null, 'center');

        doc.setFontSize(10);
        doc.text('GROHN Kimya A.Ş.', 105, 30, null, null, 'center');

        // --- CUSTOMER INFO ---
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        doc.setFont(fontName, 'normal');

        const startY = 50;

        // Left Col
        doc.setFont(fontName, 'bold');
        doc.text('Sayın:', 14, startY);
        doc.setFont(fontName, 'normal');
        doc.text(quoteForm.customerName || 'Sayın Yetkili', 30, startY);

        if (quoteForm.contactPerson) {
            doc.setFont(fontName, 'bold');
            doc.text('İlgili Kişi:', 14, startY + 6);
            doc.setFont(fontName, 'normal');
            doc.text(quoteForm.contactPerson, 35, startY + 6);
        }

        // Right Col
        doc.setFont(fontName, 'bold');
        doc.text('Tarih:', 140, startY);
        doc.setFont(fontName, 'normal');
        doc.text(new Date().toLocaleDateString('tr-TR'), 160, startY);

        doc.setFont(fontName, 'bold');
        doc.text('Geçerlilik:', 140, startY + 6);
        doc.setFont(fontName, 'normal');
        doc.text(new Date(quoteForm.validityDate).toLocaleDateString('tr-TR'), 160, startY + 6);

        // --- QUOTE TABLE ---
        const tableBody = quoteBasket.map(item => {
            const packaging = inventory.find(i => i.id === parseInt(item.formData.packagingId));

            // If Manual (no quantity), we show "-" for quantity or handle differently
            const qtyDisplay = item.isManual ? '-' : `${item.formData.quantity} kg`;
            const descDisplay = item.description ? item.description : (item.productName || '-');

            return [
                descDisplay, // Ürün / Açıklama
                packaging?.name || 'Dökme', // Ambalaj
                `${item.formData.saleTermDays} Gün`, // Vade
                `${item.unitPrice.toFixed(2)} ${item.currency}`, // Birim Fiyat
            ];
        });

        autoTable(doc, {
            startY: startY + 20,
            head: [['Ürün / Açıklama', 'Ambalaj', 'Vade', 'Birim Fiyat']],
            body: tableBody,
            theme: 'grid',
            headStyles: { fillColor: [44, 62, 80], textColor: 255, font: fontName, fontStyle: 'bold' },
            bodyStyles: { font: fontName },
            styles: { fontSize: 10, cellPadding: 3 }
        });

        // --- CONDITIONS / FOOTER ---
        let finalY = doc.lastAutoTable.finalY + 15;

        doc.setFont(fontName, 'bold');
        doc.setFontSize(10);
        doc.text('TEKLİF ŞARTLARI', 14, finalY);

        doc.setFont(fontName, 'normal');
        doc.setFontSize(9);
        const splitText = doc.splitTextToSize(quoteForm.offerConditions, 180);
        doc.text(splitText, 14, finalY + 5);

        doc.save(`Teklif_${quoteForm.customerName || 'Musteri'}_${new Date().toISOString().split('T')[0]}.pdf`);
        setQuoteForm({ ...quoteForm, showModal: false });
    };

    const [activeTab, setActiveTab] = useState('calculator'); // 'calculator' | 'manual'
    const [manualForm, setManualForm] = useState({
        productId: '',
        description: '', // New field instead of Qty
        unitPrice: 0,
        currency: 'USD',
        packagingId: '',
        saleTermDays: 30
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
                packagingId: manualForm.packagingId
            },
            isManual: true
        };

        setQuoteBasket([...quoteBasket, newItem]);
        setManualForm({ ...manualForm, productId: '', description: '', unitPrice: 0 });
    };

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                <Calculator className="h-6 w-6 text-indigo-600" /> Fiyat ve Teklif
            </h2>

            <div className="flex gap-4 border-b border-slate-200 mb-4">
                <button
                    onClick={() => setActiveTab('calculator')}
                    className={`pb-2 px-4 font-medium transition-colors ${activeTab === 'calculator'
                        ? 'text-indigo-600 border-b-2 border-indigo-600'
                        : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Maliyet Hesapla
                </button>
                <button
                    onClick={() => setActiveTab('manual')}
                    className={`pb-2 px-4 font-medium transition-colors ${activeTab === 'manual'
                        ? 'text-indigo-600 border-b-2 border-indigo-600'
                        : 'text-slate-500 hover:text-slate-700'}`}
                >
                    Manuel Ekle
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* LEFT SIDE: INPUTS */}
                <div className="lg:col-span-2 space-y-6">

                    {/* CALCULATOR TAB */}
                    {activeTab === 'calculator' && (
                        <>
                            <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
                                <h3 className="text-lg font-bold mb-4 text-slate-700">Maliyet Parametreleri</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Existing Calculator Inputs */}
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Reçete / Ürün</label>
                                        <select
                                            value={form.recipeId}
                                            onChange={e => setForm({ ...form, recipeId: e.target.value })}
                                            className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                        >
                                            <option value="">Seçiniz...</option>
                                            {recipes.map(r => {
                                                const product = inventory.find(i => i.id === r.product_id);
                                                return <option key={r.id} value={r.id}>{product?.name || 'Bilinmeyen'}</option>;
                                            })}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Miktar (kg)</label>
                                        <input
                                            type="number"
                                            value={form.quantity}
                                            onChange={e => setForm({ ...form, quantity: e.target.value })}
                                            className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Ambalaj</label>
                                        <select
                                            value={form.packagingId}
                                            onChange={e => setForm({ ...form, packagingId: e.target.value })}
                                            className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                        >
                                            <option value="">Dökme (Ambalajsız)</option>
                                            {inventory.filter(i => i.type === 'Ambalaj').map(i => (
                                                <option key={i.id} value={i.id}>{i.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Toplam Nakliye</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                value={form.shippingCost}
                                                onChange={e => setForm({ ...form, shippingCost: e.target.value })}
                                                className="flex-1 border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                            />
                                            <select
                                                value={form.shippingCurrency}
                                                onChange={e => setForm({ ...form, shippingCurrency: e.target.value })}
                                                className="w-24 border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none bg-slate-50"
                                            >
                                                <option value="TRY">TRY</option>
                                                <option value="USD">USD</option>
                                                <option value="EUR">EUR</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Genel Gider (Birim/kg)</label>
                                        <div className="flex gap-2">
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={form.overheadPerKg}
                                                onChange={e => setForm({ ...form, overheadPerKg: e.target.value })}
                                                className="flex-1 border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                            />
                                            <select
                                                value={form.overheadCurrency}
                                                onChange={e => setForm({ ...form, overheadCurrency: e.target.value })}
                                                className="w-24 border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none bg-slate-50"
                                            >
                                                <option value="USD">USD</option>
                                                <option value="EUR">EUR</option>
                                                <option value="TRY">TRY</option>
                                            </select>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Satış Vadesi (Gün)</label>
                                        <input
                                            type="number"
                                            value={form.saleTermDays}
                                            onChange={e => setForm({ ...form, saleTermDays: e.target.value })}
                                            className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Aylık Faiz (%)</label>
                                        <input
                                            type="number"
                                            step="0.1"
                                            value={form.monthlyInterestRate}
                                            onChange={e => setForm({ ...form, monthlyInterestRate: e.target.value })}
                                            className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Kar Marjı (%)</label>
                                        <input
                                            type="number"
                                            value={form.profitMarginPercent}
                                            onChange={e => setForm({ ...form, profitMarginPercent: e.target.value })}
                                            className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">Para Birimi</label>
                                        <select
                                            value={form.currency}
                                            onChange={e => setForm({ ...form, currency: e.target.value })}
                                            className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                        >
                                            <option value="USD">USD</option>
                                            <option value="EUR">EUR</option>
                                            <option value="TRY">TRY</option>
                                        </select>
                                    </div>
                                </div>
                                <div className="mt-6 flex gap-2">
                                    <button
                                        onClick={calculatePrice}
                                        className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
                                    >
                                        <Calculator className="h-5 w-5" /> Hesapla
                                    </button>
                                    {results && (
                                        <button
                                            onClick={addToBasket}
                                            className="flex-1 bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
                                        >
                                            <Plus className="h-5 w-5" /> Sepete Ekle
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* RESULTS PREVIEW */}
                            {results && (
                                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 animate-fade-in">
                                    <h3 className="text-lg font-bold mb-4 text-slate-700">Hesaplama Sonucu ({results.productName})</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                            <div className="text-sm text-slate-500 mb-1">Birim Maliyet</div>
                                            <div className="text-2xl font-bold text-slate-700">
                                                {results.unitCost.toFixed(2)} {results.currency}
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                            <div className="text-sm text-slate-500 mb-1">Birim Fiyat (Teklif)</div>
                                            <div className="text-2xl font-bold text-indigo-600">
                                                {results.unitPrice.toFixed(2)} {results.currency}
                                            </div>
                                        </div>
                                        <div className="bg-slate-50 p-4 rounded-lg border border-slate-200">
                                            <div className="text-sm text-slate-500 mb-1">Toplam Tutar</div>
                                            <div className="text-2xl font-bold text-green-600">
                                                {results.totalPrice.toFixed(2)} {results.currency}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </>
                    )}

                    {/* MANUAL TAB */}
                    {activeTab === 'manual' && (
                        <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 animate-fade-in">
                            <h3 className="text-lg font-bold mb-4 text-slate-700">Hızlı Teklif Girişi</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Ürün Seçimi (Opsiyonel)</label>
                                    <select
                                        value={manualForm.productId}
                                        onChange={e => setManualForm({ ...manualForm, productId: e.target.value })}
                                        className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                    >
                                        <option value="">Seçiniz...</option>
                                        {/* Show all inventory */}
                                        {inventory.map(i => (
                                            <option key={i.id} value={i.id}>{i.name} ({i.type})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Ürün Açıklaması (Opsiyonel)</label>
                                    <input
                                        type="text"
                                        value={manualForm.description}
                                        onChange={e => setManualForm({ ...manualForm, description: e.target.value })}
                                        className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                        placeholder="Örn: %99 Saflık"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Birim Fiyat</label>
                                    <input
                                        type="number"
                                        value={manualForm.unitPrice}
                                        onChange={e => setManualForm({ ...manualForm, unitPrice: e.target.value })}
                                        className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Para Birimi</label>
                                    <select
                                        value={manualForm.currency}
                                        onChange={e => setManualForm({ ...manualForm, currency: e.target.value })}
                                        className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                    >
                                        <option value="USD">USD</option>
                                        <option value="EUR">EUR</option>
                                        <option value="TRY">TRY</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Ambalaj (Opsiyonel)</label>
                                    <select
                                        value={manualForm.packagingId}
                                        onChange={e => setManualForm({ ...manualForm, packagingId: e.target.value })}
                                        className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                    >
                                        <option value="">Dökme / Belirtilmemiş</option>
                                        {inventory.filter(i => i.type === 'Ambalaj').map(i => (
                                            <option key={i.id} value={i.id}>{i.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Vade (Gün)</label>
                                    <input
                                        type="number"
                                        value={manualForm.saleTermDays}
                                        onChange={e => setManualForm({ ...manualForm, saleTermDays: e.target.value })}
                                        className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                    />
                                </div>
                            </div>
                            <div className="mt-6">
                                <button
                                    onClick={handleManualAdd}
                                    className="w-full bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
                                >
                                    <Plus className="h-5 w-5" /> Sepete Ekle
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT SIDE: BASKET (Keep existing) */}
                <div className="space-y-6">
                    <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 h-full flex flex-col">
                        <h3 className="text-lg font-bold mb-4 text-slate-700 flex items-center gap-2">
                            <ShoppingCart className="h-5 w-5 text-indigo-600" /> Teklif Sepeti
                        </h3>

                        <div className="flex-1 overflow-y-auto space-y-3 mb-4 max-h-[400px]">
                            {quoteBasket.length === 0 ? (
                                <div className="text-center text-slate-400 py-8">
                                    Sepetiniz boş.
                                </div>
                            ) : (
                                quoteBasket.map(item => (
                                    <div key={item.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200 relative group">
                                        <div className="font-bold text-slate-700">
                                            {item.productName}
                                            {item.description && <span className="text-xs font-normal text-slate-500 block">{item.description}</span>}
                                        </div>
                                        {item.isManual && <span className="text-[10px] bg-slate-200 px-1 rounded text-slate-500">Manuel</span>}
                                        <div className="text-sm text-slate-500 mt-1">
                                            {item.unitPrice.toFixed(2)} {item.currency} / {item.formData.packagingId ? 'opsiyonel' : 'dökme'}
                                        </div>
                                        {item.totalPrice > 0 && ( // Only show total price if it's calculated (not manual price list)
                                            <div className="font-bold text-indigo-600 mt-1">
                                                Top: {item.totalPrice.toFixed(2)} {item.currency}
                                            </div>
                                        )}
                                        <button
                                            onClick={() => removeFromBasket(item.id)}
                                            className="absolute top-2 right-2 text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="border-t border-slate-100 pt-4 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Müşteri Adı</label>
                                <input
                                    type="text"
                                    value={quoteForm.customerName}
                                    onChange={e => setQuoteForm({ ...quoteForm, customerName: e.target.value })}
                                    className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                    placeholder="Firma Adı"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">İlgili Kişi</label>
                                <input
                                    type="text"
                                    value={quoteForm.contactPerson}
                                    onChange={e => setQuoteForm({ ...quoteForm, contactPerson: e.target.value })}
                                    className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                    placeholder="Ad Soyad"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Geçerlilik Tarihi</label>
                                <input
                                    type="date"
                                    value={quoteForm.validityDate}
                                    onChange={e => setQuoteForm({ ...quoteForm, validityDate: e.target.value })}
                                    className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Teklif Şartları</label>
                                <textarea
                                    rows="4"
                                    value={quoteForm.offerConditions}
                                    onChange={e => setQuoteForm({ ...quoteForm, offerConditions: e.target.value })}
                                    className="w-full border-2 border-slate-200 rounded-lg p-2 text-xs focus:border-indigo-500 focus:outline-none"
                                />
                            </div>
                            <button
                                onClick={handleGenerateQuote}
                                disabled={quoteBasket.length === 0}
                                className="w-full bg-slate-800 hover:bg-slate-900 disabled:bg-slate-300 text-white px-4 py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-colors"
                            >
                                <FileText className="h-5 w-5" /> PDF Teklif Oluştur
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
