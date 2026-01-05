"use client";
import { Star, StarHalf } from 'lucide-react';

export default function StarRating({ rating, size = 16, interactive = false, onRate }) {
    return (
        <div className="flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => (
                <button
                    key={star}
                    type="button"
                    disabled={!interactive}
                    onClick={() => interactive && onRate?.(star)}
                    className={`${interactive ? 'cursor-pointer hover:scale-110 transition-transform' : 'cursor-default'}`}
                >
                    <Star
                        size={size}
                        className={`${star <= rating
                            ? 'fill-accent text-accent'
                            : 'text-light fill-soft'
                            }`}
                    />
                </button>
            ))}
        </div>
    );
}
