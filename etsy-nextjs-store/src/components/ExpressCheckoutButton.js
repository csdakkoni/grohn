"use client";
import React, { useState } from 'react';

export default function ExpressCheckoutButton({ product }) {
    const [loading, setLoading] = useState(false);

    const handleCheckout = async () => {
        if (loading) return;
        setLoading(true);

        try {
            const response = await fetch('/api/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    items: [{ ...product, quantity: 1 }]
                }),
            });

            const data = await response.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                console.error('Checkout error:', data);
                alert(`Checkout error: ${data.error || 'Unknown error'}`);
            }
        } catch (error) {
            console.error('Checkout error:', error);
            alert('Failed to start checkout. Check your console.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <button
            onClick={handleCheckout}
            disabled={loading || product.stock_quantity <= 0}
            className={`btn-secondary w-full py-4 text-sm font-bold tracking-widest uppercase bg-white ${loading ? 'opacity-70 cursor-wait' : ''}`}
        >
            {loading ? 'Processing...' : 'Express Checkout'}
        </button>
    );
}
