import { MetadataRoute } from 'next';

export const dynamic = 'force-static';

const BASE_URL = 'https://munchtokri.com';

export default function robots(): MetadataRoute.Robots {
    return {
        rules: [
            {
                userAgent: '*',
                allow: '/',
                disallow: [
                    '/admin/',
                    '/dashboard/',
                    '/checkout/',
                    '/api/',
                    '/login',
                ],
            },
            // Explicitly allow common AI and search bots just to be sure
            {
                userAgent: [
                    'Googlebot',
                    'GPTBot',
                    'ChatGPT-User',
                    'Claude-Web',
                    'CCBot',
                    'PerplexityBot',
                    'Google-Extended',
                    'facebookexternalhit',
                    'MetaInspector',
                ],
                allow: '/',
            }
        ],
        sitemap: `${BASE_URL}/sitemap.xml`,
    };
}
