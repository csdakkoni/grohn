import Image from "next/image";
import Link from "next/link";
import { getProducts, getCategories } from "@/lib/products";

export default async function ShopPage() {
    const products = await getProducts();
    const categories = await getCategories();

    return (
        <div className="section-spacing">
            <div className="container">
                {/* HEADER */}
                <div className="mb-12 border-b border-light pb-8">
                    <h1 className="text-5xl font-heading mb-4">Shop the Collection</h1>
                    <p className="text-muted max-w-xl">
                        Explore our curated selection of artisan-made goods, directly from our studio to your home.
                    </p>
                </div>

                {/* FEED & FILTERS */}
                <div className="flex flex-col md:flex-row gap-12">
                    {/* SIDEBAR FILTERS */}
                    <aside className="w-full md:w-64 space-y-8">
                        <div>
                            <h4 className="text-xs uppercase tracking-widest font-bold mb-4">Categories</h4>
                            <ul className="space-y-2 text-sm">
                                <li><button className="text-main font-semibold">All Products</button></li>
                                {categories.map((cat) => (
                                    <li key={cat.id}>
                                        <button className="text-muted hover:text-main">{cat.name}</button>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-xs uppercase tracking-widest font-bold mb-4">Sort By</h4>
                            <select className="bg-transparent border-none text-sm font-medium focus:outline-none">
                                <option>Newest First</option>
                                <option>Price: Low to High</option>
                                <option>Price: High to Low</option>
                            </select>
                        </div>
                    </aside>

                    <main className="flex-1">
                        <div className="product-grid">
                            {products.map((product) => (
                                <Link key={product.id} href={`/product/${product.slug}`} className="product-card group">
                                    <div className="product-image-container mb-6 overflow-hidden bg-soft border border-light aspect-[4/5] relative">
                                        <Image
                                            src={product.main_image_url}
                                            alt={product.title}
                                            fill
                                            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                                            className="object-cover transition-transform duration-700 group-hover:scale-105"
                                        />
                                    </div>
                                    <h3 className="text-lg font-heading mb-2 group-hover:text-accent transition-colors">{product.title}</h3>
                                    <div className="flex justify-between items-center">
                                        <span className="text-[10px] uppercase tracking-widest text-muted">{product.category}</span>
                                        <span className="font-semibold text-main">{product.currency === 'USD' ? '$' : ''}{product.price.toFixed(2)}</span>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </main>
                </div>
            </div>
        </div>
    );
}
