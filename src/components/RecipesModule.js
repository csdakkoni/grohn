import React, { useState } from 'react';
import { Trash2, Plus, Beaker, Save, X, Search, Edit, Printer, Filter } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { turkishToEnglish, preparePDFWithFont } from '../utils/exportUtils';

export default function RecipesModule({ recipes, inventory, customers, onSave, onDelete }) {
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
            ingredients: recipe.ingredients.map(i => ({ itemId: i.itemId, percentage: i.percentage }))
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

        // --- HEADER ---
        doc.setFillColor(79, 70, 229); // Indigo-600
        doc.rect(0, 0, 210, 40, 'F');

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(24);
        doc.setFont(fontName, 'bold');
        doc.text('REÇETE DETAYI', 105, 20, null, null, 'center');

        doc.setFontSize(10);
        doc.text('GROHN Kimya A.Ş.', 105, 30, null, null, 'center');

        // --- INFO BOX ---
        doc.setTextColor(0, 0, 0);
        doc.setFontSize(11);
        doc.setFont(fontName, 'normal');

        const startY = 50;

        // Left Column
        doc.setFont(fontName, 'bold');
        doc.text('Ürün Adı:', 14, startY);
        doc.text('Müşteri:', 14, startY + 8);
        doc.text('Yoğunluk:', 14, startY + 16);

        doc.setFont(fontName, 'normal');
        doc.text(product?.name || '-', 50, startY);
        doc.text(customer?.name || 'Genel Reçete', 50, startY + 8);
        doc.text(`${product?.density || '-'} g/ml`, 50, startY + 16);

        // --- INGREDIENTS TABLE ---
        const tableData = recipe.ingredients.map(ing => {
            const item = inventory.find(i => i.id === parseInt(ing.itemId));
            return [
                item?.name || '?',
                item?.product_code || item?.id?.toString() || '-',
                `%${ing.percentage}`
            ];
        });

        autoTable(doc, {
            startY: startY + 25,
            head: [['Hammadde', 'Stok Kodu', 'Oran']],
            body: tableData,
            theme: 'grid',
            headStyles: { fillColor: [79, 70, 229], textColor: 255 },
            styles: { fontSize: 10, cellPadding: 3, font: fontName },
            foot: [['TOPLAM', '', `%${recipe.ingredients.reduce((s, i) => s + parseFloat(i.percentage), 0).toFixed(2)}`]],
            footStyles: { fillColor: [240, 240, 240], textColor: 0, fontStyle: 'bold' }
        });

        // Current Date Footer
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text(`Oluşturma Tarihi: ${new Date().toLocaleDateString('tr-TR')}`, 14, 290);

        doc.save(`recete_${product?.name || 'detay'}.pdf`);
    };

    const RecipeDetailModal = ({ recipe, onClose }) => {
        if (!recipe) return null;
        const product = inventory.find(i => i.id === recipe.product_id);
        const customer = customers.find(c => c.id === recipe.customer_id);

        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                    <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
                        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
                            <Beaker className="h-5 w-5 text-indigo-600" />
                            Reçete Detayı
                        </h3>
                        <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                            <X className="h-6 w-6" />
                        </button>
                    </div>

                    <div className="absolute top-4 right-14">
                        <button
                            onClick={() => handlePrintRecipe(recipe)}
                            className="bg-indigo-50 text-indigo-600 hover:bg-indigo-100 p-2 rounded-lg flex items-center gap-2 text-sm font-medium transition-colors"
                        >
                            <Printer className="h-4 w-4" /> Yazdır
                        </button>
                    </div>

                    <div className="p-6 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase">Ürün</label>
                                <div className="text-lg font-medium text-slate-800">{product?.name || 'Bilinmeyen Ürün'}</div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase">Müşteri</label>
                                <div className="text-lg font-medium text-slate-800">{customer?.name || 'Genel Reçete'}</div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-400 uppercase">Yoğunluk</label>
                                <div className="text-lg font-medium text-slate-800">{product?.density || '-'} g/ml</div>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-slate-700 mb-2 border-b pb-1">İçerik (Hammadde Listesi)</h4>
                            <div className="bg-slate-50 rounded-lg border border-slate-200 overflow-hidden">
                                <table className="w-full text-sm text-left">
                                    <thead className="bg-slate-100 text-slate-600 font-semibold">
                                        <tr>
                                            <th className="p-3">Hammadde</th>
                                            <th className="p-3 text-right">Oran (%)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {recipe.ingredients.map((ing, idx) => {
                                            const item = inventory.find(i => i.id === parseInt(ing.itemId));
                                            return (
                                                <tr key={idx}>
                                                    <td className="p-3 text-slate-800">
                                                        <span className="text-xs text-slate-400 font-mono mr-2">{item?.product_code || item?.id}</span>
                                                        {item?.name || '?'}
                                                    </td>
                                                    <td className="p-3 text-right font-medium text-indigo-600">%{ing.percentage}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                    <tfoot className="bg-slate-50 font-bold text-slate-700">
                                        <tr>
                                            <td className="p-3 text-right">Toplam:</td>
                                            <td className="p-3 text-right">
                                                %{recipe.ingredients.reduce((sum, i) => sum + parseFloat(i.percentage || 0), 0).toFixed(2)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-50 p-4 border-t border-slate-200 flex justify-end">
                        <button
                            onClick={onClose}
                            className="bg-slate-200 hover:bg-slate-300 text-slate-800 px-4 py-2 rounded-lg font-medium"
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
                <h2 className="text-2xl font-bold text-slate-800 flex items-center gap-2">
                    <Beaker className="h-6 w-6 text-indigo-600" /> Reçeteler
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
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <Plus className="h-4 w-4" /> Yeni Reçete
                </button>
            </div>

            {/* Standardized Filter Bar */}
            <div className="bg-white p-4 rounded-xl shadow border border-slate-200 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[200px]">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Arama</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Ürün veya müşteri ara..."
                            value={filters.search}
                            onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                            className="w-full pl-9 bg-slate-50 border border-slate-200 rounded-lg p-2 text-sm focus:outline-none focus:border-indigo-500"
                        />
                    </div>
                </div>
                <div className="w-48">
                    <label className="text-xs font-bold text-slate-500 uppercase mb-1 block">Müşteri</label>
                    <select
                        className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-indigo-500"
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
                <div className="bg-white p-6 rounded-xl shadow-lg border border-slate-200 mb-6">
                    <h3 className="text-lg font-bold mb-4 text-slate-700">
                        {formData.id ? 'Reçete Düzenle' : 'Yeni Reçete'}
                    </h3>
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-1">
                                        <input
                                            type="checkbox"
                                            checked={formData.isNewProduct}
                                            onChange={e => setFormData({ ...formData, isNewProduct: e.target.checked })}
                                            disabled={!!formData.id}
                                            className="rounded text-indigo-600"
                                        />
                                        Yeni Ürün Tanımla
                                    </label>
                                    {formData.isNewProduct ? (
                                        <div className="flex gap-2">
                                            <input
                                                required
                                                placeholder="Ürün Adı"
                                                value={formData.newProductName}
                                                onChange={e => setFormData({ ...formData, newProductName: e.target.value })}
                                                className="flex-1 border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                            />
                                            <input type="hidden" value={formData.density} />
                                        </div>
                                    ) : (
                                        <select
                                            required
                                            value={formData.productId}
                                            onChange={e => setFormData({ ...formData, productId: e.target.value })}
                                            disabled={!!formData.id}
                                            className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                        >
                                            <option value="">Ürün Seçiniz...</option>
                                            {inventory.filter(i => i.type === 'Mamul').map(i => (
                                                <option key={i.id} value={i.id}>{i.product_code || i.id} - {i.name}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Müşteri (Opsiyonel)</label>
                                    <select
                                        value={formData.customerId}
                                        onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                                        className="w-full border-2 border-slate-200 rounded-lg p-2 focus:border-indigo-500 focus:outline-none"
                                    >
                                        <option value="">Genel Reçete</option>
                                        {customers.map(c => (
                                            <option key={c.id} value={c.id}>{c.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="bg-slate-50 p-4 rounded-lg">
                                <div className="flex justify-between items-center mb-2">
                                    <label className="block text-sm font-medium text-slate-700">İçerik (Hammadde)</label>
                                    <button type="button" onClick={handleAddIngredient} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200">+ Ekle</button>
                                </div>
                                <div className="space-y-2 max-h-60 overflow-y-auto">
                                    {formData.ingredients.map((ing, idx) => (
                                        <div key={idx} className="flex gap-2">
                                            <select
                                                required
                                                value={ing.itemId}
                                                onChange={e => handleIngredientChange(idx, 'itemId', e.target.value)}
                                                className="flex-1 border border-slate-300 rounded p-1 text-sm"
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
                                                className="w-20 border border-slate-300 rounded p-1 text-sm"
                                            />
                                            <button type="button" onClick={() => handleRemoveIngredient(idx)} className="text-red-500 hover:bg-red-50 p-1 rounded"><X className="h-4 w-4" /></button>
                                        </div>
                                    ))}
                                    {formData.ingredients.length === 0 && <div className="text-center text-slate-400 text-sm py-4">Hammadde ekleyin.</div>}
                                </div>
                                <div className="mt-2 text-right text-sm font-bold text-slate-600">
                                    Toplam: %{formData.ingredients.reduce((sum, i) => sum + parseFloat(i.percentage || 0), 0).toFixed(2)}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg">İptal</button>
                            <button type="submit" className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-2 rounded-lg font-medium flex items-center gap-2"><Save className="h-4 w-4" /> Kaydet</button>
                        </div>
                    </form>
                </div>
            )}

            {/* Table View */}
            <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="p-4 font-semibold text-slate-600">Ürün</th>
                                <th className="p-4 font-semibold text-slate-600">Müşteri</th>
                                <th className="p-4 font-semibold text-slate-600">İçerik</th>
                                <th className="p-4 font-semibold text-slate-600 text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredRecipes.map(recipe => {
                                const product = inventory.find(i => i.id === recipe.product_id);
                                const customer = customers.find(c => c.id === recipe.customer_id);
                                return (
                                    <tr
                                        key={recipe.id}
                                        onClick={() => setSelectedRecipe(recipe)}
                                        className="hover:bg-slate-50 transition-colors cursor-pointer"
                                    >
                                        <td className="p-4 font-medium text-slate-800">
                                            <span className="text-xs text-slate-400 font-mono mr-2">{product?.product_code || product?.id}</span>
                                            {product?.name || 'Bilinmeyen Ürün'}
                                        </td>
                                        <td className="p-4 text-slate-600">{customer ? customer.name : <span className="text-slate-400 italic">Genel Reçete</span>}</td>
                                        <td className="p-4 text-slate-600">
                                            <span className="bg-indigo-50 text-indigo-700 px-2 py-1 rounded text-xs font-medium">
                                                {recipe.ingredients.length} Hammadde
                                            </span>
                                        </td>
                                        <td className="p-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                                            <button
                                                onClick={() => handleEdit(recipe)}
                                                className="text-blue-600 hover:bg-blue-50 p-2 rounded-lg transition-colors"
                                                title="Düzenle"
                                            >
                                                <Edit className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => handlePrintRecipe(recipe)}
                                                className="text-slate-600 hover:bg-slate-100 p-2 rounded-lg transition-colors"
                                                title="Yazdır"
                                            >
                                                <Printer className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => onDelete(recipe.id)}
                                                className="text-red-600 hover:bg-red-50 p-2 rounded-lg transition-colors"
                                                title="Sil"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredRecipes.length === 0 && (
                                <tr>
                                    <td colSpan="4" className="p-8 text-center text-slate-400">
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
