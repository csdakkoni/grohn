import { getProducts } from '@/lib/products';

export default async function sitemap() {
    const products = await getProducts();

    const productEntries = products.map((product) => ({
        url: `https://agoraloom.com/product/${product.slug}`,
        lastModified: new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
    }));

    return [
        {
            url: 'https://agoraloom.com',
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 1,
        },
        {
            url: 'https://agoraloom.com/shop',
            lastModified: new Date(),
            changeFrequency: 'daily',
            priority: 0.9,
        },
        {
            url: 'https://agoraloom.com/about',
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        {
            url: 'https://agoraloom.com/contact',
            lastModified: new Date(),
            changeFrequency: 'monthly',
            priority: 0.5,
        },
        ...productEntries,
    ];
}
