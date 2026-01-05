import { NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export async function POST(request) {
    try {
        const { items } = await request.json();

        if (!items || items.length === 0) {
            return NextResponse.json({ error: 'No items in cart' }, { status: 400 });
        }

        // Map items to Stripe format
        const lineItems = items.map(item => ({
            price_data: {
                currency: item.currency.toLowerCase(),
                product_data: {
                    name: item.title,
                    description: item.category,
                    tax_code: 'txcd_99999999', // General tangible goods
                    images: [item.main_image_url.startsWith('/') ? `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}${item.main_image_url}` : item.main_image_url],
                },
                unit_amount: Math.round(item.price * 100), // Stripe uses cents
            },
            quantity: item.quantity,
        }));

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: lineItems,
            mode: 'payment',
            automatic_tax: { enabled: true },
            success_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/success?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/cart`,
            shipping_address_collection: {
                allowed_countries: ['US', 'CA', 'GB', 'TR'],
            },
            billing_address_collection: 'required',
        });

        return NextResponse.json({ url: session.url });

    } catch (error) {
        console.error('Stripe Session Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
