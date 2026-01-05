"use client";
import React from 'react';
import { useCart } from '@/context/CartContext';
import { X, ShoppingBag, Plus, Minus, Trash2 } from 'lucide-react';
import Image from 'next/image';

export default function CartDrawer() {
    const { cartItems, isCartOpen, setIsCartOpen, removeFromCart, updateQuantity, cartTotal } = useCart();
    const [loading, setLoading] = React.useState(false);

    if (!isCartOpen) return null;

    const handleCheckout = async () => {
        if (loading) return;
        setLoading(true);
        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ items: cartItems }),
            });
            const data = await response.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                console.error('Checkout error data:', data);
                alert(`Checkout Error: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Checkout error:', error);
            alert('Checkout failed. Please check your internet connection or console.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex justify-end">
            {/* Overlay */}
            <div
                className="cart-overlay"
                onClick={() => setIsCartOpen(false)}
            />

            {/* Drawer */}
            <div className="cart-drawer animate-slide-in-right">
                <div className="cart-header">
                    <div className="flex items-center gap-2">
                        <ShoppingBag className="h-5 w-5 text-accent" />
                        <h2 className="font-heading font-bold text-xl uppercase tracking-tighter">Your Cart</h2>
                    </div>
                    <button onClick={() => setIsCartOpen(false)} style={{ padding: '8px', background: 'transparent' }}>
                        <X className="h-6 w-6" />
                    </button>
                </div>

                <div className="cart-items">
                    {cartItems.length === 0 ? (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', gap: '16px' }}>
                            <ShoppingBag className="h-12 w-12 opacity-20" />
                            <p className="text-muted">Your cart is currently empty.</p>
                            <button
                                onClick={() => setIsCartOpen(false)}
                                className="btn-secondary"
                            >
                                Continue Shopping
                            </button>
                        </div>
                    ) : (
                        cartItems.map((item) => (
                            <div key={item.id} className="cart-item">
                                <div className="cart-item-image">
                                    <Image src={item.main_image_url} alt="" fill className="object-cover" />
                                </div>
                                <div className="cart-item-info">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                                        <h3 style={{ fontSize: '14px', fontWeight: '600', maxWidth: '200px' }}>{item.title}</h3>
                                        <button onClick={() => removeFromCart(item.id)} style={{ color: 'var(--fg-muted)', background: 'transparent' }}>
                                            <Trash2 className="h-4 w-4" />
                                        </button>
                                    </div>
                                    <p className="product-category" style={{ marginBottom: '12px' }}>{item.category}</p>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div className="quantity-control">
                                            <button onClick={() => updateQuantity(item.id, -1)}><Minus className="h-3 w-3" /></button>
                                            <span style={{ padding: '0 12px', fontSize: '12px', fontWeight: '700' }}>{item.quantity}</span>
                                            <button onClick={() => updateQuantity(item.id, 1)}><Plus className="h-3 w-3" /></button>
                                        </div>
                                        <span className="product-price">${(item.price * item.quantity).toFixed(2)}</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {cartItems.length > 0 && (
                    <div className="cart-footer">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                            <span style={{ fontSize: '18px', fontWeight: '700' }}>Subtotal</span>
                            <span style={{ fontSize: '18px', fontWeight: '700' }}>${cartTotal.toFixed(2)}</span>
                        </div>
                        <p style={{ fontSize: '10px', color: 'var(--fg-muted)', textAlign: 'center', marginBottom: '16px' }}>
                            Shipping and taxes calculated at checkout.
                        </p>
                        <button
                            onClick={handleCheckout}
                            disabled={loading}
                            className={`btn-primary w-full ${loading ? 'opacity-70 cursor-wait' : ''}`}
                            style={{ padding: '16px' }}
                        >
                            {loading ? 'Opening Secure Checkout...' : 'Secure Checkout'}
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
