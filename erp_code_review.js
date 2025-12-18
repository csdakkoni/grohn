import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import Auth from './components/Auth';
import { LayoutDashboard, Briefcase, Edit, Trash2, Plus, LogOut, FlaskConical, ShoppingBag, ArrowLeft, Beaker, Factory, Download, Printer, FileSpreadsheet, Filter, Eye, RefreshCw, DollarSign, Package, TrendingUp, Settings } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// ==================== UTILITY FUNCTIONS ====================
const parseInputFloat = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    const cleanStr = val.toString().replace(',', '.').replace(/[^0-9.-]/g, '');
    const parsed = parseFloat(cleanStr);
    return isNaN(parsed) ? 0 : parsed;
};

const formatMoney = (amount, currency = 'TRY') => {
    const safeAmount = parseInputFloat(amount);
    const symbols = { USD: '$', EUR: '€', TRY: '₺' };
    const symbol = symbols[currency] || currency;
    return symbol + safeAmount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const formatDate = (dateString) => {
    if (!dateString) return '-';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return '-';
        return date.toLocaleDateString('tr-TR');
    } catch (e) { return '-'; }
};

const exportToExcel = (data, fileName) => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sayfa1');
    XLSX.writeFile(wb, fileName + '.xlsx');
};

const exportToPDF = (title, headers, data, fileName) => {
    const doc = new jsPDF();
    doc.setFontSize(18);
    doc.text(title, 14, 22);
    doc.setFontSize(11);
    doc.text('Tarih: ' + new Date().toLocaleDateString('tr-TR'), 14, 30);
    autoTable(doc, { startY: 35, head: [headers], body: data, styles: { font: 'helvetica', fontSize: 9 }, headStyles: { fillColor: [79, 70, 229] } });
    doc.save(fileName + '.pdf');
};

const handlePrint = (title, headers, data) => {
    const w = window.open('', '', 'height=600,width=800');
    let html = '<html><head><title>' + title + '</title><style>body{font-family:Arial,sans-serif;padding:20px}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #ddd;padding:10px;text-align:left}th{background:#4F46E5;color:white}tr:nth-child(even){background:#f9f9f9}</style></head><body><h2>' + title + '</h2><p>Tarih: ' + new Date().toLocaleDateString('tr-TR') + '</p><table><thead><tr>';
    headers.forEach(h => { html += '<th>' + h + '</th>'; });
    html += '</tr></thead><tbody>';
    data.forEach(row => { html += '<tr>'; row.forEach(cell => { html += '<td>' + (cell || '-') + '</td>'; }); html += '</tr>'; });
    html += '</tbody></table></body></html>';
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 250);
};

