import { getProductBySlug, getRelatedProducts, getProductReviews } from "@/lib/products";
import { notFound } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import AddToCartButton from "@/components/AddToCartButton";
import ExpressCheckoutButton from "@/components/ExpressCheckoutButton";
import ReviewSection from "@/components/ReviewSection";
import ProductTabs from "@/components/ProductTabs";
import Script from "next/script";
import ProductGallery from "@/components/ProductGallery";

export async function generateMetadata({ params }) {
    const { slug } = await params;
    const product = await getProductBySlug(slug);

    if (!product) return { title: 'Product Not Found' };

    return {
        title: `${product.title} | AgoraLoom Artisan Collective`,
        description: product.description.substring(0, 160) + '...',
        openGraph: {
            title: product.title,
            description: product.description.substring(0, 160),
            images: [product.main_image_url],
            type: 'article',
        },
    };
}

export default async function ProductPage({ params }) {
    const { slug } = await params;
    const product = await getProductBySlug(slug);

    if (!product) {
        notFound();
    }

    const relatedProducts = await getRelatedProducts(product.category, product.slug);
    const reviews = await getProductReviews(product.id);

    const jsonLd = {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.title,
        image: product.main_image_url,
        description: product.description,
        brand: {
            '@type': 'Brand',
            name: 'AgoraLoom',
        },
        offers: {
            '@type': 'Offer',
            priceCurrency: product.currency,
            price: product.price,
            availability: product.stock_quantity > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
            url: `https://agoraloom.com/product/${product.slug}`,
        },
    };

    return (
        <div className="section-spacing">
            <Script
                id="product-jsonld"
                type="application/ld+json"
                dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
            />
            <div className="container">
                <div className="product-detail-grid">
                    {/* IMAGE GALLERY */}
                    <ProductGallery images={Array.isArray(product.all_images) ? product.all_images : JSON.parse(product.all_images || '[]')} />

                    {/* PRODUCT INFO */}
                    <div className="product-info-sticky top-[100px]">
                        <div className="mb-10 border-b border-light pb-8">
                            <span className="text-accent text-[10px] font-bold tracking-[0.2em] uppercase mb-6 block italic">
                                {product.category}
                            </span>
                            <h1 className="text-4xl md:text-6xl font-heading mb-6 leading-[1.1] font-normal">{product.title}</h1>
                            <div className="flex flex-wrap items-center gap-4">
                                <span className="text-4xl font-light text-main">
                                    {product.currency === 'USD' ? '$' : ''}{product.price.toFixed(2)}
                                </span>
                                <div className="flex gap-2">
                                    <span className="px-2 py-0.5 bg-soft border border-light text-[8px] font-bold tracking-widest text-muted uppercase">
                                        OEKO-TEX® Certified
                                    </span>
                                    <span className="px-2 py-0.5 bg-soft border border-light text-[8px] font-bold tracking-widest text-muted uppercase">
                                        %100 Organic Cotton
                                    </span>
                                </div>
                            </div>
                        </div>

                        <ProductTabs product={product} />

                        <div className="space-y-8">
                            <div className="flex justify-between items-center py-4 border-y border-soft">
                                <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-muted italic">Bespoke Guarantee</span>
                                <Link href="/contact" className="text-[10px] font-bold text-accent underline underline-offset-4 uppercase tracking-widest">
                                    Request Custom Size
                                </Link>
                            </div>

                            <div className="flex flex-col gap-4">
                                <AddToCartButton
                                    product={product}
                                    disabled={product.stock_quantity <= 0}
                                />
                                <ExpressCheckoutButton product={product} />
                            </div>

                            <div className="flex items-center justify-center gap-6 pt-6 opacity-40">
                                <div className="text-[10px] font-bold tracking-widest uppercase">Secured by Stripe</div>
                                <div className="text-[10px] font-bold tracking-widest uppercase">Artisan Quality</div>
                            </div>
                        </div>

                        {/* PRODUCT VIDEO / ATMOSPHERE */}
                        {product.video_url && (
                            <div className="mt-16 animate-fade-in-up">
                                <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-muted block mb-4 italic">Artisan Atmosphere</span>
                                <div className="aspect-video relative bg-soft overflow-hidden border border-light">
                                    {product.video_url.includes('youtube.com') || product.video_url.includes('youtu.be') ? (
                                        <iframe
                                            className="absolute inset-0 w-full h-full"
                                            src={`https://www.youtube.com/embed/${product.video_url.split('v=')[1]?.split('&')[0] || product.video_url.split('/').pop()}`}
                                            frameBorder="0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        ></iframe>
                                    ) : (
                                        <video
                                            src={product.video_url}
                                            className="w-full h-full object-cover"
                                            controls
                                            muted
                                            autoPlay
                                            loop
                                        />
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* REVIEWS */}
                <ReviewSection reviews={reviews} />

                {/* RELATED PRODUCTS */}
                {relatedProducts.length > 0 && (
                    <div className="mt-24 pt-24 border-t border-light">
                        <h3 className="text-2xl font-heading mb-12">You might also like</h3>
                        <div className="related-grid">
                            {relatedProducts.map((rel) => (
                                <Link key={rel.id} href={`/product/${rel.slug}`} className="product-card group">
                                    <div className="product-image-container mb-6 overflow-hidden bg-soft border border-light aspect-[4/5] relative">
                                        <Image
                                            src={rel.main_image_url}
                                            alt={rel.title}
                                            fill
                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                                        />
                                    </div>
                                    <h3 className="text-base font-heading mb-2 group-hover:text-accent transition-colors">{rel.title}</h3>
                                    <div className="product-price text-sm">
                                        {rel.currency === 'USD' ? '$' : ''}{rel.price.toFixed(2)}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
