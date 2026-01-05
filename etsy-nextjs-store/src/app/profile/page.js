"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';
import { Package, LogOut, User as UserIcon, Calendar, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchUserData = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                router.push('/login');
                return;
            }
            setUser(session.user);

            // Fetch User Profile (Loyalty)
            const { data: pData } = await supabase
                .from('user_profiles')
                .select('*')
                .eq('id', session.user.id)
                .single();

            if (pData) setProfile(pData);

            // Fetch orders for this user
            const { data: orderData, error } = await supabase
                .from('store_orders')
                .select('*, store_order_items(*, store_products(title, main_image_url))')
                .eq('customer_id', session.user.id)
                .order('created_at', { ascending: false });

            if (orderData) setOrders(orderData);
            setLoading(false);
        };

        fetchUserData();
    }, [router]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
        router.refresh();
    };

    if (loading) {
        return (
            <div className="section-spacing min-h-[60vh] flex items-center justify-center">
                <div className="animate-pulse text-muted uppercase tracking-[0.3em] font-bold text-xs">Loading Profile...</div>
            </div>
        );
    }

    return (
        <div className="section-spacing bg-white">
            <div className="container">
                {/* HEADER */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-8 mb-16 pb-8 border-b border-light">
                    <div>
                        <span className="text-accent text-[10px] font-bold tracking-[0.3em] uppercase mb-4 block italic">Member Space</span>
                        <h1 className="text-5xl font-heading mb-2">Hello, {user.user_metadata.full_name || 'Artisan'}</h1>
                        <p className="text-muted font-light">{user.email}</p>
                    </div>
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted hover:text-red-700 transition-colors"
                    >
                        <LogOut size={14} /> Sign Out
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-4 gap-16">
                    {/* SIDEBAR */}
                    <div className="lg:col-span-1 space-y-8">
                        <div className="p-8 bg-soft border border-light">
                            <h3 className="text-xs font-bold uppercase tracking-widest mb-6">Your Information</h3>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 text-xs text-main">
                                    <UserIcon size={14} className="text-accent" />
                                    <span>{user.user_metadata.full_name}</span>
                                </div>
                                <div className="flex items-center gap-3 text-xs text-main">
                                    <Calendar size={14} className="text-accent" />
                                    <span>Joined {new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
                                </div>
                            </div>
                        </div>

                        {/* LOYALTY CARD */}
                        <div className="p-8 bg-zinc-900 text-white border border-zinc-700 shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-accent opacity-10 rounded-full -mr-16 -mt-16 group-hover:scale-110 transition-transform"></div>
                            <h3 className="text-[10px] font-bold uppercase tracking-[0.3em] mb-6 text-accent italic">The Artisan Circle</h3>

                            <div className="mb-8">
                                <p className="text-[10px] uppercase tracking-widest text-zinc-400 mb-1">Your Tier</p>
                                <p className="text-2xl font-heading text-white">{profile?.loyalty_tier || 'Bronze'}</p>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <div className="flex justify-between text-[10px] uppercase tracking-widest mb-1.5 font-bold">
                                        <span>Points Balance</span>
                                        <span className="text-accent">{profile?.loyalty_points || 0}</span>
                                    </div>
                                    <div className="w-full bg-zinc-800 h-1">
                                        <div
                                            className="bg-accent h-full transition-all duration-1000"
                                            style={{ width: `${Math.min(((profile?.loyalty_points || 0) / 1500) * 100, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                                <p className="text-[9px] text-zinc-500 italic">
                                    {profile?.loyalty_tier === 'Gold' ? 'You have reached the ultimate Artisan tier.' : 'Keep exploring to unlock Silver status at 500 points.'}
                                </p>
                            </div>
                        </div>

                        <div className="p-8 border border-light">
                            <h3 className="text-[10px] font-bold uppercase tracking-widest mb-6">Need Assistance?</h3>
                            <Link href="/contact" className="block text-xs font-bold uppercase tracking-widest hover:text-accent transition-colors">
                                Contact Artisan Support →
                            </Link>
                        </div>
                    </div>

                    {/* ORDERS */}
                    <div className="lg:col-span-3">
                        <div className="flex items-center gap-3 mb-10">
                            <Package size={20} className="text-accent" />
                            <h2 className="text-2xl font-heading">Order History</h2>
                        </div>

                        {orders.length === 0 ? (
                            <div className="p-16 border border-dashed border-light text-center bg-soft">
                                <p className="text-muted italic mb-6">You haven't placed any orders yet. Ready to find something special?</p>
                                <Link href="/shop" className="btn-primary inline-block py-4 px-8 text-xs font-bold uppercase tracking-widest">
                                    Start Browsing
                                </Link>
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {orders.map((order) => (
                                    <div key={order.id} className="border border-light">
                                        <div className="p-6 bg-soft border-b border-light flex flex-wrap justify-between items-center gap-4">
                                            <div className="flex gap-8">
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold tracking-widest text-muted mb-1">Order #</p>
                                                    <p className="text-xs font-bold">{order.order_number}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold tracking-widest text-muted mb-1">Date</p>
                                                    <p className="text-xs">{new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                                                </div>
                                                <div>
                                                    <p className="text-[10px] uppercase font-bold tracking-widest text-muted mb-1">Total</p>
                                                    <p className="text-xs font-bold">${order.total_amount.toFixed(2)}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 px-3 py-1 bg-white border border-light rounded-full">
                                                <CheckCircle size={10} className="text-green-600" />
                                                <span className="text-[10px] font-bold uppercase tracking-widest">{order.status}</span>
                                            </div>
                                        </div>
                                        <div className="p-6">
                                            {order.store_order_items?.map((item, idx) => (
                                                <div key={idx} className="flex items-center gap-6 py-4 last:pb-0 font-light border-b border-soft last:border-0">
                                                    <div className="w-12 h-16 bg-soft relative overflow-hidden flex-shrink-0">
                                                        {item.store_products?.main_image_url && (
                                                            <img src={item.store_products.main_image_url} alt="" className="object-cover w-full h-full" />
                                                        )}
                                                    </div>
                                                    <div className="flex-1">
                                                        <h4 className="text-sm font-bold mb-1">{item.store_products?.title}</h4>
                                                        <p className="text-xs text-muted">Quantity: {item.quantity}</p>
                                                    </div>
                                                    <p className="text-sm font-bold">${(item.unit_price * item.quantity).toFixed(2)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
