"use client";
import React from 'react';
import { useCart } from '@/context/CartContext';
import { ShoppingBag } from 'lucide-react';

export default function AddToCartButton({ product, disabled }) {
    const { addToCart } = useCart();

    return (
        <button
            disabled={disabled}
            onClick={() => addToCart(product)}
            className="btn-primary w-full py-4 text-lg shadow-md disabled:bg-light disabled:cursor-not-allowed flex items-center justify-center gap-3"
        >
            <ShoppingBag className="h-5 w-5" />
            Add to Cart
        </button>
    );
}
