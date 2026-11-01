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

const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || 'G-Y8XJ4VX60N';
const META_PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '1739636207115257';

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" data-scroll-behavior="smooth">
            <head>
                {/* Meta Pixel Code (Only New Pixel: 1739636207115257) */}
                <script dangerouslySetInnerHTML={{
                    __html: `
!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');
                    `
                }} />
                <noscript>
                    <img
                        height="1"
                        width="1"
                        style={{ display: "none" }}
                        src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
                        alt=""
                    />
                </noscript>
                {/* End Meta Pixel Code */}

                {/* Google Analytics GA4 (Direct gtag.js - No GTM) */}
                <script async src={`https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`} />
                <script dangerouslySetInnerHTML={{
                    __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${GA_MEASUREMENT_ID}');
                    `
                }} />
                {/* End Google Analytics */}
            </head>
            <body className={`${inter.variable} ${outfit.variable} ${playfair.variable}`}>
                <Providers>
                    {children}
                </Providers>
            </body>
        </html>
    );
}
