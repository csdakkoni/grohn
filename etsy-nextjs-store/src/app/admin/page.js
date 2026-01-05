"use client";
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import {
    LayoutDashboard,
    ShoppingBag,
    Package,
    TrendingUp,
    AlertCircle,
    DollarSign,
    CheckCircle,
    PlusCircle,
    Search,
    Edit,
    Trash2,
    Check,
    Upload,
    Image as ImageIcon,
    Film
} from 'lucide-react';
import Link from 'next/link';

export default function UnifiedAdminCenter() {
    const [activeTab, setActiveTab] = useState('dashboard');
    const [loading, setLoading] = useState(true);

    // Overview/Stats Data
    const [metrics, setMetrics] = useState({ revenue: 0, orders: 0, avgValue: 0 });
    const [dailySales, setDailySales] = useState([]);
    const [lowStock, setLowStock] = useState([]);
    const [bestSellers, setBestSellers] = useState([]);

    // Listings Data
    const [products, setProducts] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        price: '',
        stock_quantity: '',
        category: '',
        all_images: [], // Unified gallery
        video_url: '',
        material: '',
        care_instructions: '',
        size_guide: ''
    });

    const [editingId, setEditingId] = useState(null);

    // Marketing Data
    const [coupons, setCoupons] = useState([]);

    // Orders Data
    const [orders, setOrders] = useState([]);
    const [selectedOrder, setSelectedOrder] = useState(null);
    const [fulfillmentData, setFulfillmentData] = useState({
        tracking_number: '',
        carrier: '',
        fulfillment_status: 'pending'
    });

    // Inbox Data
    const [messages, setMessages] = useState([]);

    // Settings Data
    const [settings, setSettings] = useState({
        announcement_bar: { text: '', is_active: true, bg_color: '#000000' }
    });

    // Journal Data
    const [posts, setPosts] = useState([]);

    // Loyalty Data
    const [loyaltyTiers, setLoyaltyTiers] = useState([]);

    // Category Data
    const [categories, setCategories] = useState([]);
    const [newCategory, setNewCategory] = useState({ name: '', slug: '' });

    const [statusAction, setStatusAction] = useState('');

    useEffect(() => {
        fetchAllData();
    }, []);

    const [uploading, setUploading] = useState(false);

    async function uploadMedia(file, type = 'image') {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
        const filePath = `${type}s/${fileName}`;

        const { error: uploadError, data } = await supabase.storage
            .from('artisan-media')
            .upload(filePath, file);

        if (uploadError) {
            throw uploadError;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('artisan-media')
            .getPublicUrl(filePath);

        return publicUrl;
    }

    async function fetchAllData() {
        setLoading(true);
        try {
            // 1. Sales Metrics
            const { data: mData } = await supabase.from('view_sales_metrics').select('*').single();
            if (mData) setMetrics({
                revenue: mData.total_revenue || 0,
                orders: mData.total_orders || 0,
                avgValue: mData.avg_order_value || 0
            });

            // 2. Daily Trends
            const { data: tData } = await supabase.from('view_daily_sales').select('*').order('sale_date', { ascending: true });
            if (tData) setDailySales(tData || []);

            // 3. Inventory Alerts
            const { data: iData } = await supabase.from('view_inventory_health').select('*').eq('health_status', 'Low Stock').limit(5);
            if (iData) setLowStock(iData || []);

            // 4. Best Sellers
            const { data: bData } = await supabase.from('view_best_sellers').select('*').limit(5);
            if (bData) setBestSellers(bData || []);

            // 5. All Products
            const { data: pData } = await supabase.from('store_products').select('*').order('created_at', { ascending: false });
            if (pData) setProducts(pData || []);

            // 6. All Orders
            const { data: oData } = await supabase.from('store_orders').select('*').order('created_at', { ascending: false });
            if (oData) setOrders(oData || []);

            // 7. Coupons
            const { data: cData } = await supabase.from('store_coupons').select('*').order('created_at', { ascending: false });
            if (cData) setCoupons(cData || []);

            // 8. Messages
            const { data: msgData } = await supabase.from('store_messages').select('*').order('created_at', { ascending: false });
            if (msgData) setMessages(msgData || []);

            // 9. Settings
            const { data: sData } = await supabase.from('store_settings').select('*');
            if (sData) {
                const config = {};
                sData.forEach(s => config[s.key] = s.value);
                setSettings(prev => ({ ...prev, ...config }));
            }

            // 10. Journal Posts
            const { data: jData } = await supabase.from('store_journal_posts').select('*').order('created_at', { ascending: false });
            if (jData) setPosts(jData || []);

            // 11. Loyalty Tiers
            const { data: ltData } = await supabase.from('store_loyalty_config').select('*').order('min_points', { ascending: true });
            if (ltData) setLoyaltyTiers(ltData || []);

            // 12. Dynamic Categories
            const { data: catData } = await supabase.from('store_categories').select('*').order('display_order', { ascending: true });
            if (catData) setCategories(catData || []);

        } catch (error) {
            console.error('Error loading admin data:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleAddProduct = async (e) => {
        e.preventDefault();
        setStatusAction('Saving...');
        const slug = formData.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

        // Automatically set first image as main cover
        const main_image_url = formData.all_images?.[0] || '';

        let query;
        if (editingId) {
            query = supabase
                .from('store_products')
                .update({
                    ...formData,
                    main_image_url,
                    price: parseFloat(formData.price),
                    stock_quantity: parseInt(formData.stock_quantity),
                    slug,
                    is_active: true
                })
                .eq('id', editingId);
        } else {
            query = supabase
                .from('store_products')
                .insert([{
                    ...formData,
                    main_image_url,
                    price: parseFloat(formData.price),
                    stock_quantity: parseInt(formData.stock_quantity),
                    slug,
                    is_active: true
                }]);
        }

        const { error } = await query;

        if (error) {
            setStatusAction(`Error: ${error.message}`);
        } else {
            setStatusAction(editingId ? '✅ Updated!' : '✅ Published!');
            setShowAddForm(false);
            setEditingId(null);
            setFormData({ title: '', description: '', price: '', stock_quantity: '', category: '', all_images: [], video_url: '', material: '', care_instructions: '', size_guide: '' });
            fetchAllData();
        }
    };

    const handleEditProduct = (product) => {
        setEditingId(product.id);
        setFormData({
            title: product.title || '',
            description: product.description || '',
            price: product.price || '',
            stock_quantity: product.stock_quantity || '',
            category: product.category || '',
            all_images: product.all_images || [],
            video_url: product.video_url || '',
            material: product.material || '',
            care_instructions: product.care_instructions || '',
            size_guide: product.size_guide || ''
        });
        setShowAddForm(true);
    };

    const handleDeleteProduct = async (id) => {
        if (!confirm('Are you sure you want to delete this artisan piece? This cannot be undone.')) return;

        const { error } = await supabase
            .from('store_products')
            .delete()
            .eq('id', id);

        if (error) {
            alert(`Error: ${error.message}`);
        } else {
            fetchAllData();
        }
    };

    const handleAddCategory = async (e) => {
        e.preventDefault();
        const slug = newCategory.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
        const { error } = await supabase.from('store_categories').insert([{ name: newCategory.name, slug }]);
        if (error) alert(error.message);
        else {
            setNewCategory({ name: '', slug: '' });
            fetchAllData();
        }
    };

    const handleDeleteCategory = async (id) => {
        if (!confirm('Are you sure? This will not delete products in this category, but they will become uncategorized.')) return;
        const { error } = await supabase.from('store_categories').delete().eq('id', id);
        if (error) alert(error.message);
        else fetchAllData();
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-screen font-heading text-muted uppercase tracking-widest text-xs">
            Preparing your workspace...
        </div>
    );

    return (
        <div className="flex min-h-screen bg-soft">
            {/* SIDEBAR */}
            <aside className="w-64 bg-white border-r border-light p-6 sticky top-0 h-screen flex flex-col">
                <div className="font-heading font-bold text-2xl mb-12 tracking-tighter">AGORALOOM <span className="text-[10px] font-bold text-accent block tracking-widest uppercase">Admin Center</span></div>

                <nav className="flex flex-col gap-1 flex-1">
                    <button
                        onClick={() => setActiveTab('dashboard')}
                        className={`admin-nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                    >
                        <LayoutDashboard size={14} /> Dashboard
                    </button>

                    <div className="text-[10px] font-bold text-muted uppercase tracking-widest mt-8 mb-3 px-3">Inventory</div>
                    <button
                        onClick={() => setActiveTab('listings')}
                        className={`admin-nav-item ${activeTab === 'listings' ? 'active' : ''}`}
                    >
                        <Package size={14} /> Listings
                    </button>
                    <button
                        onClick={() => setActiveTab('categories')}
                        className={`admin-nav-item ${activeTab === 'categories' ? 'active' : ''}`}
                    >
                        <LayoutDashboard size={14} /> Taxonomy
                    </button>
                    <button
                        onClick={() => setActiveTab('orders')}
                        className={`admin-nav-item ${activeTab === 'orders' ? 'active' : ''}`}
                    >
                        <ShoppingBag size={14} /> Orders
                    </button>

                    <div className="text-[10px] font-bold text-muted uppercase tracking-widest mt-8 mb-3 px-3">Growth</div>
                    <button
                        onClick={() => setActiveTab('stats')}
                        className={`admin-nav-item ${activeTab === 'stats' ? 'active' : ''}`}
                    >
                        <TrendingUp size={14} /> Stats
                    </button>
                    <button
                        onClick={() => setActiveTab('marketing')}
                        className={`admin-nav-item ${activeTab === 'marketing' ? 'active' : ''}`}
                    >
                        <PlusCircle size={14} /> Marketing
                    </button>
                    <button
                        onClick={() => setActiveTab('inbox')}
                        className={`admin-nav-item ${activeTab === 'inbox' ? 'active' : ''}`}
                    >
                        <Search size={14} /> Inbox
                        {messages.filter(m => !m.is_read).length > 0 && (
                            <span className="ml-auto bg-accent text-white text-[8px] px-1.5 py-0.5 rounded-full">
                                {messages.filter(m => !m.is_read).length}
                            </span>
                        )}
                    </button>
                    <button
                        onClick={() => setActiveTab('journal')}
                        className={`admin-nav-item ${activeTab === 'journal' ? 'active' : ''}`}
                    >
                        <Edit size={14} /> Journal
                    </button>
                    <button
                        onClick={() => setActiveTab('finances')}
                        className={`admin-nav-item ${activeTab === 'finances' ? 'active' : ''}`}
                    >
                        <DollarSign size={14} /> Finances
                    </button>

                    <button
                        onClick={() => setActiveTab('settings')}
                        className={`admin-nav-item mt-4 ${activeTab === 'settings' ? 'active' : ''}`}
                    >
                        <CheckCircle size={14} /> Settings
                    </button>
                </nav>

                <div className="mt-auto border-t border-light pt-6">
                    <Link href="/" className="text-[10px] font-bold uppercase tracking-widest text-accent hover:opacity-70">← Back to Store</Link>
                </div>
            </aside>

            {/* MAIN CONTENT */}
            <main className="flex-1 p-10 max-w-7xl">
                <header className="flex justify-between items-center mb-12">
                    <div>
                        <h1 className="text-4xl font-heading mb-2 capitalize">{activeTab}</h1>
                        <p className="text-muted text-sm italic">Crafting your artisan business into a legacy.</p>
                    </div>
                    {activeTab === 'listings' && (
                        <button
                            onClick={() => {
                                if (showAddForm) {
                                    setEditingId(null);
                                    setFormData({ title: '', description: '', price: '', stock_quantity: '', category: '', all_images: [], video_url: '', material: '', care_instructions: '', size_guide: '' });
                                }
                                setShowAddForm(!showAddForm);
                            }}
                            className="btn-primary flex items-center gap-2"
                        >
                            <PlusCircle size={16} /> {showAddForm ? 'Cancel' : 'Add Listing'}
                        </button>
                    )}
                </header>

                {/* TAB CONTENT: DASHBOARD */}
                {activeTab === 'dashboard' && (
                    <div className="animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
                            <div className="bg-white p-8 border border-light shadow-sm">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-muted block mb-4">Revenue (USD)</span>
                                <div className="text-3xl font-heading font-bold">${metrics.revenue.toLocaleString()}</div>
                            </div>
                            <div className="bg-white p-8 border border-light shadow-sm">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-muted block mb-4">Total Orders</span>
                                <div className="text-3xl font-heading font-bold">{metrics.orders}</div>
                            </div>
                            <div className="bg-white p-8 border border-light shadow-sm">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-muted block mb-4">Avg Order Value</span>
                                <div className="text-3xl font-heading font-bold">${metrics.avgValue.toFixed(2)}</div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                            <div className="bg-white border border-light shadow-sm">
                                <div className="p-6 border-b border-light font-heading font-bold uppercase tracking-tight">Top Sellers</div>
                                <div className="p-0">
                                    <table className="w-full text-left text-xs">
                                        <tbody className="divide-y divide-light">
                                            {bestSellers.map((item, idx) => (
                                                <tr key={idx} className="hover:bg-soft transition-colors">
                                                    <td className="p-4 font-medium">{item.title}</td>
                                                    <td className="p-4 text-muted">{item.total_sold} units</td>
                                                    <td className="p-4 font-bold text-accent">${item.revenue_generated.toFixed(2)}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>

                            <div className="bg-white border border-light shadow-sm">
                                <div className="p-6 border-b border-light font-heading font-bold uppercase tracking-tight text-red-600">Restock Alerts</div>
                                <div className="p-6 space-y-4">
                                    {lowStock.map((item, idx) => (
                                        <div key={idx} className="flex justify-between items-center p-3 bg-red-50 border border-red-100">
                                            <span className="text-xs font-bold">{item.title}</span>
                                            <span className="text-[10px] font-bold text-red-700">{item.stock_quantity} Left</span>
                                        </div>
                                    ))}
                                    {lowStock.length === 0 && <p className="text-xs italic text-muted text-center py-8">All levels are healthy.</p>}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB CONTENT: LISTINGS */}
                {activeTab === 'listings' && (
                    <div className="animate-fade-in">
                        {showAddForm ? (
                            <div className="bg-white p-10 border border-light shadow-sm max-w-3xl mx-auto">
                                <h2 className="text-2xl font-heading mb-8">Etsy Listing Studio</h2>
                                <form onSubmit={handleAddProduct} className="space-y-6">
                                    <div className="grid grid-cols-2 gap-6">
                                        <div className="col-span-1">
                                            <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 text-muted">Title</label>
                                            <input type="text" required className="admin-input" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} />
                                        </div>
                                        <div className="col-span-1">
                                            <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 text-muted">Category</label>
                                            <select
                                                className="admin-input"
                                                value={formData.category}
                                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                                required
                                            >
                                                <option value="">Select Category</option>
                                                {categories.map((cat) => (
                                                    <option key={cat.id} value={cat.name}>{cat.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 text-muted">Price ($)</label>
                                            <input type="number" step="0.01" required className="admin-input" value={formData.price} onChange={(e) => setFormData({ ...formData, price: e.target.value })} />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 text-muted">Stock</label>
                                            <input type="number" required className="admin-input" value={formData.stock_quantity} onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })} />
                                        </div>
                                        <div className="col-span-2 p-8 bg-sand border border-light mt-4">
                                            <div className="flex justify-between items-center mb-10 pb-6 border-b border-light/50">
                                                <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] text-accent flex items-center gap-2">
                                                    <ImageIcon size={14} /> Artisan Gallery & Portfolio
                                                </h3>
                                                <div className="flex gap-4">
                                                    <label className="cursor-pointer btn-primary py-2 px-6 text-[10px] flex items-center gap-2">
                                                        <PlusCircle size={14} /> Add Media
                                                        <input type="file" multiple className="hidden" accept="image/*" onChange={async (e) => {
                                                            const files = Array.from(e.target.files);
                                                            if (files.length > 0) {
                                                                setUploading(true);
                                                                try {
                                                                    const uploadPromises = files.map(file => uploadMedia(file, 'gallery'));
                                                                    const urls = await Promise.all(uploadPromises);
                                                                    setFormData({ ...formData, all_images: [...formData.all_images, ...urls] });
                                                                } catch (err) { alert(err.message); }
                                                                setUploading(false);
                                                            }
                                                        }} />
                                                    </label>
                                                    <label className="cursor-pointer btn-primary bg-main text-white py-2 px-6 text-[10px] flex items-center gap-2">
                                                        <Film size={14} /> Link Video
                                                        <input type="file" className="hidden" accept="video/*" onChange={async (e) => {
                                                            const file = e.target.files[0];
                                                            if (file) {
                                                                setUploading(true);
                                                                try {
                                                                    const url = await uploadMedia(file, 'video');
                                                                    setFormData({ ...formData, video_url: url });
                                                                } catch (err) { alert(err.message); }
                                                                setUploading(false);
                                                            }
                                                        }} />
                                                    </label>
                                                </div>
                                            </div>

                                            <div className="space-y-10">
                                                {/* Video Atmosphere Row */}
                                                {formData.video_url && (
                                                    <div className="relative group aspect-video bg-black/90 border border-light overflow-hidden flex items-center justify-center">
                                                        <Film size={32} className="text-white opacity-20" />
                                                        <p className="text-[9px] uppercase tracking-widest text-white/50 absolute bottom-6">Cinematic Atmosphere Connected</p>
                                                        <button
                                                            onClick={(e) => { e.preventDefault(); setFormData({ ...formData, video_url: '' }) }}
                                                            className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 text-white transition-colors"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                )}

                                                {/* Photo Reordering & Layout */}
                                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-6">
                                                    {formData.all_images.map((img, idx) => (
                                                        <div key={idx} className={`relative aspect-square border ${idx === 0 ? 'border-accent border-2 ring-4 ring-accent/5' : 'border-light'} bg-white group transition-all`}>
                                                            <img src={img} className="w-full h-full object-cover" alt="" />

                                                            {idx === 0 && (
                                                                <span className="absolute top-0 left-0 bg-accent text-white text-[8px] font-bold px-2 py-0.5 uppercase tracking-widest">Cover Photo</span>
                                                            )}

                                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                                                {idx > 0 && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            const arr = [...formData.all_images];
                                                                            [arr[idx], arr[idx - 1]] = [arr[idx - 1], arr[idx]];
                                                                            setFormData({ ...formData, all_images: arr });
                                                                        }}
                                                                        className="p-1.5 bg-white text-main hover:text-accent"
                                                                        title="Move Earlier"
                                                                    >
                                                                        ←
                                                                    </button>
                                                                )}
                                                                {idx < formData.all_images.length - 1 && (
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.preventDefault();
                                                                            const arr = [...formData.all_images];
                                                                            [arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]];
                                                                            setFormData({ ...formData, all_images: arr });
                                                                        }}
                                                                        className="p-1.5 bg-white text-main hover:text-accent"
                                                                        title="Move Later"
                                                                    >
                                                                        →
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.preventDefault();
                                                                        const newImages = formData.all_images.filter((_, i) => i !== idx);
                                                                        setFormData({ ...formData, all_images: newImages });
                                                                    }}
                                                                    className="p-1.5 bg-red-600 text-white"
                                                                >
                                                                    <Trash2 size={12} />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}

                                                    {formData.all_images.length === 0 && (
                                                        <div className="col-span-full py-16 text-center border-2 border-dashed border-light bg-white/50">
                                                            <ImageIcon size={32} className="mx-auto mb-4 text-light" />
                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-muted italic">The gallery is empty. Start adding artisan media.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {uploading && <div className="mt-8 text-[10px] text-accent font-bold animate-pulse text-center">STORAGE SYNC IN PROGRESS...</div>}
                                        </div>

                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 text-muted">Description</label>
                                            <textarea rows={4} className="admin-input" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} />
                                        </div>
                                        <div className="col-span-2 grid grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 text-muted">Material</label>
                                                <input type="text" className="admin-input" value={formData.material} onChange={(e) => setFormData({ ...formData, material: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 text-muted">Care</label>
                                                <input type="text" className="admin-input" value={formData.care_instructions} onChange={(e) => setFormData({ ...formData, care_instructions: e.target.value })} />
                                            </div>
                                            <div>
                                                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 text-muted">Size Guide</label>
                                                <input type="text" className="admin-input" value={formData.size_guide} onChange={(e) => setFormData({ ...formData, size_guide: e.target.value })} />
                                            </div>
                                        </div>
                                    </div>
                                    <button type="submit" className="btn-primary w-full py-4 uppercase font-bold tracking-widest">
                                        {editingId ? 'Update Listing' : 'Publish Listing'}
                                    </button>
                                    {statusAction && <p className="text-center text-xs font-bold text-accent">{statusAction}</p>}
                                </form>
                            </div>
                        ) : (
                            <div className="bg-white border border-light shadow-sm">
                                <table className="w-full text-left text-sm font-light">
                                    <thead className="bg-soft text-[10px] uppercase tracking-[0.2em] font-bold text-muted border-b border-light">
                                        <tr>
                                            <th className="p-4">Piece</th>
                                            <th className="p-4">Category</th>
                                            <th className="p-4">Price</th>
                                            <th className="p-4">Stock</th>
                                            <th className="p-4">Status</th>
                                            <th className="p-4 text-right">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-soft">
                                        {products.map((p) => (
                                            <tr key={p.id} className="hover:bg-soft/50 transition-colors">
                                                <td className="p-4">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-10 h-10 bg-soft border border-light">
                                                            {p.main_image_url && <img src={p.main_image_url} alt="" className="object-cover w-full h-full" />}
                                                        </div>
                                                        <span className="font-bold">{p.title}</span>
                                                    </div>
                                                </td>
                                                <td className="p-4 italic opacity-60 text-xs">{p.category}</td>
                                                <td className="p-4 font-bold">${p.price.toFixed(2)}</td>
                                                <td className={`p-4 font-bold ${p.stock_quantity < 10 ? 'text-red-600' : ''}`}>{p.stock_quantity}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 text-[9px] uppercase font-bold tracking-widest rounded ${p.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                                        {p.is_active ? 'Live' : 'Hidden'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => handleEditProduct(p)}
                                                            className="p-2 text-muted hover:text-accent transition-colors"
                                                            title="Edit Listing"
                                                        >
                                                            <Edit size={14} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteProduct(p.id)}
                                                            className="p-2 text-muted hover:text-red-600 transition-colors"
                                                            title="Delete Listing"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB CONTENT: ORDERS & FULFILLMENT */}
                {activeTab === 'orders' && !selectedOrder && (
                    <div className="animate-fade-in">
                        <div className="bg-white border border-light shadow-sm overflow-hidden text-sm">
                            <table className="w-full text-left border-collapse">
                                <thead className="bg-soft text-[10px] uppercase tracking-[0.2em] font-bold text-muted border-b border-light">
                                    <tr>
                                        <th className="p-4">Order #</th>
                                        <th className="p-4">Customer</th>
                                        <th className="p-4">Total</th>
                                        <th className="p-4">Fulfillment</th>
                                        <th className="p-4">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-soft">
                                    {orders.map((o) => (
                                        <tr key={o.id} className="hover:bg-soft/50 group">
                                            <td className="p-4 font-bold">{o.order_number}</td>
                                            <td className="p-4">
                                                <div className="font-medium">{o.full_name}</div>
                                                <div className="text-[10px] text-muted">{o.email}</div>
                                            </td>
                                            <td className="p-4 opacity-80">${o.total_amount?.toFixed(2)}</td>
                                            <td className="p-4">
                                                <span className={`px-2 py-0.5 text-[9px] font-bold tracking-widest uppercase border ${o.fulfillment_status === 'shipped' ? 'border-green-200 text-green-700 bg-green-50' : 'border-sand text-muted bg-soft'
                                                    }`}>
                                                    {o.fulfillment_status || 'Pending'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <button
                                                    onClick={() => {
                                                        setSelectedOrder(o);
                                                        setFulfillmentData({
                                                            tracking_number: o.tracking_number || '',
                                                            carrier: o.carrier || '',
                                                            fulfillment_status: o.fulfillment_status || 'pending'
                                                        });
                                                    }}
                                                    className="text-accent text-[10px] font-bold uppercase tracking-widest hover:underline"
                                                >
                                                    Fulfill
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {activeTab === 'orders' && selectedOrder && (
                    <div className="animate-fade-in max-w-2xl bg-white p-10 border border-light shadow-sm mx-auto">
                        <button onClick={() => setSelectedOrder(null)} className="text-[10px] font-bold uppercase tracking-widest text-muted mb-8 hover:text-main">← Back to Shipments</button>
                        <h2 className="text-2xl font-heading mb-2">Order {selectedOrder.order_number}</h2>
                        <p className="text-muted text-xs mb-10 italic">Customer: {selectedOrder.full_name} ({selectedOrder.email})</p>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 text-muted">Carrier</label>
                                <input
                                    type="text"
                                    className="admin-input"
                                    placeholder="e.g. FedEx, UPS, Local Artisan Delivery"
                                    value={fulfillmentData.carrier}
                                    onChange={(e) => setFulfillmentData({ ...fulfillmentData, carrier: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 text-muted">Tracking Number</label>
                                <input
                                    type="text"
                                    className="admin-input"
                                    placeholder="Enter tracking code"
                                    value={fulfillmentData.tracking_number}
                                    onChange={(e) => setFulfillmentData({ ...fulfillmentData, tracking_number: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold uppercase tracking-widest mb-2 text-muted">Status</label>
                                <select
                                    className="admin-input"
                                    value={fulfillmentData.fulfillment_status}
                                    onChange={(e) => setFulfillmentData({ ...fulfillmentData, fulfillment_status: e.target.value })}
                                >
                                    <option value="pending">Pending</option>
                                    <option value="processing">Processing</option>
                                    <option value="shipped">Shipped</option>
                                    <option value="delivered">Delivered</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>
                            <button
                                onClick={async () => {
                                    const { error } = await supabase.from('store_orders').update(fulfillmentData).eq('id', selectedOrder.id);
                                    if (error) alert(error.message);
                                    else {
                                        setSelectedOrder(null);
                                        fetchAllData();
                                    }
                                }}
                                className="btn-primary w-full py-4 uppercase font-bold tracking-widest"
                            >
                                Update Journey
                            </button>
                        </div>
                    </div>
                )}

                {/* TAB CONTENT: INBOX */}
                {activeTab === 'inbox' && (
                    <div className="animate-fade-in space-y-6">
                        {messages.length > 0 ? messages.map((m) => (
                            <div key={m.id} className={`p-8 border bg-white shadow-sm transition-all ${!m.is_read ? 'border-l-4 border-l-accent' : 'border-light opacity-80'}`}>
                                <div className="flex justify-between items-start mb-4">
                                    <div>
                                        <h4 className="font-bold text-sm uppercase tracking-wide">{m.customer_name}</h4>
                                        <p className="text-[10px] text-muted">{m.email} • {new Date(m.created_at).toLocaleString()}</p>
                                    </div>
                                    {!m.is_read && <span className="text-[9px] font-bold text-accent uppercase tracking-widest">New message</span>}
                                </div>
                                <p className="text-sm leading-relaxed mb-6 italic">"{m.message}"</p>
                                <div className="flex gap-4">
                                    <button className="text-[10px] font-bold uppercase tracking-widest text-accent hover:underline">Reply via Email</button>
                                    {!m.is_read && (
                                        <button
                                            onClick={async () => {
                                                await supabase.from('store_messages').update({ is_read: true }).eq('id', m.id);
                                                fetchAllData();
                                            }}
                                            className="text-[10px] font-bold uppercase tracking-widest text-muted hover:text-main"
                                        >
                                            Mark as Read
                                        </button>
                                    )}
                                </div>
                            </div>
                        )) : (
                            <div className="bg-white p-12 text-center text-muted italic border border-light">The studio is quiet. No messages yet.</div>
                        )}
                    </div>
                )}
                {/* TAB CONTENT: STATS */}
                {activeTab === 'stats' && (
                    <div className="animate-fade-in space-y-12">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            <div className="bg-white p-8 border border-light shadow-sm">
                                <h3 className="text-xs font-bold uppercase tracking-widest mb-10">Sales Trend (30 Days)</h3>
                                <div className="h-64 flex items-end gap-2 border-l border-b border-light pb-2 pl-2">
                                    {dailySales.length > 0 ? dailySales.map((day, idx) => (
                                        <div
                                            key={idx}
                                            className="bg-accent/40 hover:bg-accent transition-all relative group flex-1"
                                            style={{ height: `${(day.daily_revenue / Math.max(...dailySales.map(d => d.daily_revenue))) * 100 || 5}%` }}
                                        >
                                            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-main text-white p-1 rounded text-[8px] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                                                ${day.daily_revenue}
                                            </div>
                                        </div>
                                    )) : <div className="w-full text-center italic text-muted text-xs pb-12">Gathering trend data...</div>}
                                </div>
                                <div className="flex justify-between mt-4 text-[9px] text-muted font-bold uppercase tracking-widest">
                                    <span>30 Days Ago</span>
                                    <span>Today</span>
                                </div>
                            </div>

                            <div className="bg-white p-8 border border-light shadow-sm">
                                <h3 className="text-xs font-bold uppercase tracking-widest mb-10">Conversion Highlights</h3>
                                <div className="space-y-6">
                                    <div className="flex justify-between items-center pb-4 border-b border-soft">
                                        <span className="text-sm">Store Visits</span>
                                        <span className="font-bold">2,412</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-4 border-b border-soft">
                                        <span className="text-sm">Order Conversion</span>
                                        <span className="font-bold">3.2%</span>
                                    </div>
                                    <div className="flex justify-between items-center pb-4 border-b border-soft">
                                        <span className="text-sm">Repeat Customers</span>
                                        <span className="font-bold">18%</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB CONTENT: MARKETING */}
                {activeTab === 'marketing' && (
                    <div className="animate-fade-in">
                        <div className="bg-white border border-light shadow-sm">
                            <div className="p-6 border-b border-light flex justify-between items-center">
                                <h3 className="font-heading font-bold text-lg uppercase">Coupons & Special Offers</h3>
                                <button className="text-xs font-bold bg-accent text-white py-2 px-4 uppercase tracking-widest">Create Coupon</button>
                            </div>
                            <div className="p-0">
                                <table className="w-full text-left text-sm font-light">
                                    <thead className="bg-soft text-[10px] uppercase font-bold text-muted border-b border-light">
                                        <tr>
                                            <th className="p-4">Code</th>
                                            <th className="p-4">Type</th>
                                            <th className="p-4">Value</th>
                                            <th className="p-4">Min. Order</th>
                                            <th className="p-4">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-soft">
                                        {coupons.map((c) => (
                                            <tr key={c.id}>
                                                <td className="p-4 font-bold tracking-widest text-accent uppercase">{c.code}</td>
                                                <td className="p-4 capitalize text-xs">{c.discount_type.replace('_', ' ')}</td>
                                                <td className="p-4 font-bold">{c.discount_type === 'percentage' ? `${c.discount_value}%` : `$${c.discount_value}`}</td>
                                                <td className="p-4 text-xs opacity-60">${c.min_order_amount}</td>
                                                <td className="p-4">
                                                    <span className={`px-2 py-1 text-[9px] uppercase font-bold tracking-widest rounded ${c.is_active ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                                                        {c.is_active ? 'Active' : 'Expired'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB CONTENT: JOURNAL */}
                {activeTab === 'journal' && (
                    <div className="animate-fade-in space-y-8">
                        <div className="flex justify-between items-center">
                            <h3 className="font-heading font-bold text-lg uppercase">Artisan Journal Posts</h3>
                            <button className="btn-primary py-2 px-6 text-[10px]">Write New Story</button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {posts.map((post) => (
                                <div key={post.id} className="bg-white border border-light shadow-sm group overflow-hidden">
                                    <div className="h-48 bg-soft overflow-hidden">
                                        {post.cover_image && <img src={post.cover_image} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />}
                                    </div>
                                    <div className="p-6">
                                        <div className="text-[9px] font-bold text-accent uppercase tracking-widest mb-2">
                                            {post.is_published ? 'Published' : 'Draft'}
                                        </div>
                                        <h4 className="font-heading font-bold mb-4">{post.title}</h4>
                                        <div className="flex justify-between items-center mt-auto">
                                            <span className="text-[10px] text-muted">{new Date(post.created_at).toLocaleDateString()}</span>
                                            <button className="text-accent text-[10px] font-bold uppercase hover:underline">Edit</button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {posts.length === 0 && <div className="col-span-full py-12 text-center text-muted italic bg-white border border-light">No stories started yet. Every piece has a story...</div>}
                        </div>
                    </div>
                )}

                {/* TAB CONTENT: FINANCES */}
                {activeTab === 'finances' && (
                    <div className="animate-fade-in">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="bg-white p-8 border border-light shadow-sm">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-muted block mb-4">Net Sales</span>
                                <div className="text-3xl font-heading font-bold">${(metrics.revenue * 0.95).toFixed(2)}</div>
                                <p className="text-[9px] text-muted mt-2 italic">*After estimated fees</p>
                            </div>
                            <div className="bg-white p-8 border border-light shadow-sm">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-muted block mb-4">Pending Payout</span>
                                <div className="text-3xl font-heading font-bold text-accent">$842.10</div>
                            </div>
                            <div className="bg-white p-8 border border-light shadow-sm">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-muted block mb-4">Total Fees</span>
                                <div className="text-3xl font-heading font-bold text-red-700">${(metrics.revenue * 0.05).toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* TAB CONTENT: SETTINGS */}
                {activeTab === 'settings' && (
                    <div className="animate-fade-in max-w-2xl bg-white p-10 border border-light shadow-sm">
                        <h3 className="text-xs font-bold uppercase tracking-widest mb-10">Store Control Space</h3>

                        <div className="space-y-8">
                            <div className="p-6 bg-soft border border-light">
                                <div className="flex justify-between items-center mb-6">
                                    <h4 className="text-sm font-bold uppercase italic">Announcement Bar</h4>
                                    <button
                                        onClick={() => setSettings({ ...settings, announcement_bar: { ...settings.announcement_bar, is_active: !settings.announcement_bar.is_active } })}
                                        className={`w-12 h-6 rounded-full transition-all ${settings.announcement_bar.is_active ? 'bg-accent' : 'bg-muted'}`}
                                    >
                                        <div className={`w-4 h-4 bg-white rounded-full transition-all ${settings.announcement_bar.is_active ? 'translate-x-7' : 'translate-x-1'}`}></div>
                                    </button>
                                </div>
                                <input
                                    type="text"
                                    className="admin-input mb-4"
                                    value={settings.announcement_bar.text}
                                    onChange={(e) => setSettings({ ...settings, announcement_bar: { ...settings.announcement_bar, text: e.target.value } })}
                                    placeholder="e.g. Free shipping over $200"
                                />
                                <div className="flex items-center gap-3">
                                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted">Bar Color:</span>
                                    <input
                                        type="color"
                                        value={settings.announcement_bar.bg_color}
                                        onChange={(e) => setSettings({ ...settings, announcement_bar: { ...settings.announcement_bar, bg_color: e.target.value } })}
                                        className="w-10 h-6 cursor-pointer border-none"
                                    />
                                </div>
                            </div>

                            <button
                                onClick={async () => {
                                    const { error } = await supabase.from('store_settings').upsert([
                                        { key: 'announcement_bar', value: settings.announcement_bar }
                                    ]);
                                    if (error) alert(error.message);
                                    else alert('✨ Store environment updated.');
                                }}
                                className="btn-primary w-full py-4 uppercase font-bold tracking-widest"
                            >
                                Deploy Settings
                            </button>
                        </div>
                    </div>
                )}
                {/* TAB CONTENT: CATEGORIES */}
                {activeTab === 'categories' && (
                    <div className="animate-fade-in max-w-2xl">
                        <div className="bg-white p-10 border border-light shadow-sm mb-12">
                            <h3 className="text-xs font-bold uppercase tracking-widest mb-8 text-accent">Define New Category</h3>
                            <form onSubmit={handleAddCategory} className="flex gap-4">
                                <input
                                    type="text"
                                    className="admin-input flex-1"
                                    placeholder="e.g. Silk Collection"
                                    value={newCategory.name}
                                    onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                                    required
                                />
                                <button type="submit" className="btn-primary py-4 px-8">Define</button>
                            </form>
                        </div>

                        <div className="bg-white border border-light shadow-sm">
                            <table className="w-full text-left text-sm font-light">
                                <thead className="bg-soft text-[10px] uppercase font-bold text-muted border-b border-light">
                                    <tr>
                                        <th className="p-4">Name</th>
                                        <th className="p-4 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-soft">
                                    {categories.map((cat) => (
                                        <tr key={cat.id}>
                                            <td className="p-4 font-bold">{cat.name}</td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => handleDeleteCategory(cat.id)}
                                                    className="text-red-600 hover:text-red-800 transition-colors"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </main>

            <style jsx>{`
                .admin-nav-item {
                    display: flex;
                    align-items: center;
                    gap: 0.75rem;
                    padding: 0.75rem 1rem;
                    width: 100%;
                    text-align: left;
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    color: var(--muted);
                    border-radius: 0.375rem;
                    transition: all 0.2s;
                }
                .admin-nav-item:hover {
                    background-color: var(--soft);
                    color: var(--main);
                }
                .admin-nav-item.active {
                    background-color: var(--sand);
                    color: var(--main);
                }
                .admin-input {
                    width: 100%;
                    padding: 1rem;
                    background-color: transparent;
                    border: 1px solid var(--border-light);
                    font-weight: 300;
                    font-size: 0.875rem;
                    transition: all 0.2s;
                    outline: none;
                }
                .admin-input:focus {
                    border-color: var(--accent);
                    background-color: #fff;
                }
            `}</style>
        </div>
    );
}
