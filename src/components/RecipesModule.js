import React, { useState } from 'react';
import { Trash2, Plus, Beaker, Save, X, Search, Edit, Printer, Filter } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { turkishToEnglish, preparePDFWithFont } from '../utils/exportUtils';
import { drawCIHeader, drawCIFooter, drawCIMetadataGrid, drawCIWrappedText, CI_PALETTE } from '../utils/pdfCIUtils';

export default function RecipesModule({ recipes, inventory, customers, globalSettings = {}, onSave, onDelete }) {
    const [showForm, setShowForm] = useState(false);

    // Standardized Filter State
    const [filters, setFilters] = useState({
        search: '',
        customerId: 'all'
    });

    const [formData, setFormData] = useState({
        id: null,
        productId: '',
        isNewProduct: false,
        newProductName: '',
        density: 1.0,
        ghsSymbols: [],
        customerId: '',
        ingredients: []
    });

    const handleAddIngredient = () => {
        setFormData({
            ...formData,
            ingredients: [...formData.ingredients, { itemId: '', percentage: '' }]
        });
    };

    const handleRemoveIngredient = (index) => {
        const newIng = [...formData.ingredients];
        newIng.splice(index, 1);
        setFormData({ ...formData, ingredients: newIng });
    };

    const handleIngredientChange = (index, field, value) => {
        const newIng = [...formData.ingredients];
        newIng[index][field] = value;
        setFormData({ ...formData, ingredients: newIng });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        // Validate percentages
        const total = formData.ingredients.reduce((sum, i) => sum + parseFloat(i.percentage || 0), 0);
        if (Math.abs(total - 100) > 0.1) {
            alert(`Toplam oran %100 olmalıdır! (Şu an: %${total.toFixed(2)})`);
            return;
        }

        onSave(formData, formData.isNewProduct, formData.newProductName).then(success => {
            if (success) {
                setShowForm(false);
                setFormData({
                    id: null,
                    productId: '',
                    isNewProduct: false,
                    newProductName: '',
                    density: 1.0,
                    customerId: '',
                    ingredients: []
                });
            }
        });
    };

    const handleEdit = (recipe) => {
        setFormData({
            id: recipe.id,
            productId: recipe.product_id,
            isNewProduct: false,
            newProductName: '',
            density: 1.0,
            customerId: recipe.customer_id || '',
            ingredients: recipe.ingredients.map(i => ({
                itemId: i.itemId || i.item_id,
                percentage: i.percentage
            }))
        });
        setShowForm(true);
    };

    const filteredRecipes = recipes.filter(recipe => {
        const product = inventory.find(i => i.id === recipe.product_id);
        const customer = customers.find(c => c.id === recipe.customer_id);

        const productName = product?.name?.toLowerCase() || '';
        const customerName = customer?.name?.toLowerCase() || '';
        const search = filters.search.toLowerCase();

        const textMatch = !search || productName.includes(search) || customerName.includes(search);

        const customerMatch = filters.customerId === 'all' ||
            (filters.customerId === 'general' && !recipe.customer_id) ||
            (recipe.customer_id && recipe.customer_id.toString() === filters.customerId);

        return textMatch && customerMatch;
    });

    const [selectedRecipe, setSelectedRecipe] = useState(null);

    const handlePrintRecipe = async (recipe) => {
        const product = inventory.find(i => i.id === recipe.product_id);
        const customer = customers.find(c => c.id === recipe.customer_id);

        const doc = await preparePDFWithFont();
        const fontName = doc.activeFont || 'helvetica';

        // Initial Header (Professional Layout)
        const docDate = new Date().toLocaleDateString('tr-TR');
        drawCIHeader(doc, 'ANA REÇETE FORMU', 'REÇETE YÖNETİM MERKEZİ', docDate, `RCT-${recipe.id}`);
        const startY = 45;

        // Metadata Grid (Cleaned)
        const metaData = [
            { label: 'ÜRÜN ADI', value: product?.name || '-' },
            { label: 'MÜŞTERİ', value: customer?.name || 'Genel Reçete' },
            { label: 'YOĞUNLUK', value: `${product?.density || '-'} g/ml` }
        ];

        let currY = drawCIMetadataGrid(doc, 14, startY, metaData, 2);
        currY += 5;

        // --- INGREDIENTS TABLE ---
        const tableData = recipe.ingredients.map(ing => {
            const currentItemId = ing.itemId || ing.item_id;
            const item = inventory.find(i => i.id === parseInt(currentItemId));
            return [
                item?.name || '?',
                item?.product_code || item?.id?.toString() || '-',
                `%${ing.percentage}`
            ];
        });

        autoTable(doc, {
            startY: currY,
            head: [['Hammadde', 'Stok Kodu', 'Oran']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: CI_PALETTE.apple_blue, textColor: 255 },
            styles: { fontSize: 10, cellPadding: 3, font: fontName },
            foot: [['TOPLAM', '', `%${recipe.ingredients.reduce((s, i) => s + parseFloat(i.percentage), 0).toFixed(2)}`]],
            footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' },
            margin: { top: 40, bottom: 30 },
            didDrawPage: (data) => {
                const docDate = new Date().toLocaleDateString('tr-TR');
                drawCIHeader(doc, 'ANA REÇETE FORMU', 'REÇETE YÖNETİM MERKEZİ', docDate, `RCT-${recipe.id}`);
                drawCIFooter(doc, globalSettings, 'Reçete Yönetim Sistemi v4.1.0');
            }
        });

        doc.save(`RecipeMaster_${product?.name || 'detay'}.pdf`);
    };

    const RecipeDetailModal = ({ recipe, onClose }) => {
        if (!recipe) return null;
        const product = inventory.find(i => i.id === recipe.product_id);
        const customer = customers.find(c => c.id === recipe.customer_id);

        return (
            <div className="modal-overlay-industrial flex items-center justify-center z-50 p-4" onClick={onClose}>
                <div className="modal-content-industrial w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                    <div className="modal-header-industrial">
                        <h3 className="text-sm font-bold text-[#1d1d1f] uppercase tracking-wide flex items-center gap-2">
                            <Beaker className="h-4 w-4 text-[#0071e3]" />
                            Reçete Detayı
                        </h3>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => handlePrintRecipe(recipe)}
                                className="text-[#0071e3] hover:text-[#0077ed] text-xs font-bold uppercase tracking-wider flex items-center gap-1 transition-colors"
                            >
                                <Printer className="h-3 w-3" /> Yazdır
                            </button>
                            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    <div className="modal-body-industrial space-y-6">
                        <div className="grid grid-cols-3 gap-4">
                            <div>
                                <label className="block text-[10px] font-bold text-[#86868b] uppercase tracking-wider">Ürün</label>
                                <div className="text-sm font-bold text-[#1d1d1f]">{product?.name || 'Bilinmeyen Ürün'}</div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[#86868b] uppercase tracking-wider">Müşteri</label>
                                <div className="text-sm font-bold text-[#1d1d1f]">{customer?.name || 'Genel Reçete'}</div>
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-[#86868b] uppercase tracking-wider">Yoğunluk</label>
                                <div className="text-sm font-bold text-[#1d1d1f] font-mono">{product?.density || '-'} g/ml</div>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-[#1d1d1f] text-xs uppercase tracking-wide mb-2 border-b border-[#d2d2d7] pb-1">İçerik (Hammadde Listesi)</h4>
                            <div className="bg-[#f5f5f7] rounded-[6px] border border-[#d2d2d7] overflow-hidden">
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-[#e5e5ea] text-[#86868b] font-bold border-b border-[#d2d2d7]">
                                        <tr>
                                            <th className="p-2 pl-3">Hammadde</th>
                                            <th className="p-2 text-right pr-3">Oran (%)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-[#d2d2d7]">
                                        {recipe.ingredients.map((ing, idx) => {
                                            const currentItemId = ing.itemId || ing.item_id;
                                            const item = inventory.find(i => i.id === parseInt(currentItemId));
                                            return (
                                                <tr key={idx}>
                                                    <td className="p-2 pl-3 text-[#1d1d1f] font-medium">
                                                        <span className="text-[10px] text-[#86868b] font-mono mr-2">{item?.product_code || item?.id}</span>
                                                        {item?.name || '?'}
                                                    </td>
                                                    <td className="p-2 pr-3 text-right font-bold text-[#1d1d1f] font-mono">%{ing.percentage}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className="bg-[#f5f5f7] font-bold text-[#1d1d1f] border-t border-[#d2d2d7]">
                                        <tr>
                                            <td className="p-2 pl-3 text-right uppercase text-[10px] tracking-wider text-[#86868b]">Toplam</td>
                                            <td className="p-2 pr-3 text-right text-sm">
                                                %{recipe.ingredients.reduce((sum, i) => sum + parseFloat(i.percentage || 0), 0).toFixed(2)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="modal-footer-industrial">
                        <button
                            onClick={onClose}
                            className="btn-secondary w-full sm:w-auto"
                        >
                            Kapat
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="heading-industrial text-2xl flex items-center gap-2">
                    <Beaker className="h-6 w-6 text-[#0071e3]" /> REÇETELER
                </h2>
                <button
                    onClick={() => {
                        setFormData({
                            id: null,
                            productId: '',
                            isNewProduct: false,
                            newProductName: '',
                            density: 1.0,
                            customerId: '',
                            ingredients: []
                        });
                        setShowForm(true);
                    }}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus className="h-4 w-4" /> Yeni Reçete
                </button>
            </div>

            {/* Standardized Filter Bar */}
            <div className="card-industrial p-4 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="label-industrial block mb-1">Arama</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Ürün veya müşteri ara..."
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                            className="input-industrial pl-9"
                        />
                    </div>
                </div>
                <div className="w-48">
                    <label className="label-industrial block mb-1">Müşteri</label>
                    <select
                        className="select-industrial"
                        value={filters.customerId}
                        onChange={e => setFilters({ ...filters, customerId: e.target.value })}
                    >
                        <option value="all">Tümü</option>
                        <option value="general">Müşterisiz (Genel)</option>
                        {customers.map(c => (
                            <option key={c.id} value={c.id.toString()}>{c.name}</option>
                        ))}
                    </select>
                </div>
            </div>

            {selectedRecipe && (
                <RecipeDetailModal
                    recipe={selectedRecipe}
                    onClose={() => setSelectedRecipe(null)}
                />
            )}

            {showForm && (
                <div className="card-industrial p-6 mb-6">
                    <h3 className="text-lg font-bold mb-4 text-[#1d1d1f] uppercase tracking-tight">
                        {formData.id ? 'Reçete Düzenle' : 'Yeni Reçete'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-medium text-[#1d1d1f] mb-1 cursor-pointer w-fit">
                                        <input
                                            type="checkbox"
                                            checked={formData.isNewProduct}
                                            onChange={e => setFormData({ ...formData, isNewProduct: e.target.checked })}
                                            disabled={!!formData.id}
                                            className="rounded text-[#0071e3] focus:ring-[#0071e3]"
                                        />
                                        Yeni Ürün Tanımla
                                    </label>
                                    {formData.isNewProduct ? (
                                        <div className="flex gap-2">
                                            <div className="flex-1">
                                                <input
                                                    required
                                                    placeholder="Ürün Adı"
                                                    value={formData.newProductName}
                                                    onChange={e => setFormData({ ...formData, newProductName: e.target.value })}
                                                    className="input-industrial"
                                                />
                                            </div>
                                            <div className="w-32">
                                                <input
                                                    type="number"
                                                    placeholder="Raf Ömrü"
                                                    value={formData.shelfLife || ''}
                                                    onChange={e => setFormData({ ...formData, shelfLife: e.target.value })}
                                                    className="input-industrial"
                                                    title="Raf Ömrü (Ay)"
                                                />
                                            </div>
                                            <input type="hidden" value={formData.density} />
                                        </div>
                                    ) : (
                                        <div className="flex gap-2">
                                            <select
                                                required
                                                value={formData.productId}
                                                onChange={e => {
                                                    const pid = e.target.value;
                                                    const prod = inventory.find(i => i.id === parseInt(pid));
                                                    setFormData({
                                                        ...formData,
                                                        productId: pid,
                                                        shelfLife: prod ? prod.shelf_life_months : ''
                                                    });
                                                }}
                                                disabled={!!formData.id}
                                                className="select-industrial flex-1"
                                            >
                                                <option value="">Ürün Seçiniz...</option>
                                                {inventory.filter(i => i.type === 'Mamul').map(i => (
                                                    <option key={i.id} value={i.id}>{i.product_code || i.id} - {i.name}</option>
                                                ))}
                                            </select>
                                            <div className="w-32">
                                                <input
                                                    type="number"
                                                    placeholder="Raf Ömrü"
                                                    value={formData.shelfLife || ''}
                                                    onChange={e => setFormData({ ...formData, shelfLife: e.target.value })}
                                                    className="input-industrial"
                                                    title="Raf Ömrü (Ay)"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="md:col-span-2">
                                    <label className="label-industrial block">Tehlike İşaretleri (GHS)</label>
                                    <div className="flex flex-wrap gap-2">
                                        {[
                                            { code: 'flammable', label: 'Yanıcı (F)', color: 'red' },
                                            { code: 'corrosive', label: 'Aşındırıcı (C)', color: 'gray' },
                                            { code: 'toxic', label: 'Toksik (T)', color: 'orange' },
                                            { code: 'oxidizing', label: 'Oksitleyici (O)', color: 'yellow' },
                                            { code: 'irritant', label: 'Tahriş Edici (Xi)', color: 'orange' },
                                            { code: 'environment', label: 'Çevre (N)', color: 'green' },
                                            { code: 'health', label: 'Sağlık', color: 'blue' }
                                        ].map(opt => (
                                            <button
                                                key={opt.code}
                                                type="button"
                                                onClick={() => {
                                                    const current = formData.ghsSymbols || [];
                                                    const newSyms = current.includes(opt.code)
                                                        ? current.filter(s => s !== opt.code)
                                                        : [...current, opt.code];
                                                    setFormData({ ...formData, ghsSymbols: newSyms });
                                                }}
                                                className={`px-3 py-1 rounded-[4px] text-[10px] font-bold border transition-colors uppercase ${(formData.ghsSymbols || []).includes(opt.code)
                                                    ? 'bg-red-50 border-red-500 text-red-700'
                                                    : 'bg-white border-[#d2d2d7] text-[#86868b] hover:border-[#86868b]'
                                                    }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="label-industrial block">Müşteri (Opsiyonel)</label>
                                    <select
                                        value={formData.customerId}
                                        onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                                        className="select-industrial"
                                    >
                                        <option value="">Genel Reçete</option>
                                        {customers.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="bg-[#fbfbfd] p-4 rounded-[6px] border border-[#d2d2d7]">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="label-industrial block">İçerik (Hammadde)</label>
                                    <button type="button" onClick={handleAddIngredient} className="text-[10px] font-bold bg-[#e8f2ff] text-[#0071e3] px-2 py-1 rounded-[4px] hover:bg-[#d0e6ff] uppercase tracking-wide">+ Ekle</button>
                                </div>
                                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                                    {formData.ingredients.map((ing, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <select
                                                required
                                                value={ing.itemId}
                                                onChange={e => handleIngredientChange(idx, 'itemId', e.target.value)}
                                                className="select-industrial flex-1 text-xs py-1.5"
                                            >
                                                <option value="">Seçiniz...</option>
                                                {inventory.filter(i => i.type === 'Hammadde').map(i => (
                                                    <option key={i.id} value={i.id}>{i.product_code || i.id} - {i.name}</option>
                                                ))}
                                            </select>
                                            <input
                                                required
                                                type="number"
                                                step="0.01"
                                                placeholder="%"
                                                value={ing.percentage}
                                                onChange={e => handleIngredientChange(idx, 'percentage', e.target.value)}
                                                className="input-industrial w-20 text-xs py-1.5"
                                            />
                                            <button type="button" onClick={() => handleRemoveIngredient(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded"><X className="h-4 w-4" /></button>
                                        </div>
                                    ))}
                                    {formData.ingredients.length === 0 && <div className="text-center text-gray-400 text-xs py-4 italic">Liste boş. Hammadde ekleyin.</div>}
                                </div>
                                <div className="mt-2 text-right text-sm font-bold text-[#1d1d1f]">
                                    Toplam: %{formData.ingredients.reduce((sum, i) => sum + parseFloat(i.percentage || 0), 0).toFixed(2)}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">İptal</button>
                            <button type="submit" className="btn-primary flex items-center gap-2"><Save className="h-4 w-4" /> Kaydet</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Recipe List Table */}
            <div className="card-industrial overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table-industrial">
                        <thead>
                            <tr>
                                <th className="text-left w-1/3">Ürün</th>
                                <th className="text-left w-1/4">Müşteri</th>
                                <th className="text-left w-1/4">İçerik</th>
                                <th className="text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredRecipes.map(recipe => {
                                const product = inventory.find(i => i.id === recipe.product_id);
                                const customer = customers.find(c => c.id === recipe.customer_id);
                                return (
                                    <tr
                                        key={recipe.id}
                                        onClick={() => setSelectedRecipe(recipe)}
                                        className="cursor-pointer"
                                    >
                                        <td>
                                            <div className="font-medium text-[#1d1d1f]">{product?.name || 'Bilinmeyen Ürün'}</div>
                                            <div className="text-[10px] text-gray-400 font-mono mt-0.5">{product?.product_code || product?.id}</div>
                                        </td>
                                        <td>
                                            {customer ? (
                                                <div className="font-medium text-gray-700">{customer.name}</div>
                                            ) : (
                                                <span className="text-gray-400 italic text-xs">Genel Reçete</span>
                                            )}
                                        </td>
                                        <td>
                                            <span className="badge-industrial badge-industrial-blue">
                                                {recipe.ingredients.length} Hammadde
                                            </span>
                                        </td>
                                        <td className="text-right" onClick={(e) => e.stopPropagation()}>
                                            <div className="flex justify-end gap-1">
                                                <button
                                                    onClick={() => handleEdit(recipe)}
                                                    className="p-1.5 text-[#0071e3] hover:text-[#0077ed] transition-colors"
                                                    title="Düzenle"
                                                >
                                                    <Edit className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => handlePrintRecipe(recipe)}
                                                    className="p-1.5 text-gray-500 hover:text-gray-700 transition-colors"
                                                    title="Yazdır"
                                                >
                                                    <Printer className="h-4 w-4" />
                                                </button>
                                                <button
                                                    onClick={() => onDelete(recipe.id)}
                                                    className="p-1.5 text-gray-400 hover:text-[#d21e1e] transition-colors"
                                                    title="Sil"
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredRecipes.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="px-6 py-8 text-center text-slate-400 italic text-xs">
                                        {filters.search || filters.customerId !== 'all' ? 'Arama kriterlerine uygun reçete bulunamadı.' : 'Henüz reçete tanımlanmamış.'}
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
