import { supabase } from './supabase';

// Fallback Mock Data for UI Development
const MOCK_PRODUCTS = [
    {
        id: 1,
        etsy_listing_id: "123",
        title: "Minimalist Ceramic Vase",
        description: "A stunning handcrafted matte white ceramic vase. Its minimalist form and textured finish make it a perfect centerpiece for any modern home. Each piece is individually thrown on a wheel and glazed by hand, ensuring that no two are exactly alike. Ideal for dried flowers or as a standalone sculptural object.",
        price: 45.00,
        currency: "USD",
        stock_quantity: 12,
        main_image_url: "/assets/vase.png",
        all_images: JSON.stringify(["/assets/vase.png"]),
        category: "Home Decor",
        slug: "minimalist-ceramic-vase",
        is_active: true,
        material: "Hand-thrown Earthstone Ceramic, Matte Mineral Glaze",
        care_instructions: "Hand wash only with mild soap. Avoid abrasive materials to protect the matte finish.",
        size_guide: "Height: 22cm, Diameter: 12cm at widest point. Opening: 4cm."
    },
    {
        id: 2,
        etsy_listing_id: "456",
        title: "Luxury Linen Throw",
        description: "Indulge in the ultimate comfort with our luxury linen throw. Made from 100% premium European flax, this throw is breathable, soft, and durable. The oatmeal hue and subtle texture add a touch of rustic elegance to your living room or bedroom. Pre-washed for extra softness and a relaxed look.",
        price: 89.00,
        currency: "USD",
        stock_quantity: 5,
        main_image_url: "/assets/throw.png",
        all_images: JSON.stringify(["/assets/throw.png"]),
        category: "Bedding",
        slug: "luxury-linen-throw",
        is_active: true,
        material: "100% European Flax Linen (OEKO-TEX Certified)",
        care_instructions: "Machine wash on gentle cycle with cool water. Tumble dry on low heat or hang for a relaxed, natural texture. Do not bleach.",
        size_guide: "135cm x 200cm (Approx. 53\" x 79\")"
    },
    {
        id: 3,
        etsy_listing_id: "789",
        title: "Scented Wood Candle",
        description: "Elevate your atmosphere with our hand-poured soy wax candle. Housed in a bespoke amber glass jar, it features a crackling wood wick and a sophisticated blend of cedarwood, sage, and bergamot. Provides a clean, long-lasting burn of up to 50 hours. Perfect for creating a calm and inviting sanctuary.",
        price: 32.00,
        currency: "USD",
        stock_quantity: 20,
        main_image_url: "/assets/candle.png",
        all_images: JSON.stringify(["/assets/candle.png"]),
        category: "Fragrance",
        slug: "scented-wood-candle",
        is_active: true,
        material: "Natural Soy Wax, Wood Wick, Phthalate-free Fragrance Oils",
        care_instructions: "Trim wick to 1/4 inch before each burn. Do not burn for more than 4 hours at a time. Keep away from drafts and children.",
        size_guide: "8oz Jar. Burn time: 45-50 hours."
    }
];

export async function getProducts() {
    if (!supabase) return MOCK_PRODUCTS;

    try {
        const { data, error } = await supabase
            .from('store_products')
            .select('*')
            .eq('is_active', true);

        if (error) {
            console.error('Error fetching products:', JSON.stringify(error, null, 2));
            return MOCK_PRODUCTS;
        }

        return data.length > 0 ? data : MOCK_PRODUCTS;
    } catch (e) {
        console.error('Exception in getProducts:', e);
        return MOCK_PRODUCTS;
    }
}

export async function getProductBySlug(slug) {
    if (!supabase) return MOCK_PRODUCTS.find(p => p.slug === slug);

    try {
        const { data, error } = await supabase
            .from('store_products')
            .select('*')
            .eq('slug', slug)
            .single();

        if (error) {
            // PGRST116 means "No rows found" - we should fallback to mock data silently
            if (error.code !== 'PGRST116') {
                console.error('Error fetching product details:', JSON.stringify(error, null, 2));
            }
            return MOCK_PRODUCTS.find(p => p.slug === slug);
        }

        return data;
    } catch (e) {
        console.error('Exception in getProductBySlug:', e);
        return MOCK_PRODUCTS.find(p => p.slug === slug);
    }
}
export async function getRelatedProducts(category, excludeSlug, limit = 3) {
    if (!supabase) {
        return MOCK_PRODUCTS
            .filter(p => p.category === category && p.slug !== excludeSlug)
            .slice(0, limit);
    }

    try {
        const { data, error } = await supabase
            .from('store_products')
            .select('*')
            .eq('category', category)
            .neq('slug', excludeSlug)
            .eq('is_active', true)
            .limit(limit);

        if (error) {
            console.error('Error fetching related products:', error);
            return [];
        }

        return data;
    } catch (e) {
        console.error('Exception in getRelatedProducts:', e);
        return [];
    }
}
export async function getProductReviews(productId) {
    // Fallback Mock Reviews
    const MOCK_REVIEWS = [
        {
            id: 'rev-1',
            customer_name: 'Sophia Thorne',
            rating: 5,
            comment: 'Absolutely love the texture of the muslin. It feels so natural and airy.',
            is_verified_purchase: true,
            created_at: new Date().toISOString()
        },
        {
            id: 'rev-2',
            customer_name: 'Marcus Chen',
            rating: 4,
            comment: 'Great quality. The color is slightly different than the screen but still beautiful.',
            is_verified_purchase: true,
            created_at: new Date(Date.now() - 86400000 * 2).toISOString()
        }
    ];

    if (!supabase) return MOCK_REVIEWS;

    try {
        const { data, error } = await supabase
            .from('store_reviews')
            .select('*')
            .eq('product_id', productId)
            .order('created_at', { ascending: false });

        if (error) {
            // If the table doesn't exist yet (PGRST116 or 404), return mock data
            console.log('Database reviews not found, using fallback stories.');
            return MOCK_REVIEWS;
        }

        return data.length > 0 ? data : MOCK_REVIEWS;
    } catch (e) {
        console.error('Exception in getProductReviews:', e);
        return MOCK_REVIEWS;
    }
}

export async function getCategories() {
    const MOCK_CATEGORIES = [
        { id: 1, name: 'Living', slug: 'living' },
        { id: 2, name: 'Dining', slug: 'dining' },
        { id: 3, name: 'Bedroom', slug: 'bedroom' }
    ];

    if (!supabase) return MOCK_CATEGORIES;

    try {
        const { data, error } = await supabase
            .from('store_categories')
            .select('*')
            .order('display_order', { ascending: true });

        if (error) {
            console.error('Error fetching categories:', error);
            return MOCK_CATEGORIES;
        }
        return data.length > 0 ? data : MOCK_CATEGORIES;
    } catch (e) {
        console.error('Exception in getCategories:', e);
        return MOCK_CATEGORIES;
    }
}
