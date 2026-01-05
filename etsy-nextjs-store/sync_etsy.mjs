import 'dotenv/config';
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Use Service Role for backend sync
const supabase = createClient(supabaseUrl, supabaseKey);

// Etsy API Config
const ETSY_API_KEY = process.env.ETSY_API_KEY;
const ETSY_SHOP_ID = process.env.ETSY_SHOP_ID;
const ETSY_ACCESS_TOKEN = process.env.ETSY_ACCESS_TOKEN;

async function syncEtsyProducts() {
    console.log('🚀 Starting Etsy product sync...');

    if (!ETSY_API_KEY || !ETSY_SHOP_ID || !ETSY_ACCESS_TOKEN) {
        console.error('❌ Missing Etsy credentials in .env file.');
        return;
    }

    try {
        // 1. Fetch Active Listings from Etsy
        // Endpoint: /v3/application/shops/:shop_id/listings/active
        const response = await axios.get(`https://api.etsy.com/v3/public/apps/shops/${ETSY_SHOP_ID}/listings/active`, {
            headers: {
                'x-api-key': ETSY_API_KEY,
                'Authorization': `Bearer ${ETSY_ACCESS_TOKEN}`
            }
        });

        const listings = response.data.results;
        console.log(`📦 Found ${listings.length} active listings on Etsy.`);

        for (const listing of listings) {
            console.log(`🔹 Processing: ${listing.title}`);

            // 2. Fetch Listing Images (Sub-request)
            const imagesResponse = await axios.get(`https://api.etsy.com/v3/public/apps/listings/${listing.listing_id}/images`, {
                headers: {
                    'x-api-key': ETSY_API_KEY,
                    'Authorization': `Bearer ${ETSY_ACCESS_TOKEN}`
                }
            });

            const images = imagesResponse.data.results.map(img => img.url_fullxfull);
            const mainImage = images[0] || '';

            // 3. Map to Supabase Format
            const productData = {
                etsy_listing_id: listing.listing_id,
                title: listing.title,
                description: listing.description,
                price: parseFloat(listing.price.amount) / listing.price.divisor,
                currency: listing.price.currency_code,
                stock_quantity: listing.quantity,
                main_image_url: mainImage,
                all_images: JSON.stringify(images),
                slug: listing.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
                is_active: true,
                updated_at: new Date()
            };

            // 4. Upsert into Supabase
            const { error } = await supabase
                .from('store_products')
                .upsert(productData, { onConflict: 'etsy_listing_id' });

            if (error) {
                console.error(`❌ Error syncing product ${listing.listing_id}:`, error.message);
            } else {
                console.log(`✅ Synced: ${listing.title}`);
            }
        }

        console.log('🏁 Sync completed successfully!');

    } catch (error) {
        console.error('❌ Sync failed:', error.response?.data || error.message);
    }
}

syncEtsyProducts();
