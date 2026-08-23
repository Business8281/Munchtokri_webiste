import type { Metadata } from 'next';
import AboutClient from '@/components/about/AboutClient';

export const metadata: Metadata = {
    title: "About Us | Authentic Heritage of Malleswaram",
    description: "Learn about the 60-year legacy of Hurigalu Angadi and our journey from a small Malleswaram shop to Munch Tokri, bringing you authentic Karnataka snacks.",
    alternates: {
        canonical: '/about',
    },
};

export default function AboutPage() {
    return <AboutClient />;
}
