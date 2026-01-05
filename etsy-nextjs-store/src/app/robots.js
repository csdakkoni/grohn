export default function robots() {
    return {
        rules: {
            userAgent: '*',
            allow: '/',
            disallow: '/admin/',
        },
        sitemap: 'https://agoraloom.com/sitemap.xml',
    }
}
