import { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const BASE_URL = 'https://munchtokri.com';

export default function sitemap(): MetadataRoute.Sitemap {
    const routes = [
        '',
        '/about',
        '/contact',
        '/shop',
        '/combos',
        '/build-mixture',
        '/privacy',
        '/terms',
        '/shipping',
        '/refund',
    ];

    return routes.map((route) => ({
        url: `${BASE_URL}${route}`,
        lastModified: new Date().toISOString().split('T')[0],
        changeFrequency: 'weekly' as const,
        priority: route === '' ? 1 : 0.8,
    }));
}
