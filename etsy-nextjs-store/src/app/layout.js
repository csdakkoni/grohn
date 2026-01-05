import "./globals.css";
import Link from "next/link";
import { CartProvider } from "@/context/CartContext";
import Navbar from "@/components/Navbar";
import CartDrawer from "@/components/CartDrawer";
import { GoogleAnalytics } from '@next/third-parties/google';

export const metadata = {
  title: {
    default: "AGORALOOM | Sustainable Artisan Textiles",
    template: "%s | AGORALOOM"
  },
  description: "Handcrafted sustainable home textiles inspired by nature. Premium muslin curtains, linen tablecloths, and artisanal throws.",
  keywords: ["sustainable home decor", "artisan textiles", "organic muslin", "luxury linen", "agoraloom"],
  openGraph: {
    title: "AGORALOOM | Sustainable Artisan Textiles",
    description: "Handcrafted sustainable home textiles inspired by nature.",
    url: "https://agoraloom.com",
    siteName: "AGORALOOM",
    locale: "en_US",
    type: "website",
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <CartProvider>
          <Navbar />
          <CartDrawer />

          <main>
            {children}
          </main>

          <footer className="bg-soft border-t border-light section-spacing">
            <div className="container grid grid-cols-1 md:grid-cols-3 gap-12 text-center md:text-left">
              <div>
                <div className="font-heading font-bold text-2xl mb-4 tracking-tighter">AGORALOOM</div>
                <p className="text-muted text-sm max-w-xs mx-auto md:mx-0 leading-relaxed font-light">
                  Sustainably produced home textiles, inspired by the tranquility of nature.
                </p>
              </div>
              <div>
                <h4 className="text-sm uppercase tracking-widest text-muted mb-6">Quick Links</h4>
                <ul className="text-sm space-y-3">
                  <li><Link href="/shop" className="hover:text-accent transition-colors">Shop All</Link></li>
                  <li><Link href="/privacy" className="hover:text-accent transition-colors">Privacy Policy</Link></li>
                  <li><Link href="/terms" className="hover:text-accent transition-colors">Terms of Service</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="text-sm uppercase tracking-widest text-muted mb-6">Stay Inspired</h4>
                <p className="text-sm text-muted mb-6 leading-relaxed">
                  Join our collective for first access to new collections and artisanal stories.
                </p>
                <form className="flex gap-2">
                  <input
                    type="email"
                    placeholder="Email Address"
                    className="flex-1 bg-white border border-light p-3 text-xs outline-none focus:border-accent"
                  />
                  <button type="submit" className="btn-primary py-3 px-5 text-[10px] uppercase font-bold tracking-widest">
                    Join
                  </button>
                </form>
              </div>
            </div>
            <div className="container mt-16 pt-8 border-t border-light text-center text-[10px] text-muted uppercase tracking-widest">
              © {new Date().getFullYear()} AgoraLoom Collectives. Created with ❤️ for our community.
            </div>
          </footer>
        </CartProvider>
        <GoogleAnalytics gaId={process.env.NEXT_PUBLIC_GA_ID || ""} />
      </body>
    </html>
  );
}
