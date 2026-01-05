"use client";
import React from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { ShoppingBag, Search, Menu, User } from 'lucide-react';
import { supabase } from '@/lib/supabase';

export default function Navbar() {
    const { cartCount, setIsCartOpen } = useCart();
    const [isMenuOpen, setIsMenuOpen] = React.useState(false);
    const [user, setUser] = React.useState(null);

    React.useEffect(() => {
        // Get initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
        });

        // Listen for changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setUser(session?.user ?? null);
        });

        return () => subscription.unsubscribe();
    }, []);

    return (
        <nav className="glass sticky top-0 z-50 border-b border-light">
            <div className="container flex justify-between items-center h-16">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => setIsMenuOpen(!isMenuOpen)}
                        className="md:hidden p-2 hover:bg-soft rounded-full transition-colors"
                    >
                        <Menu className="h-5 w-5" />
                    </button>
                    <Link href="/" className="font-heading font-normal text-3xl tracking-[-0.05em] flex items-center gap-3">
                        <span className="text-main">AGORA</span>
                        <div className="w-[1px] h-8 bg-border-light hidden md:block"></div>
                        <span className="text-accent italic font-light">LOOM</span>
                    </Link>
                </div>

                <div className="hidden md:flex gap-12 text-[10px] font-bold uppercase tracking-[0.3em]">
                    <Link href="/" className="hover:text-accent transition-all duration-500">Home</Link>
                    <Link href="/shop" className="text-accent border-b border-accent pb-1">Collection</Link>
                    <Link href="/about" className="hover:text-accent transition-all duration-500">About</Link>
                    <Link href="/contact" className="hover:text-accent transition-all duration-500">Contact</Link>
                </div>

                <div className="flex items-center gap-1 md:gap-4">
                    <button className="p-2 hover:bg-soft rounded-full transition-all group">
                        <Search className="h-5 w-5 text-muted group-hover:text-main" />
                    </button>

                    <Link href={user ? "/profile" : "/login"} className="p-2 hover:bg-soft rounded-full transition-all group">
                        <User className={`h-5 w-5 ${user ? 'text-accent' : 'text-muted'} group-hover:text-main`} />
                    </Link>

                    <button
                        onClick={() => setIsCartOpen(true)}
                        className="flex items-center gap-3 border border-main py-1.5 px-4 md:px-6 hover:bg-main hover:text-white transition-all duration-500 relative group"
                    >
                        <ShoppingBag className="h-4 w-4" />
                        <span className="hidden md:inline text-[10px] uppercase font-bold tracking-widest">Bag</span>
                        {cartCount > 0 && (
                            <span className="absolute -top-1.5 -right-1.5 bg-accent text-white text-[8px] font-bold w-4 h-4 flex items-center justify-center">
                                {cartCount}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* MOBILE MENU */}
            {isMenuOpen && (
                <div className="md:hidden bg-white border-t border-light animate-fade-in-up">
                    <div className="container py-6 flex flex-col gap-4 text-sm font-medium">
                        <Link href="/" onClick={() => setIsMenuOpen(false)} className="py-2 hover:text-accent border-b border-soft">Home</Link>
                        <Link href="/shop" onClick={() => setIsMenuOpen(false)} className="py-2 hover:text-accent border-b border-soft">Shop All</Link>
                        <Link href="/about" onClick={() => setIsMenuOpen(false)} className="py-2 hover:text-accent border-b border-soft">Our Story</Link>
                        <Link href="/contact" onClick={() => setIsMenuOpen(false)} className="py-2 hover:text-accent border-b border-soft">Support</Link>
                    </div>
                </div>
            )}
        </nav>
    );
}
