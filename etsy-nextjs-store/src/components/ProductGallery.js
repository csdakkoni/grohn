'use client';

import { useState } from 'react';
import Image from 'next/image';

export default function ProductGallery({ images = [] }) {
    const [activeImage, setActiveImage] = useState(images[0] || '');

    if (!images || images.length === 0) return null;

    return (
        <div className="image-gallery">
            <div className="main-image shadow-sm overflow-hidden bg-soft relative aspect-[4/5]">
                {activeImage && (
                    <Image
                        src={activeImage}
                        alt="Product Gallery Image"
                        fill
                        className="object-cover transition-opacity duration-500 animate-fade-in"
                        priority
                    />
                )}
            </div>

            <div className="thumbnail-grid mt-4 grid grid-cols-5 gap-2">
                {images.map((img, i) => (
                    <button
                        key={i}
                        onClick={() => setActiveImage(img)}
                        className={`relative aspect-square border overflow-hidden transition-all ${activeImage === img ? 'border-accent ring-1 ring-accent' : 'border-light hover:border-accent'
                            }`}
                    >
                        <Image src={img} alt="" fill className="object-cover" />
                        {activeImage === img && (
                            <div className="absolute inset-0 bg-accent/5" />
                        )}
                    </button>
                ))}
            </div>
        </div>
    );
}
