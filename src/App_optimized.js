import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import Auth from './components/Auth';
import CurrentAccountsModule from './components/CurrentAccountsModule';
import PurchasingModule from './components/PurchasingModule';
import RecipesModule from './components/RecipesModule';
import ProductionModule from './components/ProductionModule';
import StockHistoryModule from './components/StockHistoryModule';
import FinancialReportsModule from './components/FinancialReportsModule';

import RoleManagementModule from './components/RoleManagementModule';
import PriceCalculatorModule from './components/PriceCalculatorModule';
import QualityControlModule from './components/QualityControlModule';
import SalesModule from './components/SalesModule';
import { LayoutDashboard, Briefcase, Edit, Trash2, Plus, LogOut, FlaskConical, ShoppingBag, ArrowLeft, Beaker, Factory, Download, Printer, FileSpreadsheet, Filter, Eye, RefreshCw, DollarSign, Package, TrendingUp, Settings, History, AlertTriangle, Users, Shield, Calculator, ClipboardCheck, Menu, X } from 'lucide-react';
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
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Role & Access State
    const [currentOwnerId, setCurrentOwnerId] = useState(null);
    const [userRole, setUserRole] = useState('admin'); // 'admin', 'operator', 'viewer'
    const [roleLoading, setRoleLoading] = useState(false);

    // Data states
    const [accounts, setAccounts] = useState([]);
    const [inventory, setInventory] = useState([]);
    const [purchases, setPurchases] = useState([]);
    const [recipes, setRecipes] = useState([]);
    const [productions, setProductions] = useState([]);
    const [sales, setSales] = useState([]);
    const [qualitySpecs, setQualitySpecs] = useState([]);

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

    // Fetch Role & Owner Logic
    const fetchUserRole = useCallback(async () => {
        if (!user) return;
        setRoleLoading(true);

        // 1. Check if I am a member of someone else's team
        // Note: For MVP, we assume a user is either an owner OR a member of ONE team.
        // If they are both, we default to their own team (Admin).

        // First, assume I am the owner (Admin)
        let ownerId = user.id;
        let role = 'admin';

        // Check membership
        const { data: membership } = await supabase
            .from('team_members')
            .select('owner_id, role')
            .eq('member_id', user.id)
            .maybeSingle();

        if (membership) {
            // I am a member
            ownerId = membership.owner_id;
            role = membership.role;
        }

        setCurrentOwnerId(ownerId);
        setUserRole(role);
        setRoleLoading(false);
    }, [user]);

    useEffect(() => {
        if (user) fetchUserRole();
    }, [user, fetchUserRole]);

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
        if (!user || !currentOwnerId) return;

        const [accRes, invRes, purRes, recRes, prodRes, salesRes, specsRes] = await Promise.all([
            supabase.from('accounts').select('*').eq('user_id', currentOwnerId).order('created_at', { ascending: false }),
            supabase.from('inventory').select('*, lots (*)').eq('user_id', currentOwnerId).order('created_at', { ascending: false }),
            supabase.from('purchases').select('*').eq('user_id', currentOwnerId).order('created_at', { ascending: false }),
            supabase.from('recipes').select('*, recipe_ingredients (*)').eq('user_id', currentOwnerId).order('created_at', { ascending: false }),
            supabase.from('productions').select('*').eq('user_id', currentOwnerId).order('created_at', { ascending: false }),
            supabase.from('sales').select('*').eq('user_id', currentOwnerId).order('created_at', { ascending: false }),
            supabase.from('quality_specs').select('*') // Specs might be public or shared, filtering by product mainly
        ]);

        setAccounts(accRes.data || []);
        setInventory((invRes.data || []).map(i => ({ ...i, lots: i.lots || [] })));
        setPurchases(purRes.data || []);
        setRecipes((recRes.data || []).map(r => ({
            ...r,
            ingredients: (r.recipe_ingredients || []).map(i => ({ itemId: i.item_id, percentage: i.percentage }))
        })));
        // Map productions to include product name from recipe -> inventory
        const productionData = prodRes.data || [];
        const enrichedProductions = productionData.map(prod => {
            const recipe = (recRes.data || []).find(r => r.id === prod.recipe_id);
            const product = recipe ? (invRes.data || []).find(i => i.id === recipe.product_id) : null;
            return {
                ...prod,
                product_name: product ? product.name : 'Bilinmeyen Ürün (' + prod.recipe_id + ')'
            };
        });
        setProductions(enrichedProductions);
        setSales(salesRes.data || []);
        setQualitySpecs(specsRes.data || []);
    }, [user, currentOwnerId]);

    useEffect(() => {
        if (user && currentOwnerId) loadAllData();
    }, [user, currentOwnerId, loadAllData]);

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

    // Permission Check Helper
    const canEdit = userRole === 'admin' || userRole === 'operator';
    const canDelete = userRole === 'admin';
    const canViewFinancials = userRole === 'admin';

    // CRUD Handlers
    const handleAddAccount = async (account) => {
        if (!canEdit) return alert('Yetkiniz yok!');
        try {
            if (account.id) {
                const { error } = await supabase.from('accounts').update({
                    name: account.name,
                    type: account.type,
                    contact: account.contact,
                    phone: account.phone
                }).eq('id', account.id);
                if (error) throw error;
            } else {
                // Ensure we don't send 'id' or other garbage params
                const newAccount = {
                    user_id: currentOwnerId,
                    name: account.name,
                    type: account.type,
                    contact: account.contact,
                    phone: account.phone
                };
                const { error } = await supabase.from('accounts').insert(newAccount);
                if (error) throw error;
            }
            loadAllData();
        } catch (error) {
            console.error('Error saving account:', error);
            alert('Cari kaydedilirken hata oluştu: ' + error.message);
        }
    };

    const handleDeleteAccount = async (id) => {
        if (!canDelete) return alert('Sadece Admin silebilir!');
        if (window.confirm('Bu cariyi silmek istediğinize emin misiniz?')) {
            await supabase.from('accounts').delete().eq('id', id);
            loadAllData();
        }
    };

    const handlePurchase = async (form) => {
        if (!canEdit) return alert('Yetkiniz yok!');
        let itemId;
        let itemName;

        // Calculate Total
        const total = parseFloat(form.qty) * parseFloat(form.price);

        if (form.isNewItem) {
            // New Item
            let insertData = {
                user_id: currentOwnerId,
                name: form.newItemName,
                type: form.newItemType, // Hammadde or Ambalaj
                unit: form.newItemUnit,
                cost: form.isInfinite ? 0 : parseInputFloat(form.price), // 0 cost for Infinite
                currency: form.currency || 'USD',
                track_stock: !form.isInfinite, // Don't track stock if infinite
                density: 1.0 // Default density
            };

            if (form.newItemType === 'Ambalaj' && !form.isInfinite) {
                insertData.capacity_value = parseInputFloat(form.capacityValue);
                insertData.capacity_unit = form.capacityUnit;
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

        // If Infinite Source, stop here (no purchase record, no lot)
        if (form.isInfinite) {
            loadAllData();
            alert(`"${itemName}" sonsuz kaynak olarak tanımlandı.\nStok takibi yapılmayacak, maliyeti 0 olacak.`);
            return true;
        }

        // Add lot
        await supabase.from('lots').insert({
            inventory_id: itemId,
            lot_no: form.lotNo || 'LOT-' + Date.now(),
            qty: parseInputFloat(form.qty)
        });

        // Record purchase
        await supabase.from('purchases').insert({
            user_id: currentOwnerId,
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
        if (!canDelete) return alert('Sadece Admin silebilir!');
        if (window.confirm('Bu alımı silmek istediğinize emin misiniz?')) {
            await supabase.from('purchases').delete().eq('id', id);
            loadAllData();
        }
    };

    const handleSaveRecipe = async (data, isNew, newName) => {
        if (!canEdit) return alert('Yetkiniz yok!');
        let productId = data.productId;

        if (isNew) {
            const { data: p } = await supabase.from('inventory').insert({
                user_id: currentOwnerId,
                name: newName,
                type: 'Mamul',
                unit: 'kg',
                cost: 0,
                currency: 'USD',
                track_stock: true,
                density: parseInputFloat(data.density) || 1.0
            }).select().single();
            productId = p.id;

            // Generate PRD-000 code
            const code = 'PRD-' + productId.toString().padStart(3, '0');
            await supabase.from('inventory').update({ product_code: code }).eq('id', productId);
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
                user_id: currentOwnerId,
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
        if (!canDelete) return alert('Sadece Admin silebilir!');
        if (window.confirm('Bu reçeteyi silmek istediğinize emin misiniz?')) {
            await supabase.from('recipes').delete().eq('id', id);
            loadAllData();
        }
    };

    // UPDATED: handlePlanProduction
    const handlePlanProduction = async (form) => {
        if (!canEdit) return alert('Yetkiniz yok!');
        try {
            const { data, error } = await supabase.rpc('create_production_plan', {
                p_user_id: currentOwnerId,
                p_recipe_id: parseInt(form.recipeId),
                p_quantity: parseInputFloat(form.quantity),
                p_production_date: form.productionDate,
                p_notes: form.notes || '',
                p_target_packaging_id: form.targetPackagingId ? parseInt(form.targetPackagingId) : null,
                p_target_package_count: form.targetPackageCount ? parseInputFloat(form.targetPackageCount) : null,
                p_customer_id: form.customerId ? parseInt(form.customerId) : null
            });

            if (error) throw error;

            loadAllData();
            alert(`Üretim planı oluşturuldu!\n\nİş Emri No: ${data.lot_number}`);
            return true;
        } catch (error) {
            console.error('Planlama hatası:', error);
            alert('Hata oluştu: ' + error.message);
            return false;
        }
    };

    // UPDATED: handleCompleteProduction
    const handleCompleteProduction = async (form) => {
        if (!canEdit) return alert('Yetkiniz yok!');
        try {
            const { data, error } = await supabase.rpc('complete_production', {
                p_production_id: parseInt(form.productionId),
                p_user_id: currentOwnerId,
                p_packaging_id: parseInt(form.packagingId),
                p_shipping_cost: parseInputFloat(form.shippingCost),
                p_overhead_cost: parseInputFloat(form.overheadCost),
                p_sale_term_days: parseInputFloat(form.saleTermDays),
                p_profit_margin: parseInputFloat(form.profitMarginPercent),
                p_qc_status: form.qcStatus,
                p_qc_notes: form.qcNotes,
                p_currency: form.currency || 'USD',
                p_monthly_interest_rate: parseInputFloat(form.interestRate) || 4
            });

            if (error) throw error;

            loadAllData();
            alert(`Üretim başarıyla tamamlandı!\n\nLOT: ${data.lot_number}`);
            return true;
        } catch (error) {
            console.error('Üretim tamamlama hatası:', error);
            alert('Hata oluştu: ' + error.message);
            return false;
        }
    };

    const handleDeleteProduction = async (id) => {
        if (!canDelete) return alert('Sadece Admin silebilir!');
        if (window.confirm('Bu üretimi silmek istediğinize emin misiniz?')) {
            const { error } = await supabase.from('productions').delete().eq('id', id);
            if (error) {
                console.error('Silme hatası:', error);
                alert('Silinemedi! (Bağlı kayıtlar veya yetki sorunu olabilir)\n' + error.message);
            } else {
                loadAllData();
            }
        }
    };

    const handleSale = async (form) => {
        if (!canEdit) return alert('Yetkiniz yok!');
        try {
            const { data, error } = await supabase.rpc('process_sale', {
                p_user_id: currentOwnerId,
                p_customer_id: parseInt(form.customerId),
                p_production_id: parseInt(form.productionId),
                p_quantity: parseInputFloat(form.quantity),
                p_unit_price: parseInputFloat(form.unitPrice),
                p_currency: form.currency,
                p_payment_term: parseInputFloat(form.paymentTerm),
                p_sale_date: form.saleDate,
                p_notes: form.notes || ''
            });

            if (error) throw error;

            loadAllData();
            alert('Satış başarıyla kaydedildi!');
            return true;
        } catch (error) {
            console.error('Satış hatası:', error);
            alert('Hata oluştu: ' + error.message);
            return false;
        }
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

        // Low Stock Logic (Threshold: 100 for now, can be dynamic later)
        const lowStockItems = inventory.filter(i => {
            const stock = getItemStock(i.id);
            return stock < 100; // Example threshold
        });

        return (
            <div className="space-y-6">
                {/* Low Stock Alert */}
                {lowStockItems.length > 0 && (
                    <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-xl">
                        <div className="flex items-start gap-3">
                            <AlertTriangle className="h-6 w-6 text-red-600 flex-shrink-0" />
                            <div>
                                <h3 className="font-bold text-red-800">Kritik Stok Uyarısı</h3>
                                <p className="text-sm text-red-700 mt-1">
                                    Aşağıdaki ürünlerin stoku kritik seviyenin altında:
                                </p>
                                <div className="mt-2 flex flex-wrap gap-2">
                                    {lowStockItems.map(i => (
                                        <span key={i.id} className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-bold border border-red-200">
                                            {i.name} ({getItemStock(i.id).toFixed(2)} {i.unit})
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

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

    if (roleLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex items-center justify-center">
                <div className="text-center">
                    <Shield className="h-16 w-16 text-indigo-500 mx-auto mb-4 animate-pulse" />
                    <div className="text-white text-xl">Yetkiler Kontrol Ediliyor...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-100 flex flex-col md:flex-row h-screen overflow-hidden">
            {/* Mobile Header */}
            <div className="md:hidden bg-slate-900 text-white p-4 flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2">
                    <FlaskConical className="h-6 w-6 text-indigo-500" />
                    <span className="font-bold text-lg">GROHN Kimya</span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-slate-300 hover:text-white">
                    {isMobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <FlaskConical className="h-8 w-8 text-indigo-500" />
                            <h1 className="text-xl font-bold">GROHN Kimya</h1>
                        </div>
                        {/* Close button for mobile inside sidebar */}
                        <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden text-slate-400 hover:text-white">
                            <X className="h-6 w-6" />
                        </button>
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
                        <button onClick={() => setActiveTab('sales')} className={'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ' + (activeTab === 'sales' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white')}>
                            <DollarSign className="h-5 w-5" /> Satış
                        </button>
                        <button onClick={() => setActiveTab('recipes')} className={'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ' + (activeTab === 'recipes' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white')}>
                            <Beaker className="h-5 w-5" /> Reçeteler
                        </button>
                        <button onClick={() => setActiveTab('production')} className={'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ' + (activeTab === 'production' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white')}>
                            <Factory className="h-5 w-5" /> Üretim
                        </button>
                        <button onClick={() => setActiveTab('stock_history')} className={'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ' + (activeTab === 'stock_history' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white')}>
                            <History className="h-5 w-5" /> Stok Geçmişi
                        </button>

                        <button onClick={() => setActiveTab('calculator')} className={'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ' + (activeTab === 'calculator' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white')}>
                            <Calculator className="h-5 w-5" /> Fiyat Hesapla
                        </button>
                        <button onClick={() => setActiveTab('quality_control')} className={'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ' + (activeTab === 'quality_control' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white')}>
                            <ClipboardCheck className="h-5 w-5" /> Kalite Kontrol
                        </button>

                        {canViewFinancials && (
                            <button onClick={() => setActiveTab('financials')} className={'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ' + (activeTab === 'financials' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white')}>
                                <TrendingUp className="h-5 w-5" /> Finansal Raporlar
                            </button>
                        )}

                        {userRole === 'admin' && (
                            <button onClick={() => setActiveTab('roles')} className={'w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ' + (activeTab === 'roles' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white')}>
                                <Users className="h-5 w-5" /> Kullanıcılar
                            </button>
                        )}
                    </nav>
                </div>
                <div className="mt-auto p-6 border-t border-slate-800">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center font-bold">
                            {user.email[0].toUpperCase()}
                        </div>
                        <div className="overflow-hidden">
                            <div className="text-sm font-medium truncate">{user.email}</div>
                            <div className="flex items-center gap-1 text-xs text-slate-400">
                                <Shield className="h-3 w-3" />
                                {userRole === 'admin' ? 'Yönetici' : userRole === 'operator' ? 'Operatör' : 'İzleyici'}
                            </div>
                        </div>
                    </div>
                    <button onClick={handleSignOut} className="w-full flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                        <LogOut className="h-5 w-5" /> Çıkış Yap
                    </button>
                </div>
            </div>


            {/* Overlay for mobile */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Main Content */}
            <div className="flex-1 overflow-auto w-full relative">
                <div className="p-4 md:p-8">
                    {activeTab === 'dashboard' && <Dashboard />}
                    {activeTab === 'accounts' && <CurrentAccountsModule
                        accounts={accounts}
                        sales={sales}
                        purchases={purchases}
                        onAdd={handleAddAccount}
                        onDelete={handleDeleteAccount}
                    />}
                    {activeTab === 'purchasing' && <PurchasingModule
                        purchases={purchases}
                        inventory={inventory}
                        suppliers={accounts}
                        onPurchase={handlePurchase}
                        onDelete={handleDeletePurchase}
                    />}
                    {activeTab === 'sales' && <SalesModule
                        sales={sales}
                        inventory={inventory}
                        accounts={accounts}
                        productions={productions}
                        onSale={handleSale}
                    />}
                    {activeTab === 'recipes' && <RecipesModule
                        recipes={recipes}
                        inventory={inventory}
                        customers={accounts.filter(a => a.type === 'Müşteri' || a.type === 'Her İkisi')}
                        onSave={handleSaveRecipe}
                        onDelete={handleDeleteRecipe}
                    />}
                    {activeTab === 'production' && <ProductionModule
                        session={session}
                        onRefresh={loadAllData}
                        productions={productions}
                        recipes={recipes}
                        inventory={inventory}
                        qualitySpecs={qualitySpecs}
                        customers={accounts.filter(a => a.type === 'Müşteri' || a.type === 'Her İkisi')}
                        onPlan={handlePlanProduction}
                        onComplete={handleCompleteProduction}
                        onDelete={handleDeleteProduction}
                    />}
                    {activeTab === 'stock_history' && <StockHistoryModule inventory={inventory} />}
                    {activeTab === 'calculator' && <PriceCalculatorModule recipes={recipes} inventory={inventory} exchangeRates={getActiveRates()} />}
                    {activeTab === 'quality_control' && <QualityControlModule inventory={inventory} onRefresh={loadAllData} />}
                    {activeTab === 'financials' && canViewFinancials && <FinancialReportsModule
                        sales={sales}
                        productions={productions}
                        purchases={purchases}
                        inventory={inventory}
                        accounts={accounts}
                        exchangeRates={getActiveRates()}
                    />}
                    {activeTab === 'roles' && userRole === 'admin' && <RoleManagementModule currentUser={user} />}
                </div>
            </div>
        </div>
    );
}

