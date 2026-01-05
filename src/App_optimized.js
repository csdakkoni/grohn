import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from './supabaseClient';
import Auth from './components/Auth';
import RecipesModule from './components/RecipesModule';
import ProductionModule from './components/ProductionModule';
import FinancialReportsModule from './components/FinancialReportsModule';

import RoleManagementModule from './components/RoleManagementModule';
import QualityControlModule from './components/QualityControlModule';
import InventoryManagementModule from './components/InventoryManagementModule';
import CommercialManagementModule from './components/CommercialManagementModule';
import SalesManagerModule from './components/SalesManagerModule';
import MarketingModule from './components/MarketingModule';
import SettingsModule from './components/SettingsModule';
import UnauthorizedView from './components/UnauthorizedView';
import { LayoutDashboard, Briefcase, Edit, Trash2, Plus, LogOut, FlaskConical, ShoppingBag, ArrowLeft, Beaker, Factory, Download, Printer, FileSpreadsheet, Filter, Eye, RefreshCw, DollarSign, Package, TrendingUp, Settings, History, AlertTriangle, Users, Shield, Calculator, ClipboardCheck, Menu, X, ChevronDown, ChevronRight, ShoppingCart, FileText, ShieldCheck } from 'lucide-react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { preparePDFWithFont } from './utils/exportUtils';
import { drawCIHeader, drawCIFooter, CI_PALETTE } from './utils/pdfCIUtils';

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

