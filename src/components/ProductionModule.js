import React, { useState, useEffect } from 'react';
import { Factory, Plus, Trash2, Calendar, Package, DollarSign, TrendingUp, Filter, AlertTriangle, FileText, Printer, CheckCircle, X, AlertCircle, Search, Beaker, Loader, Download, RefreshCw, XCircle } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { preparePDFWithFont } from '../utils/exportUtils';
import { supabase } from '../supabaseClient';

// Helper for safety
const parseInputFloat = (val) => {
    if (!val) return 0;
    const num = parseFloat(val);
    return isNaN(num) ? 0 : num;
};

export default function ProductionModule({ session, onRefresh, productions, recipes, inventory, qualitySpecs = [], customers = [], onPlan, onComplete, onDelete }) {
    const [viewMode, setViewMode] = useState('list'); // 'list', 'plan', 'complete'
    const [selectedProduction, setSelectedProduction] = useState(null);

    // Filters
    const [filterText, setFilterText] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [filterDateStart, setFilterDateStart] = useState('');
    const [filterDateEnd, setFilterDateEnd] = useState('');
    const [filterCustomer, setFilterCustomer] = useState('');

    // Planning Form State
    const [planForm, setPlanForm] = useState({
        recipeId: '',
        quantity: '',
        productionDate: new Date().toISOString().split('T')[0],
        notes: '',
        targetPackagingId: '',
        targetPackageCount: '',
        netFilling: '',
        customerId: '',
        density: '1.0'
    });

    // Completion Form State
    const [completeForm, setCompleteForm] = useState({
        qcStatus: 'Pass',
        qcNotes: '',
        packagingId: '',
        shippingCost: 0,
        overheadCost: 0,
        saleTermDays: 30,
        profitMarginPercent: 20,
        interestRate: 4,
        currency: 'USD'
    });

    // Adjustment Modal State
    const [showAdjModal, setShowAdjModal] = useState(false);
    const [selectedAdjProd, setSelectedAdjProd] = useState(null);
    const [adjForm, setAdjForm] = useState({ itemId: '', quantity: '' });

    const handlePlanSubmit = (e) => {
        e.preventDefault();
        onPlan(planForm).then(success => {
            if (success) {
                setViewMode('list');
                setPlanForm({
                    recipeId: '',
                    quantity: '',
                    productionDate: new Date().toISOString().split('T')[0],
                    notes: '',
                    targetPackagingId: '',
                    targetPackageCount: '',
                    netFilling: '',
                    customerId: '',
                    density: '1.0'
                });
            }
        });
    };

    const handleCompleteClick = (production) => {
        setSelectedProduction(production);
        setViewMode('complete');
    };

    const handleCompleteSubmit = (e) => {
        e.preventDefault();
        onComplete({ ...completeForm, productionId: selectedProduction.id }).then(success => {
            if (success) {
                setViewMode('list');
                setSelectedProduction(null);
                setCompleteForm({
                    packagingId: '',
                    shippingCost: 0,
                    overheadCost: 0,
                    saleTermDays: 30,
                    profitMarginPercent: 20,
                    qcStatus: 'Pass',
                    qcNotes: '',
                    currency: 'USD',
                    interestRate: 4
                });
            }
        });
    };

    const handleAdjSubmit = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase.rpc('add_production_adjustment', {
                p_production_id: selectedAdjProd.id,
                p_item_id: adjForm.itemId,
                p_quantity: adjForm.quantity,
                p_user_id: session.user.id
            });
            if (error) throw error;
            alert('Ek sarfiyat başarıyla eklendi ve stoktan düşüldü.');
            setShowAdjModal(false);
            setAdjForm({ itemId: '', quantity: '' });
        } catch (err) {
            alert('Hata: ' + err.message);
        }
    };


    const handlePrintWorkOrder = async (production) => {
        const recipe = recipes.find(r => r.id === production.recipe_id);
        const product = inventory.find(i => i.id === recipe?.product_id);
        const ingredients = recipe?.ingredients || [];
        const customer = customers.find(c => c.id === production.customer_id);

        const doc = await preparePDFWithFont();
        const fontName = doc.activeFont || 'helvetica';

        // ... (PDF Generation Logic - unchanged for brevity/consistency)
        // Replicating previous logic to ensure no regression
        doc.setFillColor(63, 81, 181);
        doc.rect(0, 0, 210, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont(fontName, 'bold');
        doc.text('ÜRETİM İŞ EMRİ', 105, 20, null, null, 'center');
        doc.setFontSize(10);
        doc.text('GROHN Kimya A.Ş.', 105, 30, null, null, 'center');

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        doc.setFont(fontName, 'normal');
        const startY = 50;

        doc.setFont(fontName, 'bold');
        doc.text('İş Emri No:', 14, startY);
        doc.text('Tarih:', 14, startY + 8);
        doc.text('Hedef Miktar:', 14, startY + 16);
        doc.text('Müşteri:', 14, startY + 24);

        doc.setFont(fontName, 'normal');
        doc.text(production.lot_number, 50, startY);
        doc.text(new Date(production.production_date).toLocaleDateString('tr-TR'), 50, startY + 8);
        doc.text(`${production.quantity} kg`, 50, startY + 16);
        doc.text(customer ? customer.name : 'Stok Üretimi', 50, startY + 24);

        doc.setFont(fontName, 'bold');
        doc.text('Ürün:', 110, startY);
        doc.text('Reçete:', 110, startY + 8);

        let packingY = startY + 32;
        doc.setFont(fontName, 'normal');
        doc.text(product?.name || '-', 140, startY);
        const recipeName = recipe?.name || (recipe?.customer_id ? 'Müşteri Özel Reçetesi' : 'Standart Reçete');
        doc.text(`${recipeName} (#${recipe?.id || '-'})`, 140, startY + 8);

        if (production.target_packaging_id) {
            const pkg = inventory.find(i => i.id === production.target_packaging_id);
            if (pkg) {
                doc.setFont(fontName, 'bold');
                doc.text('Dolum:', 14, packingY);
                doc.setFont(fontName, 'normal');
                doc.text(`${pkg.name} x ${production.target_package_count} Adet`, 50, packingY);
                doc.setFontSize(9);
                doc.text(`(Beher ambalaj: ${pkg.capacity_value} ${pkg.capacity_unit})`, 50, packingY + 5);
                doc.setFontSize(11);
                packingY += 12;
            }
        }

        if (production.notes) {
            doc.setFillColor(240, 240, 240);
            doc.rect(14, packingY, 182, 10, 'F');
            doc.setFont(fontName, 'italic');
            doc.text(`Notlar: ${production.notes}`, 16, packingY + 6);
        }

        const pkgCount = parseInputFloat(production.target_package_count);
        const hasPackaging = production.target_packaging_id && pkgCount > 0;
        let tableHeaders = ['Hammadde', 'Kod', 'Oran', 'Toplam Miktar'];
        if (hasPackaging) tableHeaders.push('Ambalaj Başına');
        tableHeaders.push('Tartım Onay');

        const tableData = ingredients.map(ing => {
            const item = inventory.find(i => i.id === ing.itemId);
            const totalQty = (production.quantity * ing.percentage / 100);
            const row = [
                item?.name || '?',
                item?.product_code || item?.id?.toString() || '-',
                `%${ing.percentage}`,
                `${totalQty.toFixed(2)} kg`
            ];
            if (hasPackaging) {
                const perPackageQty = (totalQty / pkgCount).toFixed(2);
                row.push(`${perPackageQty} kg`);
            }
            row.push('__________');
            return row;
        });

        autoTable(doc, {
            startY: packingY + 15,
            head: [tableHeaders],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [63, 81, 181], textColor: 255 },
            styles: { fontSize: 10, cellPadding: 3, font: fontName },
            columnStyles: { [hasPackaging ? 5 : 4]: { halign: 'center' } }
        });

        let finalY = doc.lastAutoTable.finalY + 15;
        doc.setFont(fontName, 'bold');
        doc.text('KALİTE KONTROL PARAMETRELERİ', 14, finalY);
        doc.line(14, finalY + 2, 200, finalY + 2);
        finalY += 10;

        const productSpecs = qualitySpecs.filter(s => s.product_id === product?.id);
        let qcItems = productSpecs.length > 0 ? productSpecs.map(s => [
            s.parameter_name, `min: ${s.min_value || '-'}  max: ${s.max_value || '-'}`, '__________'
        ]) : [['Görünüş', 'Standart', '__________'], ['Renk', 'Standart', '__________'], ['pH', 'Spec', '__________']];

        autoTable(doc, {
            startY: finalY,
            head: [['Parametre', 'Standart', 'Ölçülen Değer']],
            body: qcItems,
            theme: 'plain',
            styles: { fontSize: 10, cellPadding: 2, font: fontName },
            columnStyles: { 0: { fontStyle: 'bold', cellWidth: 60 } }
        });

        finalY = doc.lastAutoTable.finalY + 20;
        doc.setFont(fontName, 'bold');
        doc.text('Üretim Sorumlusu', 30, finalY);
        doc.text('Kalite Kontrol', 140, finalY);
        doc.rect(30, finalY + 5, 50, 20);
        doc.rect(140, finalY + 5, 50, 20);
        doc.save(`is_emri_${production.lot_number}.pdf`);
    };

    const handlePrintRevisionOrder = async (production) => {
        const recipe = recipes.find(r => r.id === production.recipe_id);
        const product = inventory.find(i => i.id === recipe?.product_id);
        const customer = customers.find(c => c.id === production.customer_id);

        const doc = await preparePDFWithFont();
        const fontName = doc.activeFont || 'helvetica';

        // HEADER (RED for Revision)
        doc.setFillColor(220, 38, 38); // Red-600
        doc.rect(0, 0, 210, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont(fontName, 'bold');
        doc.text('REVİZYON / DÜZELTME İŞ EMRİ', 105, 20, null, null, 'center');
        doc.setFontSize(10);
        doc.text('GROHN Kimya A.Ş.', 105, 30, null, null, 'center');

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        doc.setFont(fontName, 'normal');
        const startY = 50;

        doc.setFont(fontName, 'bold');
        doc.text('İş Emri No:', 14, startY);
        doc.text('Tarih:', 14, startY + 8);
        doc.text('Hedef Miktar:', 14, startY + 16);
        doc.text('Ürün:', 14, startY + 24);

        doc.setFont(fontName, 'normal');
        doc.text(production.lot_number, 50, startY);
        doc.text(new Date(production.production_date).toLocaleDateString('tr-TR'), 50, startY + 8);
        doc.text(`${production.quantity} kg`, 50, startY + 16);
        doc.text(product?.name || '-', 50, startY + 24);

        let currentY = startY + 35;

        // ADJUSTMENT INSTRUCTIONS BOX
        doc.setFillColor(255, 247, 237); // Orange-50
        doc.setDrawColor(249, 115, 22); // Orange-500
        doc.rect(14, currentY, 182, 40, 'FD');

        doc.setFont(fontName, 'bold');
        doc.setTextColor(194, 65, 12); // Orange-800
        doc.text('YAPILACAK DÜZELTME / İLAVE İŞLEMİ:', 20, currentY + 8);

        doc.setFont(fontName, 'normal');
        doc.setTextColor(0, 0, 0);
        const splitNotes = doc.splitTextToSize(production.adjustment_notes || 'Belirtilen bir not yok.', 170);
        doc.text(splitNotes, 20, currentY + 16);

        currentY += 50;

        // Signatures
        doc.setFont(fontName, 'bold');
        doc.text('Üretim Sorumlusu', 30, currentY);
        doc.text('Kalite Kontrol', 140, currentY);
        doc.setDrawColor(0);
        doc.rect(30, currentY + 5, 50, 20);
        doc.rect(140, currentY + 5, 50, 20);

        doc.save(`revizyon_emri_${production.lot_number}.pdf`);
    };

    // --- FILTER LOGIC ---
    const filteredProductions = productions.filter(p => {
        const recipe = recipes.find(r => r.id === p.recipe_id);
        const product = recipe ? inventory.find(i => i.id === recipe.product_id) : null;
        const customer = customers.find(c => c.id === p.customer_id);

        const isPlanned = p.status === 'Planned';
        const statusMatch = filterStatus === 'All'
            ? true
            : filterStatus === 'Planned'
                ? isPlanned
                : !isPlanned;

        const dateMatch = (!filterDateStart || p.production_date >= filterDateStart) &&
            (!filterDateEnd || p.production_date <= filterDateEnd);

        const customerMatch = !filterCustomer || p.customer_id === parseInt(filterCustomer);

        const searchLower = filterText.toLowerCase();
        const textMatch = !filterText ||
            (p.lot_number && p.lot_number.toLowerCase().includes(searchLower)) ||
            (product && product.name && product.name.toLowerCase().includes(searchLower)) ||
            (product && product.product_code && product.product_code.toLowerCase().includes(searchLower)) ||
            (customer && customer.name && customer.name.toLowerCase().includes(searchLower));

        return statusMatch && dateMatch && customerMatch && textMatch;
    });

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Factory className="h-6 w-6 text-indigo-600" /> Üretim Yönetimi
                </h2>
                <div className="flex gap-2">
                    {viewMode === 'list' && (
                        <button
                            onClick={() => setViewMode('plan')}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                        >
                            <Plus className="h-4 w-4" /> Yeni Plan
                        </button>
                    )}
                    {viewMode !== 'list' && (
                        <button
                            onClick={() => { setViewMode('list'); setSelectedProduction(null); }}
                            className="text-slate-500 hover:text-slate-700 flex items-center gap-1"
                        >
                            <X className="h-5 w-5" /> İptal
                        </button>
                    )}
                </div>
            </div>

            {/* FILTER BAR - Only in List Mode */}
            {viewMode === 'list' && (
                <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
                    <div className="md:col-span-2">
                        <label className="text-xs font-bold text-slate-500 uppercase">Arama</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="LOT, Ürün veya Müşteri ara..."
                                className="w-full pl-9 p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                                value={filterText}
                                onChange={e => setFilterText(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Durum</label>
                        <select
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                            value={filterStatus}
                            onChange={e => setFilterStatus(e.target.value)}
                        >
                            <option value="All">Tümü</option>
                            <option value="Planned">Planlanan</option>
                            <option value="Completed">Tamamlanan</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Müşteri</label>
                        <select
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500"
                            value={filterCustomer}
                            onChange={e => setFilterCustomer(e.target.value)}
                        >
                            <option value="">Tümü</option>
                            <option value="0">Stok (Müşterisiz)</option> {/* Special case if needed, or handle null */}
                            {customers.map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Başlangıç</label>
                        <input
                            type="date"
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-sm"
                            value={filterDateStart}
                            onChange={e => setFilterDateStart(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-500 uppercase">Bitiş</label>
                        <input
                            type="date"
                            className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:border-indigo-500 text-sm"
                            value={filterDateEnd}
                            onChange={e => setFilterDateEnd(e.target.value)}
                        />
                    </div>
                </div>
            )}

            {/* PLANNING FORM */}
            {viewMode === 'plan' && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
                    <h3 className="text-lg font-bold mb-4 text-slate-700">Yeni Üretim Planı</h3>
                    <form onSubmit={handlePlanSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Reçete / Ürün</label>
                            <select
                                required
                                value={planForm.recipeId}
                                onChange={e => {
                                    const rId = e.target.value;
                                    let newDensity = '1.0';
                                    if (rId) {
                                        const r = recipes.find(x => x.id === parseInt(rId));
                                        if (r && r.product_id) {
                                            const specs = qualitySpecs.filter(s => s.product_id === r.product_id);
                                            const densSpec = specs.find(s =>
                                                s.parameter_name.toLowerCase().includes('yoğunluk') ||
                                                s.parameter_name.toLowerCase().includes('density')
                                            );
                                            if (densSpec) newDensity = densSpec.target_value || densSpec.min_value || '1.0';
                                        }
                                    }
                                    setPlanForm({ ...planForm, recipeId: rId, density: newDensity });
                                }}
                                className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                            >
                                <option value="">Seçiniz...</option>
                                {recipes.map(r => {
                                    const product = inventory.find(i => i.id === r.product_id);
                                    return <option key={r.id} value={r.id}>{product?.product_code || product?.id} - {product?.name || 'Bilinmeyen'}</option>;
                                })}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Müşteri (Opsiyonel)</label>
                            <select
                                value={planForm.customerId}
                                onChange={e => setPlanForm({ ...planForm, customerId: e.target.value })}
                                className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                            >
                                <option value="">Stok Üretimi (Seçiniz...)</option>
                                {customers.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                            <p className="text-[10px] text-slate-400 mt-1">Özel sipariş ise seçiniz.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Planlanan Miktar (kg)</label>
                            <input
                                required
                                type="number"
                                value={planForm.quantity}
                                onChange={e => {
                                    const qty = e.target.value;
                                    let count = '';
                                    if (qty && planForm.netFilling) {
                                        count = Math.ceil(parseFloat(qty) / parseFloat(planForm.netFilling));
                                    }
                                    setPlanForm({ ...planForm, quantity: qty, targetPackageCount: count });
                                }}
                                className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Üretim Tarihi</label>
                            <input
                                required
                                type="date"
                                value={planForm.productionDate}
                                onChange={e => setPlanForm({ ...planForm, productionDate: e.target.value })}
                                className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                            />
                        </div>

                        <div className="md:col-span-2 bg-indigo-50 p-4 rounded-lg border border-indigo-100">
                            <h4 className="font-bold text-indigo-700 mb-2 flex items-center gap-2">
                                <Package className="h-4 w-4" /> Dolum / Ambalaj Planı
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Hedef Ambalaj</label>
                                    <select
                                        value={planForm.targetPackagingId}
                                        onChange={e => setPlanForm({ ...planForm, targetPackagingId: e.target.value })}
                                        className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                    >
                                        <option value="">Seçiniz (Opsiyonel)</option>
                                        {inventory.filter(i => i.type === 'Ambalaj').map(i => (
                                            <option key={i.id} value={i.id}>
                                                {i.product_code || i.id} - {i.name} ({i.capacity_value} {i.capacity_unit || 'L'})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Ambalaj Başına Net Dolum (kg)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={planForm.netFilling || ''}
                                        onChange={e => {
                                            const val = e.target.value;
                                            let count = '';
                                            if (val && planForm.quantity) {
                                                count = Math.ceil(parseFloat(planForm.quantity) / parseFloat(val));
                                            }
                                            setPlanForm({ ...planForm, netFilling: val, targetPackageCount: count });
                                        }}
                                        className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                        placeholder="Örn: 20"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Hesaplanan Adet</label>
                                    <input
                                        type="number"
                                        value={planForm.targetPackageCount}
                                        readOnly
                                        className="w-full bg-slate-100 border-2 border-slate-200 rounded-lg p-2 text-slate-500 font-mono"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-sm font-medium text-slate-700 mb-1">Notlar</label>
                            <input
                                type="text"
                                value={planForm.notes}
                                onChange={e => setPlanForm({ ...planForm, notes: e.target.value })}
                                className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                            />
                        </div>
                        <div className="md:col-span-2 flex justify-end">
                            <button type="submit" className="bg-indigo-600 text-white px-6 py-2 rounded-lg font-medium">
                                Planı Kaydet
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* COMPLETION FORM */}
            {viewMode === 'complete' && selectedProduction && (
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200">
                    <div className="mb-6 bg-indigo-50 p-4 rounded-lg">
                        <h3 className="font-bold text-indigo-800">Üretim Tamamlama: {selectedProduction.lot_number}</h3>
                        <p className="text-sm text-indigo-600">Hedef: {selectedProduction.quantity} kg</p>
                    </div>

                    <form onSubmit={handleCompleteSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">


                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Ambalaj</label>
                            <select
                                required
                                value={completeForm.packagingId}
                                onChange={e => setCompleteForm({ ...completeForm, packagingId: e.target.value })}
                                className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                            >
                                <option value="">Seçiniz...</option>
                                {inventory.filter(i => i.type === 'Ambalaj').map(i => (
                                    <option key={i.id} value={i.id}>{i.product_code || i.id} - {i.name}</option>
                                ))}
                            </select>
                        </div>
                        <input type="hidden" value={completeForm.shippingCost} />
                        <input type="hidden" value={completeForm.overheadCost} />
                        <input type="hidden" value={completeForm.saleTermDays} />
                        <input type="hidden" value={completeForm.profitMarginPercent} />
                        <input type="hidden" value={completeForm.interestRate} />
                        <input type="hidden" value={completeForm.currency} />

                        <div className="md:col-span-3 flex justify-end gap-2 mt-4">
                            <button type="submit" className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2">
                                <CheckCircle className="h-5 w-5" /> Üretimi Tamamla & Stoka Al
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* LIST */}
            <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-slate-50 text-slate-500 text-xs uppercase font-semibold">
                            <tr>
                                <th className="px-6 py-3 text-left">Durum</th>
                                <th className="px-6 py-3 text-left">Tarih / LOT</th>
                                <th className="px-6 py-3 text-left">Ürün</th>    {/* Split Column */}
                                <th className="px-6 py-3 text-left">Müşteri</th> {/* Split Column */}
                                <th className="px-6 py-3 text-right">Miktar</th>
                                <th className="px-6 py-3 text-left">KK</th>
                                <th className="px-6 py-3 text-right">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {filteredProductions.map(p => {
                                const recipe = recipes.find(r => r.id === p.recipe_id);
                                const product = recipe ? inventory.find(i => i.id === recipe.product_id) : null;
                                const isPlanned = p.status === 'Planned' || p.status === 'In QC';
                                const customer = customers.find(c => c.id === p.customer_id);

                                return (
                                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${isPlanned ? 'bg-yellow-100 text-yellow-700' : 'bg-green-100 text-green-700'}`}>
                                                {isPlanned ? 'Planlandı' : 'Tamamlandı'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-slate-600">
                                            <div>{new Date(p.production_date).toLocaleDateString('tr-TR')}</div>
                                            <div className="text-xs font-mono text-indigo-600">{p.lot_number}</div>
                                        </td>

                                        {/* Product Column */}
                                        <td className="px-6 py-4 font-medium text-slate-800">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs text-slate-400 font-mono">{product?.product_code || product?.id}</span>
                                                <span className="truncate max-w-[150px]" title={product?.name}>{product?.name || '-'}</span>
                                            </div>
                                        </td>

                                        {/* Customer Column */}
                                        <td className="px-6 py-4">
                                            {customer ? (
                                                <div className="text-xs text-orange-600 flex items-center gap-1 font-bold">
                                                    <FileText size={12} /> {customer.name}
                                                </div>
                                            ) : (
                                                <span className="text-slate-300 text-xs italic">Stok</span>
                                            )}
                                        </td>

                                        <td className="px-6 py-4 text-right font-medium">
                                            {p.quantity} kg
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            {p.qc_status && (
                                                <span className={`flex items-center gap-1 ${p.qc_status === 'Pass' ? 'text-green-600' : 'text-red-600'}`}>
                                                    {p.qc_status === 'Pass' ? <CheckCircle className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                                    {p.qc_status}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 text-right flex justify-end gap-2">
                                            {isPlanned && (
                                                <>
                                                    <button
                                                        onClick={() => handlePrintWorkOrder(p)}
                                                        className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg"
                                                        title="İş Emri Yazdır"
                                                    >
                                                        <Printer className="h-4 w-4" />
                                                    </button>

                                                    {/* ACTION BUTTONS LOGIC */}
                                                    {p.qc_status === 'Rejected' || p.qc_status === 'Fail' ? (
                                                        <div className="flex items-center gap-1">
                                                            <span className="p-2 text-red-600 bg-red-50 rounded-lg text-xs font-bold flex items-center gap-1" title="Laboratuvar RED verdi">
                                                                <XCircle className="h-4 w-4" /> RED
                                                            </span>
                                                            <button
                                                                onClick={() => handlePrintRevisionOrder(p)}
                                                                className="p-2 text-orange-600 hover:bg-orange-50 rounded-lg"
                                                                title="Düzeltme Föyü Yazdır"
                                                            >
                                                                <FileText className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={() => { setSelectedAdjProd(p); setShowAdjModal(true); }}
                                                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg"
                                                                title="Ek Sarfiyat Ekle (Stoktan Düş)"
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                            </button>
                                                            <button
                                                                onClick={async () => {
                                                                    if (!window.confirm('Bu üretimi revize etmek (başa almak) istiyor musunuz?')) return;
                                                                    const { error } = await supabase.from('productions').update({ status: 'Planned', qc_status: null, lot_number: null }).eq('id', p.id);
                                                                    if (!error) { alert('Üretim tekrar Planlandı statüsüne alındı.'); if (onRefresh) onRefresh(); }
                                                                }}
                                                                className="p-2 text-slate-500 hover:bg-slate-100 rounded-lg"
                                                                title="Revize Et (Başa Al)"
                                                            >
                                                                <RefreshCw className="h-4 w-4" />
                                                            </button>
                                                        </div>
                                                    ) : p.qc_status === 'Approved' ? (
                                                        <button
                                                            onClick={() => handleCompleteClick(p)}
                                                            className="p-2 text-white bg-green-600 hover:bg-green-700 rounded-lg shadow-sm animate-pulse"
                                                            title="Üretimi Tamamla (Onaylı)"
                                                        >
                                                            <CheckCircle className="h-4 w-4" />
                                                        </button>
                                                    ) : p.status === 'In QC' ? (
                                                        <span className="p-2 text-orange-600 bg-orange-50 rounded-lg text-xs font-bold flex items-center gap-1 cursor-help" title="Laboratuvar onayı bekleniyor">
                                                            <Beaker className="h-4 w-4" /> Testte
                                                        </span>
                                                    ) : (
                                                        <button
                                                            onClick={async () => {
                                                                if (!window.confirm('Bu üretim için Kalite Kontrol testi başlatılsın mı?')) return;
                                                                try {
                                                                    const { error } = await supabase.rpc('send_production_to_qc', {
                                                                        p_production_id: p.id,
                                                                        p_user_id: session.user.id
                                                                    });
                                                                    if (error) throw error;
                                                                    alert('Test talebi Kalite Kontrol birimine iletildi.');
                                                                    if (onRefresh) onRefresh();
                                                                } catch (err) {
                                                                    alert('Hata: ' + err.message);
                                                                }
                                                            }}
                                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                                                            title="Test İste (Kalite Kontrol)"
                                                        >
                                                            <Beaker className="h-4 w-4" />
                                                        </button>
                                                    )}

                                                </>
                                            )}
                                            <button
                                                onClick={() => onDelete(p.id)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                                                title="Sil"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredProductions.length === 0 && (
                                <tr>
                                    <td colSpan="7" className="px-6 py-8 text-center text-slate-400">
                                        Kriterlere uygun kayıt bulunamadı.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            {/* ADJUSTMENT MODAL */}
            {showAdjModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
                        <div className="flex justify-between items-center mb-6 border-b pb-4">
                            <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                                <Plus className="text-indigo-600" /> Ek Sarfiyat Ekle
                            </h3>
                            <button onClick={() => setShowAdjModal(false)} className="text-slate-400 hover:text-slate-600">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleAdjSubmit} className="space-y-4">
                            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-100 text-sm text-yellow-800 mb-4">
                                <p className="font-bold flex items-center gap-1"><AlertTriangle size={14} /> Dikkat:</p>
                                <p>Bu işlem stoğu hemen düşer ve maliyeti üretime yansıtır.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Eklenecek Malzeme</label>
                                <select
                                    required
                                    className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
                                    value={adjForm.itemId}
                                    onChange={e => setAdjForm({ ...adjForm, itemId: e.target.value })}
                                >
                                    <option value="">Seçiniz...</option>
                                    {inventory.filter(i => i.type === 'Hammadde').map(i => (
                                        <option key={i.id} value={i.id}>{i.product_code} - {i.name} (Stok: {i.stock_qty || '-'} {i.unit})</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-slate-700 mb-1">Miktar</label>
                                <div className="flex gap-2">
                                    <input
                                        required
                                        type="number"
                                        step="0.001"
                                        className="w-full p-3 border border-slate-300 rounded-lg focus:outline-none focus:border-indigo-500"
                                        value={adjForm.quantity}
                                        onChange={e => setAdjForm({ ...adjForm, quantity: e.target.value })}
                                        placeholder="0.000"
                                    />
                                </div>
                            </div>

                            <div className="pt-4 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setShowAdjModal(false)}
                                    className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg font-medium"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-bold shadow transition-colors"
                                >
                                    Ekle ve Stoktan Düş
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
