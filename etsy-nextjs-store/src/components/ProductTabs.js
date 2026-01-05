"use client";
import React, { useState } from 'react';

export default function ProductTabs({ product }) {
    const [activeTab, setActiveTab] = useState('details');

    const tabs = [
        { id: 'details', label: 'The Detail' },
        { id: 'material', label: 'Purity & Origin' },
        { id: 'care', label: 'Care Ritual' },
        { id: 'size', label: 'Artisan Sizing' },
        { id: 'shipping', label: 'Shipping' },
        { id: 'note', label: 'Artisan Note' },
    ];

    return (
        <div className="mt-12">
            <div className="flex border-b border-soft overflow-x-auto scrollbar-hide">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`py-4 px-6 text-[10px] items-center font-bold uppercase tracking-[0.2em] whitespace-nowrap transition-all border-b-2 ${activeTab === tab.id
                            ? 'border-accent text-main'
                            : 'border-transparent text-muted hover:text-main'
                            }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="py-8 min-h-[150px]">
                {activeTab === 'details' && (
                    <div className="animate-fade-in">
                        <p className="text-main leading-relaxed text-base font-light opacity-90">
                            {product.description}
                        </p>
                    </div>
                )}
                {activeTab === 'material' && (
                    <div className="animate-fade-in">
                        <h4 className="text-xs font-bold uppercase tracking-widest mb-4">Woven Background</h4>
                        <p className="text-main leading-relaxed text-base font-light opacity-90">
                            {product.material || "Hand-selected materials sourced for their quality and environmental integrity."}
                        </p>
                    </div>
                )}
                {activeTab === 'care' && (
                    <div className="animate-fade-in">
                        <h4 className="text-xs font-bold uppercase tracking-widest mb-4">Preserving Beauty</h4>
                        <p className="text-main leading-relaxed text-base font-light opacity-90">
                            {product.care_instructions || "Gently handle with care. We recommend mindful cleaning to maintain the artisanal character of this piece."}
                        </p>
                    </div>
                )}
                {activeTab === 'size' && (
                    <div className="animate-fade-in">
                        <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] mb-4 text-accent">Dimensions</h4>
                        <p className="text-main leading-relaxed text-base font-light opacity-95">
                            {product.size_guide || "Standard dimensions. Each piece may vary slightly (±2cm) due to its handcrafted nature."}
                        </p>
                        <div className="mt-6 p-6 bg-soft border border-light text-[10px] uppercase font-bold tracking-widest text-muted">
                            Need a custom size? <a href="/contact" className="text-accent underline">Contact us</a> for bespoke tailoring.
                        </div>
                    </div>
                )}
                {activeTab === 'shipping' && (
                    <div className="animate-fade-in">
                        <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] mb-4 text-accent">Safe Passage</h4>
                        <p className="text-main leading-relaxed text-base font-light opacity-95 mb-6">
                            We ship with care. Worldwide options available via premium carriers. All items are insured and trackable.
                        </p>
                        <ul className="text-xs space-y-3 font-light text-muted">
                            <li>• Returns & exchanges accepted within 14 days.</li>
                            <li>• Buyers are responsible for return shipping costs.</li>
                            <li>• Item must be returned in its original, unwashed condition.</li>
                        </ul>
                    </div>
                )}
                {activeTab === 'note' && (
                    <div className="animate-fade-in italic">
                        <h4 className="text-[10px] font-bold uppercase tracking-[0.3em] mb-4 text-accent">A Note from Asur</h4>
                        <p className="text-main leading-relaxed text-base font-light opacity-95 mb-6">
                            "Hello, I am Asur, the co-founder and photographer of AgoraLoom. I take great care to ensure our photos represent the true colors and textures of our fabrics. However, screen calibrations vary; for exact color matching, I always recommend ordering a fabric sample first."
                        </p>
                        <span className="text-[10px] uppercase font-bold tracking-widest text-accent">— Asur, Co-founder & Creative Lead</span>
                    </div>
                )}
            </div>
        </div>
    );
}