// ==================== COMPONENTS ====================
const FilterDropdown = ({ options, value, onChange, label }) => {
    const [isOpen, setIsOpen] = useState(false);
    return (
        <div className="relative inline-block">
            <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className={'ml-2 hover:text-indigo-600 transition-colors ' + (value ? 'text-indigo-600' : 'text-slate-400')} title={'Filtrele: ' + label}>
                <Filter className="h-4 w-4" />
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 z-50 mt-2 w-48 bg-white rounded-lg shadow-xl border-2 border-slate-200">
                        <div className="p-2 max-h-64 overflow-y-auto">
                            <button onClick={() => { onChange(''); setIsOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-slate-100 rounded text-sm font-medium text-slate-600">
                                Tümü
                            </button>
                            {options.map((opt, idx) => (
                                <button key={idx} onClick={() => { onChange(opt); setIsOpen(false); }} className={'w-full text-left px-3 py-2 hover:bg-slate-100 rounded text-sm ' + (value === opt ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-slate-700')}>
                                    {opt}
                                </button>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};

const ExportButtons = ({ onExcel, onPDF, onPrint }) => (
    <div className="flex gap-2">
        <button onClick={onExcel} className="bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-1 text-sm transition-colors">
            <FileSpreadsheet className="h-4 w-4" /> Excel
        </button>
        <button onClick={onPDF} className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-1 text-sm transition-colors">
            <Download className="h-4 w-4" /> PDF
        </button>
        <button onClick={onPrint} className="bg-slate-600 hover:bg-slate-700 text-white px-3 py-2 rounded-lg font-medium flex items-center gap-1 text-sm transition-colors">
            <Printer className="h-4 w-4" /> Yazdır
        </button>
    </div>
);

const CurrencySelector = ({ value, onChange, className = '' }) => (
    <select value={value} onChange={e => onChange(e.target.value)} className={'border-2 border-slate-200 p-2 rounded-lg focus:border-indigo-500 focus:outline-none ' + className}>
        <option value="USD">USD ($)</option>
        <option value="EUR">EUR (€)</option>
        <option value="TRY">TRY (₺)</option>
    </select>
);

// ==================== MAIN APP ====================
export default function App() {
    const [session, setSession] = useState(null);
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('dashboard');

    // Data states
    const [accounts, setAccounts] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [recipes, setRecipes] = useState([]);
    const [productions, setProductions] = useState([]);
    const [sales, setSales] = useState([]);

    // Currency states
    const [exchangeRates, setExchangeRates] = useState({ USD: 1, EUR: 0.92, TRY: 34.50 });
    const [manualRates, setManualRates] = useState({ USD: '', EUR: '', TRY: '' });
    const [useManualRates, setUseManualRates] = useState(false);
    const [ratesLoading, setRatesLoading] = useState(false);
    const [ratesLastUpdate, setRatesLastUpdate] = useState(null);
    const [baseCurrency, setBaseCurrency] = useState('USD');

    // Auth effect
    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setUser(session?.user ?? null);
            setLoading(false);
        });
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            setUser(session?.user ?? null);
        });
        return () => subscription.unsubscribe();
    }, []);

    // Fetch exchange rates
    const fetchExchangeRates = useCallback(async () => {
        setRatesLoading(true);
        try {
            // Using exchangerate-api (free tier)
            const response = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
            if (response.ok) {
                const data = await response.json();
                setExchangeRates({
                    USD: 1,
                    EUR: data.rates.EUR || 0.92,
                    TRY: data.rates.TRY || 34.50
                });
                setRatesLastUpdate(new Date());
            }
        } catch (error) {
            console.error('Kur çekme hatası:', error);
            // Fallback rates
            setExchangeRates({ USD: 1, EUR: 0.92, TRY: 34.50 });
        }
        setRatesLoading(false);
    }, []);

    // Load rates on mount
    useEffect(() => {
        fetchExchangeRates();
    }, [fetchExchangeRates]);

    // Get active rates (manual or auto)
    const getActiveRates = useCallback(() => {
        if (useManualRates) {
            return {
                USD: parseInputFloat(manualRates.USD) || exchangeRates.USD,
                EUR: parseInputFloat(manualRates.EUR) || exchangeRates.EUR,
                TRY: parseInputFloat(manualRates.TRY) || exchangeRates.TRY
            };
        }
        return exchangeRates;
    }, [useManualRates, manualRates, exchangeRates]);

    // Convert currency
    const convertCurrency = useCallback((amount, fromCurrency, toCurrency) => {
        const rates = getActiveRates();
        const amountInUSD = parseInputFloat(amount) / rates[fromCurrency];
        return amountInUSD * rates[toCurrency];
    }, [getActiveRates]);

    // Load all data
    const loadAllData = useCallback(async () => {
        if (!user) return;

        const [accRes, invRes, purRes, recRes, prodRes, salesRes] = await Promise.all([
            supabase.from('accounts').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
            supabase.from('inventory').select('*, lots (*)').eq('user_id', user.id).order('created_at', { ascending: false }),
            supabase.from('purchases').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
            supabase.from('recipes').select('*, recipe_ingredients (*)').eq('user_id', user.id).order('created_at', { ascending: false }),
            supabase.from('productions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
            supabase.from('sales').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
        ]);

        setAccounts(accRes.data || []);
        setInventory((invRes.data || []).map(i => ({ ...i, lots: i.lots || [] })));
        setPurchases(purRes.data || []);
        setRecipes((recRes.data || []).map(r => ({
            ...r,
            ingredients: (r.recipe_ingredients || []).map(i => ({ itemId: i.item_id, percentage: i.percentage }))
        })));
        setProductions(prodRes.data || []);
        setSales(salesRes.data || []);
    }, [user]);

    useEffect(() => {
        if (user) loadAllData();
    }, [user, loadAllData]);

    // Helper functions
    const handleSignOut = async () => { await supabase.auth.signOut(); };

    const getAccountName = (id) => accounts.find(a => a.id === parseInt(id))?.name || '-';

    const getRecipeName = (id) => {
        const r = recipes.find(x => x.id === parseInt(id));
        return r ? (inventory.find(i => i.id === r.product_id)?.name || '-') : '-';
    };

    const getItemStock = (itemId) => {
        const item = inventory.find(i => i.id === parseInt(itemId));
        if (!item) return 0;
        return item.lots.reduce((sum, lot) => sum + parseInputFloat(lot.qty), 0);
    };

    const calculateRawMaterialCost = (ingredients, targetCurrency = 'USD') => {
        return (ingredients || []).reduce((sum, ing) => {
            const item = inventory.find(i => i.id === parseInt(ing.itemId));
            if (!item) return sum;
            const costInTarget = convertCurrency(item.cost, item.currency || 'USD', targetCurrency);
            return sum + (costInTarget * parseInputFloat(ing.percentage)) / 100;
        }, 0);
    };

    const generateLotNumber = async (date) => {
        const d = new Date(date);
        const dateStr = d.getDate().toString().padStart(2, '0') +
            (d.getMonth() + 1).toString().padStart(2, '0') +
            d.getFullYear().toString().slice(-2);
        const { data } = await supabase
            .from('productions')
            .select('lot_number')
            .eq('user_id', user.id)
            .like('lot_number', 'GR-' + dateStr + '-%')
            .order('lot_number', { ascending: false })
            .limit(1);
        let seq = 1;
        if (data && data.length > 0) {
            seq = parseInt(data[0].lot_number.split('-')[2]) + 1;
        }
        return 'GR-' + dateStr + '-' + seq.toString().padStart(2, '0');
    };

    const checkMaterialAvailability = (recipeId, quantity) => {
        const recipe = recipes.find(r => r.id === parseInt(recipeId));
        if (!recipe) return { available: false, materials: [] };

        let allAvailable = true;
        const materials = recipe.ingredients.map(ing => {
            const item = inventory.find(i => i.id === parseInt(ing.itemId));
            if (!item) {
                allAvailable = false;
                return { name: '?', required: 0, available: 0, sufficient: false };
            }
            const required = (parseInputFloat(quantity) * parseInputFloat(ing.percentage)) / 100;
            const available = item.lots.reduce((s, l) => s + parseInputFloat(l.qty), 0);
            const sufficient = available >= required;
            if (!sufficient) allAvailable = false;
            return { name: item.name, required, available, sufficient };
        });

        return { available: allAvailable, materials };
    };

    // CRUD Handlers
    const handleAddAccount = async (account) => {
        if (account.id) {
            await supabase.from('accounts').update({
                name: account.name,
                type: account.type,
                contact: account.contact,
                phone: account.phone
            }).eq('id', account.id);
        } else {
            await supabase.from('accounts').insert({ user_id: user.id, ...account });
        }
        loadAllData();
    };

    const handleDeleteAccount = async (id) => {
        if (window.confirm('Bu cariyi silmek istediğinize emin misiniz?')) {
            await supabase.from('accounts').delete().eq('id', id);
            loadAllData();
        }
    };

    const handlePurchase = async (form) => {
        const total = parseInputFloat(form.qty) * parseInputFloat(form.price);
        let itemName = '';
        let itemId = null;

        if (form.isNewItem) {
            const insertData = {
                user_id: user.id,
                name: form.newItemName,
                type: form.newItemType,
                unit: form.newItemUnit || 'kg',
                cost: parseInputFloat(form.price),
                currency: form.currency,
                payment_term: parseInputFloat(form.termDays),
                track_stock: true
            };
            if (form.newItemType === 'Ambalaj') {
                insertData.capacity_value = parseInputFloat(form.capacityValue);
                insertData.capacity_unit = form.capacityUnit || 'L';
                insertData.tare_weight = parseInputFloat(form.tareWeight);
            }
            const { data } = await supabase.from('inventory').insert(insertData).select().single();
            itemName = data.name;
            itemId = data.id;
        } else {
            await supabase.from('inventory').update({
                cost: parseInputFloat(form.price),
                currency: form.currency,
                payment_term: parseInputFloat(form.termDays)
            }).eq('id', parseInt(form.itemId));
            const item = inventory.find(i => i.id === parseInt(form.itemId));
            itemName = item?.name || '';
            itemId = parseInt(form.itemId);
        }

        // Add lot
        await supabase.from('lots').insert({
            inventory_id: itemId,
            lot_no: form.lotNo || 'LOT-' + Date.now(),
            qty: parseInputFloat(form.qty)
        });

        // Record purchase
        await supabase.from('purchases').insert({
            user_id: user.id,
            supplier_id: parseInt(form.supplierId),
            item_name: itemName,
            qty: parseInputFloat(form.qty),
            price: parseInputFloat(form.price),
            currency: form.currency,
            total,
            payment_term: parseInputFloat(form.termDays),
            lot_no: form.lotNo
        });

        loadAllData();
        return true;
    };

    const handleDeletePurchase = async (id) => {
        if (window.confirm('Bu alımı silmek istediğinize emin misiniz?')) {
            await supabase.from('purchases').delete().eq('id', id);
            loadAllData();
        }
    };

    const handleSaveRecipe = async (data, isNew, newName) => {
        let productId = data.productId;

        if (isNew) {
            const { data: p } = await supabase.from('inventory').insert({
                user_id: user.id,
                name: newName,
                type: 'Mamul',
                unit: 'kg',
                cost: 0,
                currency: 'USD',
                track_stock: true,
                density: parseInputFloat(data.density) || 1.0
            }).select().single();
            productId = p.id;
        }

        if (data.id) {
            await supabase.from('recipes').update({
                product_id: productId,
                customer_id: parseInt(data.customerId) || null
            }).eq('id', data.id);
            await supabase.from('recipe_ingredients').delete().eq('recipe_id', data.id);
            await supabase.from('recipe_ingredients').insert(
                data.ingredients.map(i => ({
                    recipe_id: data.id,
                    item_id: parseInt(i.itemId),
                    percentage: parseInputFloat(i.percentage)
                }))
            );
        } else {
            const { data: r } = await supabase.from('recipes').insert({
                user_id: user.id,
                product_id: productId,
                customer_id: parseInt(data.customerId) || null
            }).select().single();
            await supabase.from('recipe_ingredients').insert(
                data.ingredients.map(i => ({
                    recipe_id: r.id,
                    item_id: parseInt(i.itemId),
                    percentage: parseInputFloat(i.percentage)
                }))
            );
        }

        loadAllData();
        return true;
    };

    const handleDeleteRecipe = async (id) => {
        if (window.confirm('Bu reçeteyi silmek istediğinize emin misiniz?')) {
            await supabase.from('recipes').delete().eq('id', id);
            loadAllData();
        }
    };

    const handleProduction = async (form) => {
        const recipe = recipes.find(r => r.id === parseInt(form.recipeId));
        if (!recipe) return false;

        const check = checkMaterialAvailability(form.recipeId, form.quantity);
        if (!check.available) {
            alert('Yetersiz hammadde stoku!');
            return false;
        }

        const currency = form.currency || 'USD';
        const rawCost = calculateRawMaterialCost(recipe.ingredients, currency) * parseInputFloat(form.quantity);

        const product = inventory.find(i => i.id === recipe.product_id);
        const pkg = inventory.find(i => i.id === parseInt(form.packagingId));

        const density = parseInputFloat(product?.density || 1);
        const pkgCap = parseInputFloat(pkg?.capacity_value || 1000);
        const liters = parseInputFloat(form.quantity) / density;
        const pkgQty = Math.ceil(liters / pkgCap);
        const pkgCostUnit = convertCurrency(pkg?.cost || 0, pkg?.currency || 'USD', currency);
        const pkgCost = pkgQty * pkgCostUnit;

        const ship = parseInputFloat(form.shippingCost);
        const overhead = parseInputFloat(form.overheadCost);
        const totalBefore = rawCost + pkgCost + ship + overhead;

        const saleTerm = parseInputFloat(form.saleTermDays);
        let payTermSum = 0, costSum = 0;
        recipe.ingredients.forEach(ing => {
            const it = inventory.find(i => i.id === parseInt(ing.itemId));
            if (it) {
                const c = convertCurrency(it.cost, it.currency || 'USD', currency) * parseInputFloat(ing.percentage) / 100 * parseInputFloat(form.quantity);
                payTermSum += c * parseInputFloat(it.payment_term || 0);
                costSum += c;
            }
        });
        const avgTerm = costSum > 0 ? payTermSum / costSum : 0;
        const finDays = Math.max(0, saleTerm - avgTerm);
        const finCost = totalBefore * (0.40 / 365) * finDays;

        const totalCost = totalBefore + finCost;
        const unitCost = totalCost / parseInputFloat(form.quantity);
        const margin = parseInputFloat(form.profitMarginPercent);
        const profit = totalCost * margin / 100;
        const salePrice = totalCost + profit;
        const unitSale = salePrice / parseInputFloat(form.quantity);

        const lot = await generateLotNumber(form.productionDate);

        await supabase.from('productions').insert({
            user_id: user.id,
            recipe_id: parseInt(form.recipeId),
            lot_number: lot,
            quantity: parseInputFloat(form.quantity),
            production_date: form.productionDate,
            packaging_id: parseInt(form.packagingId),
            packaging_quantity: pkgQty,
            raw_material_cost: rawCost,
            packaging_cost: pkgCost,
            shipping_cost: ship,
            overhead_cost: overhead,
            sale_term_days: saleTerm,
            financing_cost: finCost,
            total_cost: totalCost,
            unit_cost: unitCost,
            profit_margin_percent: margin,
            profit_amount: profit,
            sale_price: salePrice,
            unit_sale_price: unitSale,
            currency: currency,
            notes: form.notes || ''
        });

        // Deduct raw materials (FIFO)
        for (const ing of recipe.ingredients) {
            const item = inventory.find(i => i.id === parseInt(ing.itemId));
            if (!item) continue;
            let remaining = (parseInputFloat(form.quantity) * parseInputFloat(ing.percentage)) / 100;
            const sortedLots = [...item.lots].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            for (const lot of sortedLots) {
                if (remaining <= 0) break;
                const use = Math.min(parseInputFloat(lot.qty), remaining);
                const newQty = parseInputFloat(lot.qty) - use;
                if (newQty > 0.001) {
                    await supabase.from('lots').update({ qty: newQty }).eq('id', lot.id);
                } else {
                    await supabase.from('lots').delete().eq('id', lot.id);
                }
                remaining -= use;
            }
        }

        // Add finished product to inventory
        if (product) {
            await supabase.from('lots').insert({
                inventory_id: product.id,
                lot_no: lot,
                qty: parseInputFloat(form.quantity)
            });
        }

        loadAllData();
        alert(`Üretim başarıyla kaydedildi!\n\nLOT: ${lot}\nMiktar: ${form.quantity} kg\nMaliyet: ${formatMoney(totalCost, currency)}\nSatış Fiyatı: ${formatMoney(salePrice, currency)}`);
        return true;
    };

    const handleDeleteProduction = async (id) => {
        if (window.confirm('Bu üretimi silmek istediğinize emin misiniz?')) {
            await supabase.from('productions').delete().eq('id', id);
            loadAllData();
        }
    };

    const handleSale = async (form) => {
        const production = productions.find(p => p.id === parseInt(form.productionId));
        if (!production) return false;

        const recipe = recipes.find(r => r.id === production.recipe_id);
        const product = recipe ? inventory.find(i => i.id === recipe.product_id) : null;
        if (!product) return false;

        const availableQty = getItemStock(product.id);
        if (availableQty < parseInputFloat(form.quantity)) {
            alert('Yetersiz stok!');
            return false;
        }

        const totalAmount = parseInputFloat(form.quantity) * parseInputFloat(form.unitPrice);

        await supabase.from('sales').insert({
            user_id: user.id,
            customer_id: parseInt(form.customerId),
            production_id: parseInt(form.productionId),
            product_name: product.name,
            lot_number: production.lot_number,
            quantity: parseInputFloat(form.quantity),
            unit_price: parseInputFloat(form.unitPrice),
            currency: form.currency,
            total_amount: totalAmount,
            sale_date: form.saleDate,
            payment_term: parseInputFloat(form.paymentTerm),
            notes: form.notes || ''
        });

        // Deduct from stock (FIFO)
        let remaining = parseInputFloat(form.quantity);
        const sortedLots = [...product.lots].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        for (const lot of sortedLots) {
            if (remaining <= 0) break;
            const use = Math.min(parseInputFloat(lot.qty), remaining);
            const newQty = parseInputFloat(lot.qty) - use;
            if (newQty > 0.001) {
                await supabase.from('lots').update({ qty: newQty }).eq('id', lot.id);
            } else {
                await supabase.from('lots').delete().eq('id', lot.id);
            }
            remaining -= use;
        }

        loadAllData();
        alert(`Satış kaydedildi!\n\nMüşteri: ${getAccountName(form.customerId)}\nÜrün: ${product.name}\nMiktar: ${form.quantity} kg\nTutar: ${formatMoney(totalAmount, form.currency)}`);
        return true;
    };

    // ==================== DASHBOARD ====================
    const Dashboard = () => {
        const rates = getActiveRates();
        const totalPurchases = purchases.reduce((sum, p) => sum + convertCurrency(p.total, p.currency || 'USD', baseCurrency), 0);
        const totalSales = sales.reduce((sum, s) => sum + convertCurrency(s.total_amount, s.currency || 'USD', baseCurrency), 0);
        const totalProduction = productions.reduce((sum, p) => sum + convertCurrency(p.sale_price, p.currency || 'USD', baseCurrency), 0);

        const rawMaterials = inventory.filter(i => i.type === 'Hammadde');
        const packaging = inventory.filter(i => i.type === 'Ambalaj');
        const products = inventory.filter(i => i.type === 'Mamul');

        return (
            <div className="space-y-6">
                <div className="flex justify-between items-center">
                    <h2 className="text-2xl font-bold text-slate-800">📊 Dashboard</h2>
                    <div className="flex items-center gap-4">
                        <CurrencySelector value={baseCurrency} onChange={setBaseCurrency} />
                    </div>
                </div>

                {/* Exchange Rates Card */}
                <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-xl p-6 text-white">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h3 className="text-lg font-bold flex items-center gap-2">
                                <DollarSign className="h-5 w-5" /> Döviz Kurları
                            </h3>
                            <p className="text-indigo-200 text-sm">
                                {ratesLastUpdate ? `Son güncelleme: ${ratesLastUpdate.toLocaleString('tr-TR')}` : 'Yükleniyor...'}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={useManualRates}
                                    onChange={e => setUseManualRates(e.target.checked)}
                                    className="rounded"
                                />
                                Manuel Kur
                            </label>
                            <button
                                onClick={fetchExchangeRates}
                                disabled={ratesLoading}
                                className="bg-white/20 hover:bg-white/30 p-2 rounded-lg transition-colors"
                                title="Kurları Güncelle"
                            >
                                <RefreshCw className={'h-4 w-4 ' + (ratesLoading ? 'animate-spin' : '')} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-3 gap-4">
                        <div className="bg-white/10 rounded-lg p-4">
                            <div className="text-indigo-200 text-sm">USD / TRY</div>
                            {useManualRates ? (
                                <input
                                    type="number"
                                    step="0.01"
                                    value={manualRates.TRY}
                                    onChange={e => setManualRates({ ...manualRates, TRY: e.target.value })}
                                    placeholder={rates.TRY.toFixed(4)}
                                    className="bg-white/20 text-white text-2xl font-bold w-full rounded p-1 mt-1"
                                />
                            ) : (
                                <div className="text-2xl font-bold">{rates.TRY.toFixed(4)}</div>
                            )}
                        </div>
                        <div className="bg-white/10 rounded-lg p-4">
                            <div className="text-indigo-200 text-sm">EUR / USD</div>
                            {useManualRates ? (
                                <input
                                    type="number"
                                    step="0.0001"
                                    value={manualRates.EUR}
                                    onChange={e => setManualRates({ ...manualRates, EUR: e.target.value })}
                                    placeholder={rates.EUR.toFixed(4)}
                                    className="bg-white/20 text-white text-2xl font-bold w-full rounded p-1 mt-1"
                                />
                            ) : (
                                <div className="text-2xl font-bold">{rates.EUR.toFixed(4)}</div>
                            )}
                        </div>
                        <div className="bg-white/10 rounded-lg p-4">
                            <div className="text-indigo-200 text-sm">EUR / TRY</div>
                            <div className="text-2xl font-bold">{(rates.TRY / rates.EUR).toFixed(4)}</div>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-blue-500">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-3 rounded-lg">
                                <ShoppingBag className="h-6 w-6 text-blue-600" />
                            </div>
                            <div>
                                <div className="text-slate-500 text-sm font-medium">Toplam Alım</div>
                                <div className="text-2xl font-bold text-slate-800">{formatMoney(totalPurchases, baseCurrency)}</div>
                                <div className="text-xs text-slate-400">{purchases.length} işlem</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-green-500">
                        <div className="flex items-center gap-3">
                            <div className="bg-green-100 p-3 rounded-lg">
                                <TrendingUp className="h-6 w-6 text-green-600" />
                            </div>
                            <div>
                                <div className="text-slate-500 text-sm font-medium">Toplam Satış</div>
                                <div className="text-2xl font-bold text-slate-800">{formatMoney(totalSales, baseCurrency)}</div>
                                <div className="text-xs text-slate-400">{sales.length} işlem</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-purple-500">
                        <div className="flex items-center gap-3">
                            <div className="bg-purple-100 p-3 rounded-lg">
                                <Factory className="h-6 w-6 text-purple-600" />
                            </div>
                            <div>
                                <div className="text-slate-500 text-sm font-medium">Üretim Değeri</div>
                                <div className="text-2xl font-bold text-slate-800">{formatMoney(totalProduction, baseCurrency)}</div>
                                <div className="text-xs text-slate-400">{productions.length} üretim</div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-lg border-l-4 border-orange-500">
                        <div className="flex items-center gap-3">
                            <div className="bg-orange-100 p-3 rounded-lg">
                                <Briefcase className="h-6 w-6 text-orange-600" />
                            </div>
                            <div>
                                <div className="text-slate-500 text-sm font-medium">Cari Hesaplar</div>
                                <div className="text-2xl font-bold text-slate-800">{accounts.length}</div>
                                <div className="text-xs text-slate-400">{accounts.filter(a => a.type === 'Müşteri' || a.type === 'Her İkisi').length} müşteri</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Stock Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Package className="h-5 w-5 text-blue-600" /> Hammadde Stoku
                        </h3>
                        <div className="space-y-3">
                            {rawMaterials.slice(0, 5).map(item => {
                                const stock = getItemStock(item.id);
                                return (
                                    <div key={item.id} className="flex justify-between items-center">
                                        <span className="text-sm text-slate-600">{item.name}</span>
                                        <span className="font-bold text-slate-800">{stock.toFixed(2)} {item.unit}</span>
                                    </div>
                                );
                            })}
                            {rawMaterials.length === 0 && <p className="text-slate-400 text-sm">Henüz hammadde yok</p>}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Package className="h-5 w-5 text-green-600" /> Mamul Stoku
                        </h3>
                        <div className="space-y-3">
                            {products.slice(0, 5).map(item => {
                                const stock = getItemStock(item.id);
                                return (
                                    <div key={item.id} className="flex justify-between items-center">
                                        <span className="text-sm text-slate-600">{item.name}</span>
                                        <span className="font-bold text-slate-800">{stock.toFixed(2)} {item.unit}</span>
                                    </div>
                                );
                            })}
                            {products.length === 0 && <p className="text-slate-400 text-sm">Henüz mamul yok</p>}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-lg">
                        <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                            <Package className="h-5 w-5 text-purple-600" /> Ambalaj Stoku
                        </h3>
                        <div className="space-y-3">
                            {packaging.slice(0, 5).map(item => {
                                const stock = getItemStock(item.id);
                                return (
                                    <div key={item.id} className="flex justify-between items-center">
                                        <span className="text-sm text-slate-600">{item.name}</span>
                                        <span className="font-bold text-slate-800">{stock.toFixed(0)} adet</span>
                                    </div>
                                );
                            })}
                            {packaging.length === 0 && <p className="text-slate-400 text-sm">Henüz ambalaj yok</p>}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ==================== LOADING & AUTH ====================
    if (loading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <FlaskConical className="h-16 w-16 text-indigo-500 mx-auto mb-4 animate-pulse" />
                    <div className="text-white text-xl">Yükleniyor...</div>
                </div>
            </div>
        );
    }

    if (!session) {
        return <Auth />;
    }

    return (
        <div className="min-h-screen bg-slate-100">
            <div className="flex h-screen overflow-hidden">
                {/* Sidebar */}
                <div className="w-64 bg-slate-900 text-white flex flex-col">
                    <div className="p-6">
                        <div className="flex items-center gap-3 mb-6">
                            <FlaskConical className="h-8 w-8 text-indigo-500" />
                            <h1 className="text-xl font-bold">GROHN Kimya</h1>
                        </div>
                        <div className="text-xs text-slate-400 uppercase font-bold mb-2">Menü</div>
                        <nav className="space-y-2">
                            <button onClick={() => setActiveTab('dashboard')} className={'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ' + (activeTab === 'dashboard' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white')}>
                                <LayoutDashboard className="h-5 w-5" /> Dashboard
                            </button>
                            <button onClick={() => setActiveTab('accounts')} className={'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ' + (activeTab === 'accounts' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white')}>
                                <Briefcase className="h-5 w-5" /> Cari Hesaplar
                            </button>
                            <button onClick={() => setActiveTab('purchasing')} className={'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ' + (activeTab === 'purchasing' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white')}>
                                <ShoppingBag className="h-5 w-5" /> Satınalma
                            </button>
                            <button onClick={() => setActiveTab('recipes')} className={'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ' + (activeTab === 'recipes' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white')}>
                                <Beaker className="h-5 w-5" /> Reçeteler
                            </button>
                            <button onClick={() => setActiveTab('production')} className={'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ' + (activeTab === 'production' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white')}>
                                <Factory className="h-5 w-5" /> Üretim
                            </button>
                        </nav>
                    </div>
                    <div className="mt-auto p-6 border-t border-slate-800">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-bold">
                                {user.email[0].toUpperCase()}
                            </div>
                            <div className="overflow-hidden">
                                <div className="text-sm font-medium truncate">{user.email}</div>
                                <div className="text-xs text-slate-400">Yönetici</div>
                            </div>
                        </div>
                        <button onClick={handleSignOut} className="w-full flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                            <LogOut className="h-5 w-5" /> Çıkış Yap
                        </button>
                    </div>
                </div>

                {/* Main Content */}
                <div className="flex-1 overflow-auto">
                    <div className="p-8">
                        {activeTab === 'dashboard' && <Dashboard />}
                        {activeTab === 'accounts' && <CurrentAccountsModule />}
                        {activeTab === 'purchasing' && <PurchasingModule />}
                        {activeTab === 'recipes' && <RecipesModule />}
                        {activeTab === 'production' && <ProductionModule />}
                    </div>
                </div>
            </div>
        </div>
    );
}
