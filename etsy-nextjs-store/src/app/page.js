import Image from "next/image";
import Link from "next/link";
import AddToCartButton from "@/components/AddToCartButton";
import { getProducts } from "@/lib/products";

export default async function Home() {
  const products = await getProducts();
  const featuredProducts = products.slice(0, 6); // Live products from your database

  return (
    <div className="flex flex-col gap-0">
      {/* HERO SECTION */}
      <section className="relative h-[90vh] min-h-[700px] flex items-center overflow-hidden bg-soft">
        <div className="absolute inset-0 z-0">
          <Image
            src="/brain/0740e33d-34b8-4263-9638-c68ce58ed630/agoraloom_hero_banner_1767427769509.png"
            alt="AgoraLoom Sustainable Textiles"
            fill
            className="object-cover opacity-90 transition-transform duration-[10000ms] hover:scale-105"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg-soft/70 to-transparent" />
        </div>

        <div className="container relative z-10">
          <div className="flex flex-col md:flex-row items-center gap-16 md:gap-32">
            <div className="max-w-xl animate-fade-in-up md:flex-1">
              <span className="text-accent text-[10px] font-bold tracking-[0.5em] uppercase mb-10 block animate-fade-in">
                Est. 2026 — Artisan Excellence
              </span>
              <h1 className="text-7xl md:text-[120px] font-heading font-normal text-main mb-12 leading-[0.9] tracking-[-0.04em]">
                Texture <br />
                <span className="italic font-light ml-8 md:ml-24 text-accent">of Life.</span>
              </h1>
              <p className="text-lg text-muted mb-16 max-w-sm font-light leading-relaxed border-l border-accent/20 pl-8">
                Sustainable home textiles inspired by the raw beauty of nature. Handcrafted pieces that speak to a conscious lifestyle.
              </p>
              <div className="flex flex-wrap gap-12 items-center">
                <Link href="/shop" className="btn-primary group">
                  Explore Collection
                </Link>
                <Link href="/about" className="text-[10px] uppercase font-bold tracking-[0.3em] border-b border-light pb-2 hover:border-accent transition-all">
                  Our Philosophy →
                </Link>
              </div>
            </div>

            <div className="hidden lg:block flex-1 relative h-[600px] w-full border border-light p-4 animate-fade-in">
              <div className="relative w-full h-full overflow-hidden">
                <Image
                  src="/assets/throw.png"
                  alt=""
                  fill
                  className="object-cover grayscale hover:grayscale-0 transition-all duration-1000"
                />
                <div className="absolute inset-x-0 bottom-0 p-8 bg-white/10 backdrop-blur-md">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-white">Focal Piece: Artisan Muslin</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      <section className="section-spacing">
        <div className="container">
          <div className="flex justify-between items-end mb-16 border-b border-light pb-8">
            <div>
              <span className="text-accent text-xs font-bold tracking-widest uppercase mb-2 block italic">Our Selection</span>
              <h2 className="text-3xl md:text-4xl font-heading">Featured Pieces</h2>
            </div>
            <Link href="/shop" className="text-sm font-medium border-b border-muted hover:border-main pb-1 transition-all">
              View All Products
            </Link>
          </div>

          <div className="product-grid">
            {featuredProducts.map((product) => (
              <div key={product.id} className="product-card">
                <Link href={`/product/${product.slug}`}>
                  <div className="product-image-container">
                    <Image
                      src={product.main_image_url}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                    />
                  </div>
                </Link>

                <Link href={`/product/${product.slug}`}>
                  <h3 className="product-title">{product.title}</h3>
                </Link>

                <div className="product-meta">
                  <div>
                    <span className="product-category">{product.category}</span>
                    <div className="product-price mt-1">
                      {product.currency === 'USD' ? '$' : ''}{product.price.toFixed(2)}
                    </div>
                  </div>
                  <AddToCartButton product={product} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* BRAND ETHOS */}
      <section className="bg-soft section-spacing border-t border-light">
        <div className="container text-center max-w-3xl">
          <h2 className="text-2xl md:text-3xl font-heading mb-8">Craftsmanship with Conscious Integrity</h2>
          <p className="text-muted leading-relaxed mb-12 italic text-lg">
            "Each piece is more than just an object; it's a story of artisanal dedication, sourced and shipped with the highest standards of quality from our heart to your home."
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 text-center">
            <div>
              <div className="text-accent mb-3 font-bold text-lg">01.</div>
              <div className="font-bold mb-2 uppercase tracking-tighter">US Shipping</div>
              <p className="text-xs text-muted leading-relaxed">Fast, reliable delivery across the States, handled with care.</p>
            </div>
            <div>
              <div className="text-accent mb-3 font-bold text-lg">02.</div>
              <div className="font-bold mb-2 uppercase tracking-tighter">Artisan Made</div>
              <p className="text-xs text-muted leading-relaxed">Directly supporting independent crafts and traditional methods.</p>
            </div>
            <div>
              <div className="text-accent mb-3 font-bold text-lg">03.</div>
              <div className="font-bold mb-2 uppercase tracking-tighter">Safe Payment</div>
              <p className="text-xs text-muted leading-relaxed">Secured by Stripe with support for Apple Pay and Google Pay.</p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