const exportToPDF = async (title, headers, data, fileName) => {
    const doc = await preparePDFWithFont();
    const fontName = doc.activeFont || 'helvetica';
    const docDate = new Date().toLocaleDateString('tr-TR');

    drawCIHeader(doc, title, 'KURUMSAL VERİ SİSTEMİ', docDate);

    autoTable(doc, {
        startY: 40,
        head: [headers],
        body: data,
        theme: 'grid',
        styles: { font: fontName, fontSize: 8, cellPadding: 2 },
        headStyles: { fillColor: CI_PALETTE.pure_black, textColor: 255 },
        margin: { top: 40, bottom: 35 },
        didDrawPage: (data) => {
            drawCIHeader(doc, title, 'KURUMSAL VERİ SİSTEMİ', docDate);
            drawCIFooter(doc, {}, 'Otomatik Rapor v5.3.0');
        }
    });

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
            <button onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }} className={'ml-2 hover:text-[#0071e3] transition-colors ' + (value ? 'text-[#0071e3]' : 'text-[#86868b]')} title={'Filtrele: ' + label}>
                <Filter className="h-4 w-4" />
            </button>
            {isOpen && (
                <>
                    <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
                    <div className="absolute right-0 z-50 mt-2 w-48 bg-white rounded-[6px] shadow-xl border border-[#d2d2d7] animate-fade-in">
                        <div className="p-1 max-h-64 overflow-y-auto">
                            <button onClick={() => { onChange(''); setIsOpen(false); }} className="w-full text-left px-3 py-2 hover:bg-[#f5f5f7] rounded-[4px] text-xs font-medium text-[#1d1d1f]">
                                Tümü
                            </button>
                            {options.map((opt, idx) => (
                                <button key={idx} onClick={() => { onChange(opt); setIsOpen(false); }} className={'w-full text-left px-3 py-2 hover:bg-[#f5f5f7] rounded-[4px] text-xs ' + (value === opt ? 'bg-[#e8f2ff] text-[#0071e3] font-bold' : 'text-[#1d1d1f]')}>
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
        <button onClick={onExcel} className="btn-primary-green flex items-center gap-2 text-xs py-2 px-3">
            <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
        </button>
        <button onClick={onPDF} className="btn-primary-red flex items-center gap-2 text-xs py-2 px-3">
            <Download className="h-3.5 w-3.5" /> PDF
        </button>
        <button onClick={onPrint} className="btn-secondary flex items-center gap-2 text-xs py-2 px-3">
            <Printer className="h-3.5 w-3.5" /> Yazdır
        </button>
    </div>
);

const SidebarItem = ({ active, onClick, icon, label }) => (
    <button
        onClick={onClick}
        className={`w-full group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-sm relative overflow-hidden ${active
            ? 'bg-white/10 text-white shadow-[0_0_20px_rgba(79,70,229,0.15)] backdrop-blur-md'
            : 'text-zinc-500 hover:text-zinc-200 hover:bg-white/5'
            }`}
    >
        {/* Active Indicator Bar */}
        <div className={`absolute left-0 top-3 bottom-3 w-1 bg-indigo-500 rounded-r-full transition-all duration-500 transform ${active ? 'scale-y-100 opacity-100' : 'scale-y-0 opacity-0'}`} />

        <div className={`transition-transform duration-300 ${active ? 'scale-110 text-indigo-400' : 'group-hover:text-zinc-300 group-hover:scale-105'}`}>
            {icon}
        </div>
        <span className={`font-medium tracking-wide transition-colors duration-300 ${active ? 'translate-x-1' : 'group-hover:translate-x-0.5'}`}>
            {label}
        </span>

        {/* Subtle Light Reflection (Hover) */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-10 pointer-events-none transition-opacity bg-gradient-to-r from-transparent via-white/5 to-transparent -translate-x-full group-hover:translate-x-full duration-1000" />
    </button>
);

const CurrencySelector = ({ value, onChange, className = '' }) => (
    <select value={value} onChange={e => onChange(e.target.value)} className={'select-industrial ' + className}>
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
    const [globalSettings, setGlobalSettings] = useState({
        global_overhead_rate: 0.2,
        monthly_interest_rate: 4.0
    });
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('dashboard');


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
    const [ibcMovements, setIbcMovements] = useState([]);

    // Currency states
    const [exchangeRates, setExchangeRates] = useState({ USD: 1, EUR: 0.92, TRY: 34.50 });
    const [manualRates, setManualRates] = useState({ usd_try: '', eur_try: '' });
    const [useManualRates, setUseManualRates] = useState(false);
    const [ratesLoading, setRatesLoading] = useState(false);
    const [ratesLastUpdate, setRatesLastUpdate] = useState(null);
    const [baseCurrency, setBaseCurrency] = useState('TRY');

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

        // 1. Check if I am a member of a team
        // Default: No access
        let ownerId = null;
        let role = 'none';

        // Check membership
        const { data: membership } = await supabase
            .from('team_members')
            .select('owner_id, role')
            .eq('member_id', user.id)
            .maybeSingle();

        if (membership) {
            // I am a member (or owner linked as admin)
            ownerId = membership.owner_id;
            role = membership.role;
        } else {
            // Fallback: Check if I am an owner in team_members (self-reference for first user/owners)
            const { data: selfMember } = await supabase
                .from('team_members')
                .select('owner_id, role')
                .eq('member_email', user.email)
                .maybeSingle();

            if (selfMember) {
                // Pending invite exists, maybe trigger didn't fire or race condition
                // Manually link if ID is missing (handled by SQL trigger usually but safe to check)
            }
        }

        // If no role found, user stays with role='none' and ownerId=null
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
            const usd_try = parseInputFloat(manualRates.usd_try) || exchangeRates.TRY;
            const eur_try = parseInputFloat(manualRates.eur_try) || ((1 / exchangeRates.EUR) * exchangeRates.TRY);

            // Internal logic is USD based: 1 USD = usd_try TRY
            // 1 EUR = eur_try TRY => 1 USD = (usd_try / eur_try) EUR
            return {
                USD: 1.0,
                TRY: usd_try,
                EUR: usd_try / eur_try
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
    const loadSettings = useCallback(async () => {
        const { data, error } = await supabase.from('settings').select('*');
        if (!error && data) {
            const settingsObj = {};
            data.forEach(s => { settingsObj[s.setting_key] = s.value; });
            setGlobalSettings(prev => ({ ...prev, ...settingsObj }));
        }
    }, []);

    const saveSetting = async (key, value) => {
        const { error } = await supabase.from('settings').upsert({ setting_key: key, value }, { onConflict: 'setting_key' });
        if (!error) {
            setGlobalSettings(prev => ({ ...prev, [key]: value }));
        } else {
            console.error('Settings save error:', error);
            alert('Ayar kaydedilirken hata oluştu.');
        }
    };

    const loadAllData = useCallback(async () => {
        if (!user || !currentOwnerId) return;

        await loadSettings();

        const [accRes, invRes, purRes, recRes, prodRes, salesRes, specsRes, ibcRes] = await Promise.all([
            supabase.from('accounts').select('*').eq('user_id', currentOwnerId).order('created_at', { ascending: false }),
            supabase.from('inventory').select('*, lots (*)').eq('user_id', currentOwnerId).order('created_at', { ascending: false }),
            supabase.from('purchases').select('*').eq('user_id', currentOwnerId).order('created_at', { ascending: false }),
            supabase.from('recipes').select('*, recipe_ingredients (*)').eq('user_id', currentOwnerId).order('created_at', { ascending: false }),
            supabase.from('productions').select('*').eq('user_id', currentOwnerId).order('created_at', { ascending: false }),
            supabase.from('sales').select('*').eq('user_id', currentOwnerId).order('created_at', { ascending: false }),
            supabase.from('quality_specs').select('*'), // Specs might be public or shared, filtering by product mainly
            supabase.from('ibc_movements').select('*').eq('user_id', currentOwnerId).order('created_at', { ascending: false })
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

        // Map sales to include customer name from accounts
        const salesData = salesRes.data || [];
        const enrichedSales = salesData.map(sale => {
            const customer = (accRes.data || []).find(c => c.id === sale.customer_id);
            return {
                ...sale,
                customer_name: customer ? customer.name : 'Bilinmeyen Müşteri'
            };
        });
        setSales(enrichedSales);
        setQualitySpecs(specsRes.data || []);
        setIbcMovements(ibcRes.data || []);
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
        try {
            const item = !form.isNewItem ? inventory.find(i => i.id === parseInt(form.itemId)) : null;
            const itemName = form.isNewItem ? form.newItemName : (item?.name || '');
            const itemType = form.isNewItem ? form.newItemType : (item?.type || 'Hammadde');

            const { data, error: purchaseError } = await supabase.rpc('process_purchase', {
                p_user_id: currentOwnerId,
                p_supplier_id: parseInt(form.supplierId),
                p_item_name: itemName,
                p_item_type: itemType,
                p_unit: form.isNewItem ? form.newItemUnit : form.purchaseUnit,
                p_qty: parseInputFloat(form.qty),
                p_price: parseInputFloat(form.price),
                p_currency: form.currency || 'USD',
                p_term_days: parseInt(form.termDays) || 0,
                p_lot_no: form.lotNo || '',
                p_is_new_item: !!form.isNewItem,
                p_item_id: form.isNewItem ? null : parseInt(form.itemId),
                p_capacity_value: form.capacityValue ? parseInputFloat(form.capacityValue) : null,
                p_capacity_unit: form.capacityUnit || null,
                p_tare_weight: form.tareWeight ? parseInputFloat(form.tareWeight) : null
            });

            if (purchaseError) throw purchaseError;

            loadAllData();
            return true;
        } catch (error) {
            console.error('Alım Hatası:', error);
            alert('İşlem sırasında bir hata oluştu: ' + (error.message || JSON.stringify(error)));
            return false;
        }
    };

    const handleDeletePurchase = async (id) => {
        if (!canDelete) return alert('Sadece Admin silebilir!');
        if (window.confirm('Bu alımı silmek istediğinize emin misiniz?')) {
            const purchase = purchases.find(p => p.id === id);
            if (purchase) {
                // Delete associated lot first
                await supabase.from('lots').delete()
                    .eq('lot_no', purchase.lot_no)
                    .eq('inventory_id', (inventory.find(i => i.name === purchase.item_name))?.id);

                // Delete associated stock movement (Robust dual-targeted deletion)
                // 1. Delete by direct ID link
                await supabase.from('stock_movements').delete()
                    .eq('related_id', id)
                    .eq('reason', 'Purchase');

                // 2. Delete by lot/item name to catch "ghost" records from previous versions
                await supabase.from('stock_movements').delete()
                    .eq('lot_no', purchase.lot_no)
                    .eq('item_name', purchase.item_name)
                    .eq('reason', 'Purchase');
            }
            await supabase.from('purchases').delete().eq('id', id);
            loadAllData();
        }
    };

    const handleUpdatePurchase = async (id, form) => {
        if (!canEdit) return alert('Yetkiniz yok!');
        try {
            // Find item name if not in form (from existing purchase or inventory)
            const purchase = purchases.find(p => p.id === id);
            const itemName = form.itemName || purchase?.item_name || '';

            const { data, error: updateError } = await supabase.rpc('process_purchase_update', {
                p_purchase_id: id,
                p_supplier_id: parseInt(form.supplierId),
                p_item_name: itemName,
                p_qty: parseInputFloat(form.qty),
                p_price: parseInputFloat(form.price),
                p_currency: form.currency || 'USD',
                p_term_days: parseInt(form.termDays) || 0,
                p_lot_no: form.lotNo || ''
            });

            if (updateError) throw updateError;

            loadAllData();
            return true;
        } catch (error) {
            console.error('Güncelleme Hatası:', error);
            alert('Güncelleme sırasında bir hata oluştu: ' + (error.message || JSON.stringify(error)));
            return false;
        }
    };

    const handleStockReconciliation = async (itemId, physicalQty, notes) => {
        if (!canEdit) return alert('Yetkiniz yok!');
        try {
            // 1. Get Physical Stock (from lots)
            const physicalStock = getItemStock(itemId);

            // 2. Get Logical Balance (from movements)
            const { data: movements } = await supabase
                .from('stock_movements')
                .select('amount')
                .eq('inventory_id', itemId);
            const logicalStock = (movements || []).reduce((sum, m) => sum + parseFloat(m.amount), 0);

            const lotAdjustment = physicalQty - physicalStock;
            const moveAdjustment = physicalQty - logicalStock;

            // Update LOTS if physically different
            if (Math.abs(lotAdjustment) > 0.0001) {
                const adjLot = `ADJ-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
                const { error: lotError } = await supabase.from('lots').insert({
                    inventory_id: itemId,
                    qty: lotAdjustment,
                    lot_no: adjLot
                });
                if (lotError) throw lotError;
            }

            // Update MOVEMENTS if logically different OR if we want to log the event even if amount is 0
            // We always log it for audit trail, but the 'amount' determines if it changes the running balance
            const item = inventory.find(i => i.id === itemId);
            const adjLot = `SYNC-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;

            const { error: moveError } = await supabase.from('stock_movements').insert({
                user_id: currentOwnerId,
                inventory_id: itemId,
                item_name: item?.name || 'Bilinmeyen',
                type: moveAdjustment >= 0 ? 'In' : 'Out',
                amount: moveAdjustment,
                current_stock: physicalQty,
                reason: 'Adjustment',
                lot_no: adjLot,
                notes: notes || (moveAdjustment === 0 ? 'Fiziksel/Mantıksal Senkronizasyon' : 'Sayım Farkı Düzeltmesi')
            });

            if (moveError) console.warn('Hareket kaydı oluşturulamadı:', moveError);

            loadAllData();
            alert('Stok başarıyla senkronize edildi.');
            return true;
        } catch (error) {
            console.error('Stok düzeltme hatası:', error);
            alert('Hata: ' + error.message);
            return false;
        }
    };
    const handleDeleteStockMovement = async (id) => {
        if (!canEdit) return alert('Yetkiniz yok!');
        if (!window.confirm('Bu stok hareket kaydını silmek istediğinize emin misiniz? Sadece geçmiş kaydı silinecektir, mevcut stok miktarı bu işlemden etkilenmez.')) return;
        try {
            const { error } = await supabase.from('stock_movements').delete().eq('id', id);
            if (error) throw error;
            loadAllData();
            return true;
        } catch (error) {
            console.error('Hareket silme hatası:', error);
            alert('Hata: ' + error.message);
            return false;
        }
    };

    const handleIbcReturn = async (customerId, quantity, notes) => {
        if (!canEdit) return alert('Yetkiniz yok!');
        try {
            const { error } = await supabase.from('ibc_movements').insert({
                user_id: currentOwnerId,
                customer_id: customerId,
                type: 'Returned',
                quantity: quantity,
                notes: notes || 'Müşteri İadesi'
            });

            if (error) throw error;
            loadAllData();
            alert('IBC iadesi başarıyla kaydedildi.');
            return true;
        } catch (error) {
            console.error('IBC iade hatası:', error);
            alert('Hata: ' + error.message);
            return false;
        }
    };

    const handleDeleteIbcMovement = async (id) => {
        if (!canDelete) return alert('Sadece yöneticiler IBC hareketlerini silebilir!');
        if (!window.confirm('Bu IBC hareket kaydını silmek istediğinize emin misiniz?')) return;
        try {
            const { error } = await supabase.from('ibc_movements').delete().eq('id', id);
            if (error) throw error;
            loadAllData();
            return true;
        } catch (error) {
            console.error('IBC hareket silme hatası:', error);
            alert('Hata: ' + error.message);
            return false;
        }
    };

    const handleSaveRecipe = async (data, isNew, newName) => {
        if (!canEdit) return alert('Yetkiniz yok!');
        let productId = data.productId;

        try {
            if (isNew) {
                const { data: p, error: invError } = await supabase.from('inventory').insert({
                    user_id: currentOwnerId,
                    name: newName,
                    type: 'Mamul',
                    unit: 'kg',
                    cost: 0,
                    currency: 'USD',
                    track_stock: true,
                    density: parseInputFloat(data.density) || 1.0,
                    ghs_symbols: data.ghsSymbols || [],
                    shelf_life_months: parseInt(data.shelfLife) || 24
                }).select().single();

                if (invError) throw invError;
                if (!p) throw new Error('Ürün oluşturulamadı (Veritabanı yanıt vermedi).');

                productId = p.id;
                // Code generation is now handled by the database trigger (generate_next_product_code)
            }

            if (data.id) {
                const { error: updateError } = await supabase.from('recipes').update({
                    product_id: productId,
                    customer_id: parseInt(data.customerId) || null
                }).eq('id', data.id);

                if (updateError) throw updateError;

                if (data.ghsSymbols || data.shelfLife) {
                    const invUpdate = {};
                    if (data.ghsSymbols) invUpdate.ghs_symbols = data.ghsSymbols;
                    if (data.shelfLife) invUpdate.shelf_life_months = parseInt(data.shelfLife);
                    await supabase.from('inventory').update(invUpdate).eq('id', productId);
                }
                await supabase.from('recipe_ingredients').delete().eq('recipe_id', data.id);

                const ingredientsData = data.ingredients.map(i => ({
                    recipe_id: data.id,
                    item_id: parseInt(i.itemId),
                    percentage: parseInputFloat(i.percentage)
                }));

                if (ingredientsData.length > 0) {
                    const { error: ingError } = await supabase.from('recipe_ingredients').insert(ingredientsData);
                    if (ingError) throw ingError;
                }

            } else {
                const { data: r, error: recipeError } = await supabase.from('recipes').insert({
                    user_id: currentOwnerId,
                    product_id: productId,
                    customer_id: parseInt(data.customerId) || null
                }).select().single();

                if (recipeError) throw recipeError;
                if (!r) throw new Error('Reçete oluşturulamadı.');

                const ingredientsData = data.ingredients.map(i => ({
                    recipe_id: r.id,
                    item_id: parseInt(i.itemId),
                    percentage: parseInputFloat(i.percentage)
                }));

                if (ingredientsData.length > 0) {
                    const { error: ingError } = await supabase.from('recipe_ingredients').insert(ingredientsData);
                    if (ingError) throw ingError;
                }
            }

            loadAllData();
            return true;

        } catch (error) {
            console.error('Reçete kaydetme hatası:', error);
            alert('Reçete kaydedilirken hata oluştu: ' + error.message);
            return false;
        }
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

        // Conversion helpers
        const activeRates = getActiveRates();
        const toUSD = (amount, currency) => {
            if (!currency || currency === 'USD') return amount;
            const rate = activeRates[currency];
            return rate ? amount / rate : amount;
        };
        const fromUSD = (amountUSD, targetCurrency) => {
            if (!targetCurrency || targetCurrency === 'USD') return amountUSD;
            const rate = activeRates[targetCurrency];
            return rate ? amountUSD * rate : amountUSD;
        };

        const targetCurrency = form.currency || 'USD';
        const shippingUSD = toUSD(parseInputFloat(form.shippingCost), form.shippingCurrency);
        const overheadUSD = toUSD(parseInputFloat(form.overheadCost), form.overheadCurrency);

        try {
            const { data, error } = await supabase.rpc('complete_production', {
                p_production_id: parseInt(form.productionId),
                p_user_id: currentOwnerId,
                p_packaging_id: form.packagingId ? parseInt(form.packagingId) : null,
                p_packaging_count: form.packagingCount ? parseInputFloat(form.packagingCount) : null,
                p_qc_status: form.qcStatus,
                p_qc_notes: form.qcNotes || '',
                p_currency: targetCurrency,
                p_usd_rate: getActiveRates().TRY,
                p_eur_rate: (1 / getActiveRates().EUR) * getActiveRates().TRY
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
        if (window.confirm('Bu üretimi silmek istediğinize emin misiniz? Bu işlem bağlı tüm stok hareketlerini ve test kayıtlarını da temizleyecektir.')) {
            try {
                const { data, error } = await supabase.rpc('delete_production', {
                    p_production_id: id
                });

                if (error) throw error;

                if (data.success) {
                    loadAllData();
                } else {
                    alert('Hata: ' + data.error);
                }
            } catch (error) {
                console.error('Silme hatası:', error);
                alert('Silinemedi! ' + error.message);
            }
        }
    };

    const handleSale = async (form) => {
        if (!canEdit) return alert('Yetkiniz yok!');
        try {
            const { data: saleId, error } = await supabase.rpc('process_sale', {
                p_user_id: currentOwnerId,
                p_customer_id: parseInt(form.customerId),
                p_production_id: parseInt(form.productionId),
                p_quantity: parseInputFloat(form.quantity),
                p_unit_price: parseInputFloat(form.unitPrice),
                p_currency: form.currency,
                p_payment_term: parseInputFloat(form.paymentTerm),
                p_sale_date: form.saleDate,
                p_notes: form.notes || '',
                p_shipping_cost: parseInputFloat(form.shippingCost),
                p_overhead_cost: parseInputFloat(form.overheadCost),
                p_monthly_interest_rate: parseInputFloat(form.interestRate) || 4.5,
                p_usd_rate: getActiveRates().TRY,
                p_eur_rate: (1 / getActiveRates().EUR) * getActiveRates().TRY
            });

            if (error) throw error;

            // TRACK IBC IF APPLICABLE (Based on ACTUAL packaging selected in sale)
            if (form.packagingId) {
                const pkg = inventory.find(i => i.id === parseInt(form.packagingId));
                if (pkg && pkg.name.toUpperCase().includes('IBC')) {
                    const prod = productions.find(p => p.id === parseInt(form.productionId));
                    const saleQty = parseInputFloat(form.quantity);
                    const capacity = parseFloat(pkg.capacity_value) || 1000;
                    const pkgCount = Math.ceil(saleQty / capacity);

                    if (pkgCount > 0) {
                        await supabase.from('ibc_movements').insert({
                            user_id: currentOwnerId,
                            customer_id: parseInt(form.customerId),
                            sale_id: saleId,
                            type: 'Sent',
                            quantity: pkgCount,
                            notes: `Satış Sevkiyatı (Lot: ${prod?.lot_number || '?'})`
                        });
                    }
                }
            }

            loadAllData();
            alert('Satış başarıyla kaydedildi!');
            return true;
        } catch (error) {
            console.error('Satış hatası:', error);
            alert('Hata oluştu: ' + error.message);
            return false;
        }
    };

    const handleDeleteSale = async (id) => {
        if (!canEdit) return alert('Yetkiniz yok!');
        if (!window.confirm('Bu satış kaydını silmek istediğinize emin misiniz? Bu işlem stokları geri yükleyecek ve varsa IBC borcunu silecektir.')) return;
        try {
            // First cleanup IBC movements
            await supabase.from('ibc_movements').delete().eq('sale_id', id);

            const { data, error } = await supabase.rpc('delete_sale', {
                p_sale_id: id,
                p_user_id: currentOwnerId
            });
            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);
            loadAllData();
            return true;
        } catch (error) {
            console.error('Satış silme hatası:', error);
            alert('Hata: ' + error.message);
            return false;
        }
    };

    const handleUpdateSale = async (id, form) => {
        if (!canEdit) return alert('Yetkiniz yok!');
        try {
            const { data, error } = await supabase.rpc('update_sale', {
                p_sale_id: id,
                p_user_id: currentOwnerId,
                p_customer_id: parseInt(form.customerId),
                p_quantity: parseInputFloat(form.quantity),
                p_unit_price: parseInputFloat(form.unitPrice),
                p_currency: form.currency,
                p_payment_term: parseInputFloat(form.paymentTerm),
                p_sale_date: form.saleDate,
                p_notes: form.notes || '',
                p_packaging_id: parseInt(form.packagingId) || null
            });
            if (error) throw error;
            if (data && !data.success) throw new Error(data.message);

            // SYNC IBC MOVEMENT
            await supabase.from('ibc_movements').delete().eq('sale_id', id);

            if (form.packagingId) {
                const pkg = inventory.find(i => i.id === parseInt(form.packagingId));
                if (pkg && pkg.name.toUpperCase().includes('IBC')) {
                    const sale = sales.find(s => s.id === id);
                    const prod = productions.find(p => p.id === sale?.production_id);
                    const saleQty = parseInputFloat(form.quantity);
                    const capacity = parseFloat(pkg.capacity_value) || 1000;
                    const pkgCount = Math.ceil(saleQty / capacity);

                    if (pkgCount > 0) {
                        await supabase.from('ibc_movements').insert({
                            user_id: currentOwnerId,
                            customer_id: parseInt(form.customerId),
                            sale_id: id,
                            type: 'Sent',
                            quantity: pkgCount,
                            notes: `Satış Güncelleme (Lot: ${prod?.lot_number || '?'})`
                        });
                    }
                }
            }

            loadAllData();
            return true;
        } catch (error) {
            console.error('Satış güncelleme hatası:', error);
            alert('Hata: ' + error.message);
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
            // Only alert if critical_stock is defined and greater than 0, and current stock is below it
            return i.critical_stock > 0 && stock < i.critical_stock;
        });

        return (
            <div className="space-y-6">
                {/* Low Stock Alert - INDUSTRIAL */}
                {lowStockItems.length > 0 && (
                    <div className="bg-orange-50 border border-orange-200 p-4 rounded-[4px] flex items-start gap-4">
                        <AlertTriangle className="h-5 w-5 text-orange-600" />
                        <div>
                            <h3 className="font-semibold text-orange-900 text-sm uppercase tracking-wide">TEDARİK ZİNCİRİ UYARISI</h3>
                            <p className="text-sm text-orange-800 mt-1">
                                Kritik stok seviyeleri tespit edildi:
                            </p>
                            <div className="mt-2 flex flex-wrap gap-2">
                                {lowStockItems.map(i => (
                                    <span key={i.id} className="bg-orange-100 text-orange-800 text-xs px-2 py-1 border border-orange-200 font-mono">
                                        {i.name} [{getItemStock(i.id).toFixed(2)} {i.unit}]
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-between items-center pb-4 border-b border-gray-200">
                    <div className="flex items-center gap-6">
                        <div>
                            <h2 className="heading-industrial text-2xl uppercase tracking-tight">GENEL GÖRÜNÜM</h2>
                            <span className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">ENDÜSTRİYEL KONTROL MERKEZİ</span>
                        </div>

                        {/* Instant Rates Badges */}
                        <div className="hidden md:flex items-center gap-3">
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-sm">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">USD/TRY</span>
                                <span className="text-sm font-mono font-bold text-indigo-600">{rates.TRY.toFixed(2)}</span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-sm">
                                <span className="text-[10px] font-bold text-slate-500 uppercase">EUR/TRY</span>
                                <span className="text-sm font-mono font-bold text-indigo-600">{((1 / rates.EUR) * rates.TRY).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <CurrencySelector value={baseCurrency} onChange={setBaseCurrency} className="input-industrial" />
                    </div>
                </div>

                {/* Exchange Rates Card - INDUSTRIAL STYLE */}
                <div className="card-industrial p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div>
                            <h3 className="heading-industrial flex items-center gap-2 text-lg">
                                <DollarSign className="h-5 w-5 text-[#0071e3]" /> FİNANSAL KURLAR
                            </h3>
                            <p className="text-gray-500 text-xs mt-1 font-mono uppercase">
                                {ratesLastUpdate ? `SON GÜNCELLEME: ${ratesLastUpdate.toLocaleString('tr-TR')}` : 'EŞİTLENİYOR...'}
                            </p>
                        </div>
                        <div className="flex items-center gap-4">
                            <label className="flex items-center gap-2 text-sm text-gray-700 font-medium">
                                <input
                                    type="checkbox"
                                    checked={useManualRates}
                                    onChange={e => setUseManualRates(e.target.checked)}
                                    className="rounded border-gray-300 text-[#0071e3] focus:ring-[#0071e3]"
                                />
                                MANUEL KURLAR
                            </label>
                            <button
                                onClick={fetchExchangeRates}
                                disabled={ratesLoading}
                                className="btn-secondary py-1 px-3"
                                title="Kurları Güncelle"
                            >
                                <RefreshCw className={'h-4 w-4 ' + (ratesLoading ? 'animate-spin' : '')} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-gray-50 border border-gray-100 p-4 rounded-sm">
                            <div className="label-industrial text-indigo-600">USD / TRY (1 $)</div>
                            {useManualRates ? (
                                <input
                                    type="number"
                                    step="0.01"
                                    value={manualRates.usd_try}
                                    onChange={e => setManualRates({ ...manualRates, usd_try: e.target.value })}
                                    placeholder={exchangeRates.TRY.toFixed(2)}
                                    className="input-industrial font-mono text-lg text-indigo-700 font-bold"
                                />
                            ) : (
                                <div className="text-2xl font-semibold text-gray-900 tracking-tight">{rates.TRY.toFixed(4)}</div>
                            )}
                        </div>
                        <div className="bg-gray-50 border border-gray-100 p-4 rounded-sm">
                            <div className="label-industrial text-indigo-600">EUR / TRY (1 €)</div>
                            {useManualRates ? (
                                <input
                                    type="number"
                                    step="0.01"
                                    value={manualRates.eur_try}
                                    onChange={e => setManualRates({ ...manualRates, eur_try: e.target.value })}
                                    placeholder={((1 / exchangeRates.EUR) * exchangeRates.TRY).toFixed(2)}
                                    className="input-industrial font-mono text-lg text-indigo-700 font-bold"
                                />
                            ) : (
                                <div className="text-2xl font-semibold text-gray-900 tracking-tight">
                                    {((1 / rates.EUR) * rates.TRY).toFixed(4)}
                                </div>
                            )}
                        </div>
                        <div className="bg-gray-50 border border-gray-100 p-4 rounded-sm">
                            <div className="label-industrial">BAZ GÖRÜNÜM PARA BİRİMİ</div>
                            <div className="text-2xl font-semibold text-[#0071e3] tracking-tight">{baseCurrency}</div>
                        </div>
                    </div>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="card-industrial p-5 flex items-center gap-4">
                        <div className="bg-[#e8f2ff] p-3 rounded-[4px] border border-[#d0e6ff]">
                            <ShoppingBag className="h-6 w-6 text-[#0071e3]" />
                        </div>
                        <div>
                            <div className="label-industrial">TOPLAM SATINALMA</div>
                            <div className="heading-industrial text-xl">{formatMoney(totalPurchases, baseCurrency)}</div>
                            <div className="text-xs text-[#86868b] font-mono mt-1">{purchases.length} KAYIT</div>
                        </div>
                    </div>

                    <div className="card-industrial p-5 flex items-center gap-4">
                        <div className="bg-[#eafaef] p-3 rounded-[4px] border border-[#cff7d9]">
                            <TrendingUp className="h-6 w-6 text-[#107c10]" />
                        </div>
                        <div>
                            <div className="label-industrial">TOPLAM SATIŞ</div>
                            <div className="heading-industrial text-xl">{formatMoney(totalSales, baseCurrency)}</div>
                            <div className="text-xs text-[#86868b] font-mono mt-1">{sales.length} KAYIT</div>
                        </div>
                    </div>

                    <div className="card-industrial p-5 flex items-center gap-4">
                        <div className="bg-[#f5f5f7] p-3 rounded-[4px] border border-[#d2d2d7]">
                            <Factory className="h-6 w-6 text-[#86868b]" />
                        </div>
                        <div>
                            <div className="label-industrial">ÜRETİM DEĞERİ</div>
                            <div className="heading-industrial text-xl">{formatMoney(totalProduction, baseCurrency)}</div>
                            <div className="text-xs text-[#86868b] font-mono mt-1">{productions.length} PARTİ</div>
                        </div>
                    </div>

                    <div className="card-industrial p-5 flex items-center gap-4">
                        <div className="bg-[#fffbe6] p-3 rounded-[4px] border border-[#fff1b8]">
                            <Briefcase className="h-6 w-6 text-[#e67e22]" />
                        </div>
                        <div>
                            <div className="label-industrial">CARİ HESAPLAR</div>
                            <div className="heading-industrial text-xl">{accounts.length}</div>
                            <div className="text-xs text-[#86868b] font-mono mt-1">{accounts.filter(a => a.type === 'Müşteri' || a.type === 'Her İkisi').length} MÜŞTERİ</div>
                        </div>
                    </div>
                </div>

                {/* Stock Summary - INDUSTRIAL */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
                    <div className="card-industrial p-5">
                        <h3 className="heading-industrial text-sm flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                            <Package className="h-4 w-4 text-[#0071e3]" /> HAMMADDELER
                        </h3>
                        <div className="space-y-2">
                            {rawMaterials.slice(0, 5).map(item => {
                                const stock = getItemStock(item.id);
                                return (
                                    <div key={item.id} className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600">{item.name}</span>
                                        <span className="font-mono font-medium text-gray-900">{stock.toFixed(2)} {item.unit}</span>
                                    </div>
                                );
                            })}
                            {rawMaterials.length === 0 && <p className="text-gray-400 text-xs italic">Hammadde bulunamadı.</p>}
                        </div>
                    </div>

                    <div className="card-industrial p-5">
                        <h3 className="heading-industrial text-sm flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                            <Package className="h-4 w-4 text-[#107c10]" /> MAMULLER
                        </h3>
                        <div className="space-y-2">
                            {products.slice(0, 5).map(item => {
                                const stock = getItemStock(item.id);
                                return (
                                    <div key={item.id} className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600">{item.name}</span>
                                        <span className="font-mono font-medium text-gray-900">{stock.toFixed(2)} {item.unit}</span>
                                    </div>
                                );
                            })}
                            {products.length === 0 && <p className="text-gray-400 text-xs italic">Mamul bulunamadı.</p>}
                        </div>
                    </div>

                    <div className="card-industrial p-5">
                        <h3 className="heading-industrial text-sm flex items-center gap-2 mb-4 border-b border-gray-100 pb-2">
                            <Package className="h-4 w-4 text-[#86868b]" /> AMBALAJ
                        </h3>
                        <div className="space-y-2">
                            {packaging.slice(0, 5).map(item => {
                                const stock = getItemStock(item.id);
                                return (
                                    <div key={item.id} className="flex justify-between items-center text-sm">
                                        <span className="text-gray-600">{item.name}</span>
                                        <span className="font-mono font-medium text-gray-900">{stock.toFixed(0)} adet</span>
                                    </div>
                                );
                            })}
                            {packaging.length === 0 && <p className="text-gray-400 text-xs italic">Ambalaj bulunamadı.</p>}
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // ==================== LOADING & AUTH ====================
    if (loading) {
        return (
            <div className="min-h-screen bg-[#1d1d1f] flex items-center justify-center">
                <div className="text-center">
                    <FlaskConical className="h-16 w-16 text-[#0071e3] mx-auto mb-4 animate-pulse" />
                    <div className="text-white text-xl">Yükleniyor...</div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-white flex flex-col md:flex-row h-screen overflow-hidden text-slate-900">
            {/* Mobile Header */}
            <div className="md:hidden bg-[#0a0a0c] text-white p-4 flex justify-between items-center shrink-0 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-indigo-600/20 flex items-center justify-center border border-indigo-500/30">
                        <FlaskConical className="h-4 w-4 text-indigo-400" />
                    </div>
                    <span className="font-bold text-lg tracking-tight">GROHN <span className="text-indigo-400 font-light text-sm ml-1">ERP</span></span>
                </div>
                <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-zinc-500 hover:text-white transition-colors">
                    {isMobileMenuOpen ? <X /> : <Menu />}
                </button>
            </div>

            {/* Sidebar */}
            <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#0a0a0c] text-white flex flex-col transition-transform duration-300 md:relative md:translate-x-0 border-r border-white/5 shadow-2xl ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                <div className="p-6 flex-1 overflow-y-auto no-scrollbar">
                    {/* Premium Branding Logo */}
                    {/* Simple Premium Logo */}
                    <div className="mb-14 px-4 group cursor-default">
                        <h1 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-br from-white via-white to-zinc-600 transition-all duration-500 group-hover:tracking-normal">
                            GROHN
                        </h1>
                        <div className="h-1 w-12 bg-indigo-600 mt-2 rounded-full transition-all duration-500 group-hover:w-20"></div>
                    </div>

                    <div className="space-y-8">
                        {/* Main Section */}
                        <div className="space-y-1.5">
                            <SidebarItem
                                active={activeTab === 'dashboard'}
                                onClick={() => { setActiveTab('dashboard'); setIsMobileMenuOpen(false); }}
                                icon={<LayoutDashboard className="h-4 w-4" />}
                                label="Genel Görünüm"
                            />
                            <SidebarItem
                                active={activeTab === 'commercial_management'}
                                onClick={() => { setActiveTab('commercial_management'); setIsMobileMenuOpen(false); }}
                                icon={<ShoppingBag className="h-4 w-4" />}
                                label="Satın Alma"
                            />
                            <SidebarItem
                                active={activeTab === 'recipes'}
                                onClick={() => { setActiveTab('recipes'); setIsMobileMenuOpen(false); }}
                                icon={<FileText className="h-4 w-4" />}
                                label="Reçeteler"
                            />
                            <SidebarItem
                                active={activeTab === 'production'}
                                onClick={() => { setActiveTab('production'); setIsMobileMenuOpen(false); }}
                                icon={<Factory className="h-4 w-4" />}
                                label="Üretim Yönetimi"
                            />
                            <SidebarItem
                                active={activeTab === 'quality_control'}
                                onClick={() => { setActiveTab('quality_control'); setIsMobileMenuOpen(false); }}
                                icon={<ShieldCheck className="h-4 w-4" />}
                                label="Kalite Kontrol"
                            />
                            <SidebarItem
                                active={activeTab === 'marketing'}
                                onClick={() => { setActiveTab('marketing'); setIsMobileMenuOpen(false); }}
                                icon={<Users className="h-4 w-4" />}
                                label="Pazarlama & CRM"
                            />
                            <SidebarItem
                                active={activeTab === 'sales_manager'}
                                onClick={() => { setActiveTab('sales_manager'); setIsMobileMenuOpen(false); }}
                                icon={<ShoppingCart className="h-4 w-4" />}
                                label="Satış"
                            />
                            <SidebarItem
                                active={activeTab === 'inventory_management'}
                                onClick={() => { setActiveTab('inventory_management'); setIsMobileMenuOpen(false); }}
                                icon={<Package className="h-4 w-4" />}
                                label="Stok Yönetimi"
                            />
                            {canViewFinancials && (
                                <SidebarItem
                                    active={activeTab === 'financials'}
                                    onClick={() => { setActiveTab('financials'); setIsMobileMenuOpen(false); }}
                                    icon={<TrendingUp className="h-4 w-4" />}
                                    label="Raporlar"
                                />
                            )}
                        </div>

                        {/* Administration Section */}
                        {userRole === 'admin' && (
                            <div className="space-y-1.5">
                                <SidebarItem
                                    active={activeTab === 'settings'}
                                    onClick={() => { setActiveTab('settings'); setIsMobileMenuOpen(false); }}
                                    icon={<Settings className="h-4 w-4" />}
                                    label="Genel Ayarlar"
                                />
                            </div>
                        )}

                        {/* Universal Logout Button */}
                        <div className="pt-4 mt-auto border-t border-white/10">
                            <button
                                onClick={handleSignOut}
                                className="w-full group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 text-sm text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            >
                                <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                                <span className="font-medium">Güvenli Çıkış</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sidebar Footer with Gradient Mask */}
                <div className="p-6 border-t border-white/5 bg-gradient-to-b from-[#0a0a0c] to-[#050505]">
                    <div className="text-[10px] text-center text-zinc-600 font-medium tracking-tight">
                        &copy; 2025 Grohn Teknoloji Ekosistemi
                    </div>
                </div>
            </div >


            {/* Overlay for mobile */}
            {
                isMobileMenuOpen && (
                    <div
                        className="fixed inset-0 bg-black/50 z-40 md:hidden"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                )
            }

            {/* Main Content */}
            <div className="flex-1 overflow-auto w-full relative">
                <div className="p-4 md:p-8">
                    {activeTab === 'dashboard' && <Dashboard />}
                    {activeTab === 'commercial_management' && <CommercialManagementModule
                        purchases={purchases}
                        inventory={inventory}
                        accounts={accounts}
                        onPurchase={handlePurchase}
                        onDeletePurchase={handleDeletePurchase}
                        onUpdatePurchase={handleUpdatePurchase}
                        onAddAccount={handleAddAccount}
                        onDeleteAccount={handleDeleteAccount}
                        sales={sales}
                    />}
                    {activeTab === 'sales_manager' && <SalesManagerModule
                        sales={sales}
                        inventory={inventory}
                        accounts={accounts}
                        productions={productions}
                        recipes={recipes}
                        globalSettings={globalSettings}
                        onSale={handleSale}
                        onDeleteSale={handleDeleteSale}
                        onUpdateSale={handleUpdateSale}
                        exchangeRates={getActiveRates()}
                        onRefresh={loadAllData}
                    />}
                    {activeTab === 'recipes' && <RecipesModule
                        recipes={recipes}
                        inventory={inventory}
                        customers={accounts.filter(a => a.type === 'Müşteri' || a.type === 'Her İkisi')}
                        globalSettings={globalSettings}
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
                        globalSettings={globalSettings}
                        customers={accounts.filter(a => a.type === 'Müşteri' || a.type === 'Her İkisi')}
                        onPlan={handlePlanProduction}
                        onComplete={handleCompleteProduction}
                        onDelete={handleDeleteProduction}
                    />}
                    {activeTab === 'inventory_management' && (
                        <InventoryManagementModule
                            inventory={inventory}
                            onRefresh={loadAllData}
                            onReconcile={handleStockReconciliation}
                            onDeleteMovement={handleDeleteStockMovement}
                            getItemStock={getItemStock}
                            accounts={accounts}
                            ibcMovements={ibcMovements}
                            onIbcReturn={handleIbcReturn}
                            onDeleteIbcMovement={handleDeleteIbcMovement}
                            globalSettings={globalSettings}
                        />
                    )}
                    {activeTab === 'quality_control' && <QualityControlModule inventory={inventory} globalSettings={globalSettings} onRefresh={loadAllData} />}
                    {activeTab === 'marketing' && <MarketingModule
                        inventory={inventory}
                        accounts={accounts}
                        onRefresh={loadAllData}
                        currentOwnerId={currentOwnerId}
                        userRole={userRole}
                        user={user}
                    />}
                    {activeTab === 'financials' && canViewFinancials && <FinancialReportsModule
                        sales={sales}
                        productions={productions}
                        purchases={purchases}
                        inventory={inventory}
                        accounts={accounts}
                        exchangeRates={getActiveRates()}
                    />}
                    {activeTab === 'settings' && userRole === 'admin' && <SettingsModule
                        globalSettings={globalSettings}
                        onSaveSetting={saveSetting}
                        currentUser={user}
                        onSignOut={handleSignOut}
                        userRole={userRole}
                    />}
                </div>
            </div>
        </div >
    );
}

