import type { Metadata } from "next";
import { Inter, Outfit, Playfair_Display } from "next/font/google";
import Providers from "@/components/providers/Providers";
import "./globals.css";

const inter = Inter({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-inter",
});

const outfit = Outfit({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-outfit",
});

const playfair = Playfair_Display({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-serif",
});

export const metadata: Metadata = {
    metadataBase: new URL('https://munchtokri.com'),
    title: {
        default: "Hurigalu Angadi - Authentic Karnataka Snacks Since 1961",
        template: "%s | Munch Tokri"
    },
    description: "Experience the authentic taste of traditional Karnataka snacks. Handcrafted with natural ingredients and roasted with 60+ years of heritage.",
    keywords: ["Karnataka snacks", "authentic Indian snacks", "Malleswaram snacks", "Hurigalu Angadi", "Munch Tokri", "traditional snacks Bangalore"],
    authors: [{ name: "Munch Tokri" }],
    creator: "Munch Tokri",
    publisher: "Munch Tokri",
    alternates: {
        canonical: '/',
    },
    openGraph: {
        title: "Hurigalu Angadi - Authentic Karnataka Snacks Since 1961",
        description: "Experience the authentic taste of traditional Karnataka snacks. Handcrafted with 60+ years of heritage.",
        url: 'https://munchtokri.com',
        siteName: 'Munch Tokri',
        images: [
            {
                url: '/images/hero_snacks.png',
                width: 1200,
                height: 630,
                alt: 'Munch Tokri - Authentic Karnataka Snacks',
            },
        ],
        locale: 'en_IN',
        type: 'website',
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            'max-video-preview': -1,
            'max-image-preview': 'large',
            'max-snippet': -1,
        },
    },
};

export const viewport = {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 1,
    userScalable: false,
    viewportFit: 'cover',
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" data-scroll-behavior="smooth">
            <head>
                {/* Google Tag Manager */}
                <script dangerouslySetInnerHTML={{
                    __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','GTM-PVDJMVB8');`
                }} />
                {/* End Google Tag Manager */}

            </head>
            <body className={`${inter.variable} ${outfit.variable} ${playfair.variable}`}>
                {/* Google Tag Manager (noscript) */}
                <noscript><iframe src="https://www.googletagmanager.com/ns.html?id=GTM-PVDJMVB8"
                    height="0" width="0" style={{ display: 'none', visibility: 'hidden' }}></iframe></noscript>
                {/* End Google Tag Manager (noscript) */}
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
