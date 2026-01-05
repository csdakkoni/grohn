"use client";
import React from 'react';
import StarRating from './StarRating';

export default function ReviewSection({ reviews }) {
    const averageRating = reviews.length > 0
        ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
        : 0;

    return (
        <section className="mt-24 pt-24 border-t border-light">
            <div className="flex flex-col md:flex-row justify-between items-start gap-12 mb-16">
                <div>
                    <h3 className="text-3xl font-heading mb-4">Customer Stories</h3>
                    <div className="flex items-center gap-4">
                        <span className="text-5xl font-light">{averageRating}</span>
                        <div>
                            <StarRating rating={Math.round(averageRating)} size={20} />
                            <p className="text-xs text-muted uppercase tracking-widest mt-1">Based on {reviews.length} reviews</p>
                        </div>
                    </div>
                </div>
                <button className="btn-secondary py-4 px-8 text-xs font-bold uppercase tracking-widest bg-white">
                    Share Your Experience
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                {reviews.length > 0 ? (
                    reviews.map((review) => (
                        <div key={review.id} className="pb-8 border-b border-soft">
                            <div className="flex justify-between items-start mb-4">
                                <StarRating rating={review.rating} size={14} />
                                <span className="text-[10px] text-muted uppercase tracking-widest">
                                    {new Date(review.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                                </span>
                            </div>
                            <h4 className="font-bold text-sm mb-2 uppercase tracking-wide">
                                {review.customer_name}
                                {review.is_verified_purchase && (
                                    <span className="ml-2 text-[9px] text-green-700 italic lowercase font-normal opacity-60">Verified Purchase</span>
                                )}
                            </h4>
                            <p className="text-main font-light leading-relaxed text-sm italic">
                                "{review.comment}"
                            </p>
                        </div>
                    ))
                ) : (
                    <p className="text-muted italic">No stories shared yet. Be the first to tell yours.</p>
                )}
            </div>
        </section>
    );
}
